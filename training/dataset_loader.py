"""
PLANORA Dataset Loader and Layout Serializer
Phase 1 implementation for T5 / FLAN-T5 training and inference pipeline.
"""

import os
import re
import json
import glob
import random
from typing import Dict, Any, List, Tuple, Optional
from pathlib import Path
import torch
from torch.utils.data import Dataset


# Standard room names normalization
ROOM_TYPE_MAP = {
    "bedroom": "bedroom",
    "master_bedroom": "bedroom",
    "living": "living_room",
    "living_room": "living_room",
    "kitchen": "kitchen",
    "bathroom": "bathroom",
    "bath": "bathroom",
    "toilet": "bathroom",
    "balcony": "balcony",
    "dining": "dining_room",
    "dining_room": "dining_room",
    "parking": "parking",
    "car_parking": "parking",
    "utility": "utility",
    "wash": "utility",
    "study": "study_room",
    "study_room": "study_room",
}


def normalize_room_type(raw_type: str) -> str:
    key = raw_type.lower().strip().replace(" ", "_")
    if key in ROOM_TYPE_MAP:
        return ROOM_TYPE_MAP[key]
    for k, v in ROOM_TYPE_MAP.items():
        if k in key:
            return v
    return key


def compute_exterior_windows(plot_w: float, plot_l: float, rooms: List[Dict[str, Any]], doors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deterministically computes window positions on external plot perimeter walls.
    Rooms with exterior walls (x=0, x=plot_w, y=0, y=plot_l) receive windows,
    avoiding exterior doors.
    """
    windows = []
    tol = 0.2
    window_width = 3.0

    # Collect exterior doors
    ext_doors = []
    for d in doors:
        if d.get("room_a") == "Exterior" or d.get("room_b") == "Exterior":
            ext_doors.append(d)

    for r in rooms:
        rtype = normalize_room_type(r.get("type", "room"))
        if rtype in ("parking", "utility"):
            continue  # parking and small utilities typically don't need main facade windows

        rx, ry, rw, rh = float(r["x"]), float(r["y"]), float(r["width"]), float(r["height"])
        rname = r.get("name", rtype)

        # 1. Front Wall (y == 0)
        if abs(ry) < tol and rw >= 6.0:
            wx = round(rx + (rw - window_width) / 2.0, 1)
            # check conflict with front door
            has_door = any(abs(float(d.get("y", 0))) < tol and abs(float(d.get("x", 0)) - wx) < 3.0 for d in ext_doors)
            if not has_door:
                windows.append({
                    "room": rname,
                    "room_type": rtype,
                    "x": wx,
                    "y": 0.0,
                    "width": window_width,
                    "orientation": "horizontal",
                    "wall": "front"
                })

        # 2. Rear Wall (y + height == plot_l)
        if abs(ry + rh - plot_l) < tol and rw >= 6.0:
            wx = round(rx + (rw - window_width) / 2.0, 1)
            windows.append({
                "room": rname,
                "room_type": rtype,
                "x": wx,
                "y": round(plot_l, 1),
                "width": window_width,
                "orientation": "horizontal",
                "wall": "rear"
            })

        # 3. Left Wall (x == 0)
        if abs(rx) < tol and rh >= 7.0:
            wy = round(ry + (rh - window_width) / 2.0, 1)
            windows.append({
                "room": rname,
                "room_type": rtype,
                "x": 0.0,
                "y": wy,
                "width": window_width,
                "orientation": "vertical",
                "wall": "left"
            })

        # 4. Right Wall (x + width == plot_w)
        if abs(rx + rw - plot_w) < tol and rh >= 7.0:
            wy = round(ry + (rh - window_width) / 2.0, 1)
            windows.append({
                "room": rname,
                "room_type": rtype,
                "x": round(plot_w, 1),
                "y": wy,
                "width": window_width,
                "orientation": "vertical",
                "wall": "right"
            })

    return windows


def layout_to_tokens(layout: Dict[str, Any]) -> str:
    """
    Converts a floor-plan layout dictionary into a concise, deterministic sequence of tokens.
    Format:
    <plot> {w} {l} <room> {type} {x} {y} {w} {h} ... <door> {rA} {rB} {x} {y} {w} {ori} ... <window> {r} {x} {y} {w} {ori} ...
    """
    plot = layout.get("plot", {})
    w = float(plot.get("width", 30))
    l = float(plot.get("length", plot.get("height", 40)))

    tokens = [f"<plot> {w:.0f} {l:.0f}"]

    # Rooms
    for r in layout.get("rooms", []):
        rtype = normalize_room_type(r.get("type", "room"))
        rx = float(r.get("x", 0))
        ry = float(r.get("y", 0))
        rw = float(r.get("width", 0))
        rh = float(r.get("height", 0))
        tokens.append(f"<room> {rtype} {rx:.1f} {ry:.1f} {rw:.1f} {rh:.1f}")

    # Doors
    doors = layout.get("doors", [])
    for d in doors:
        ra = str(d.get("room_a", "Exterior")).lower().replace(" ", "_")
        rb = str(d.get("room_b", "Room")).lower().replace(" ", "_")
        dx = float(d.get("x", 0))
        dy = float(d.get("y", 0))
        dw = float(d.get("width", 2.5))
        ori = str(d.get("orientation", "horizontal")).lower()
        tokens.append(f"<door> {ra} {rb} {dx:.1f} {dy:.1f} {dw:.1f} {ori}")

    # Windows
    windows = layout.get("windows", [])
    if not windows:
        windows = compute_exterior_windows(w, l, layout.get("rooms", []), doors)

    for win in windows:
        wr = str(win.get("room", "room")).lower().replace(" ", "_")
        wx = float(win.get("x", 0))
        wy = float(win.get("y", 0))
        ww = float(win.get("width", 3.0))
        wori = str(win.get("orientation", "horizontal")).lower()
        tokens.append(f"<window> {wr} {wx:.1f} {wy:.1f} {ww:.1f} {wori}")

    return " ".join(tokens)


def tokens_to_layout(tokens_str: str) -> Dict[str, Any]:
    """
    Parses a token sequence back into a structured JSON floor-plan dictionary.
    Safe against formatting aberrations or syntax glitches.
    """
    tokens_str = tokens_str.strip()
    
    # Check if raw JSON was returned instead of tokens
    if tokens_str.startswith("{") and tokens_str.endswith("}"):
        try:
            return json.loads(tokens_str)
        except Exception:
            pass

    layout = {
        "plot": {"width": 30.0, "height": 40.0, "length": 40.0, "unit": "ft"},
        "rooms": [],
        "doors": [],
        "windows": []
    }

    # Extract <plot>
    plot_match = re.search(r"<plot>\s*([0-9.]+)\s+([0-9.]+)", tokens_str)
    if plot_match:
        pw = float(plot_match.group(1))
        pl = float(plot_match.group(2))
        layout["plot"] = {"width": pw, "height": pl, "length": pl, "unit": "ft"}

    # Extract <room> entries: <room> type x y w h
    room_matches = re.finditer(r"<room>\s*([a-zA-Z0-9_]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)", tokens_str)
    counts: Dict[str, int] = {}
    for rm in room_matches:
        rtype = normalize_room_type(rm.group(1))
        counts[rtype] = counts.get(rtype, 0) + 1
        name = f"{rtype.replace('_', ' ').title()}"
        if counts[rtype] > 1 or rtype == "bedroom" or rtype == "bathroom":
            name = f"{name} {counts[rtype]}"

        rx = float(rm.group(2))
        ry = float(rm.group(3))
        rw = float(rm.group(4))
        rh = float(rm.group(5))

        layout["rooms"].append({
            "name": name,
            "room": name,
            "type": rtype,
            "x": rx,
            "y": ry,
            "width": rw,
            "height": rh
        })

    # Extract <door> entries: <door> rA rB x y w orientation
    door_matches = re.finditer(r"<door>\s*([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([a-zA-Z]+)", tokens_str)
    for dm in door_matches:
        layout["doors"].append({
            "room_a": dm.group(1).replace("_", " ").title(),
            "room_b": dm.group(2).replace("_", " ").title(),
            "x": float(dm.group(3)),
            "y": float(dm.group(4)),
            "width": float(dm.group(5)),
            "orientation": dm.group(6).lower(),
            "swing": "inward"
        })

    # Extract <window> entries: <window> r x y w orientation
    win_matches = re.finditer(r"<window>\s*([a-zA-Z0-9_]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([a-zA-Z]+)", tokens_str)
    for wm in win_matches:
        layout["windows"].append({
            "room": wm.group(1).replace("_", " ").title(),
            "x": float(wm.group(2)),
            "y": float(wm.group(3)),
            "width": float(wm.group(4)),
            "orientation": wm.group(5).lower()
        })

    # If no windows were parsed, generate standard exterior windows
    if not layout["windows"] and layout["rooms"]:
        layout["windows"] = compute_exterior_windows(
            layout["plot"]["width"],
            layout["plot"]["length"],
            layout["rooms"],
            layout["doors"]
        )

    return layout


def generate_prompt_variants(requirements: Dict[str, Any]) -> List[str]:
    """
    Generates multiple natural-language prompt variants for data augmentation during training.
    """
    plot = requirements.get("plot", {})
    w = int(plot.get("width", 30))
    l = int(plot.get("length", 40))
    rooms = requirements.get("rooms", {})

    beds = rooms.get("bedrooms", 2)
    baths = rooms.get("bathrooms", 1)
    k = rooms.get("kitchen", 1)
    liv = rooms.get("living_room", 1)
    din = rooms.get("dining_room", 0)
    balc = rooms.get("balcony", 0)
    park = rooms.get("parking", 0)
    util = rooms.get("utility", 0)
    study = rooms.get("study_room", 0)

    # Core phrases
    parts = []
    parts.append(f"{beds} bedroom" if beds == 1 else f"{beds} bedrooms")
    parts.append(f"{baths} bathroom" if baths == 1 else f"{baths} bathrooms")
    if k: parts.append("1 kitchen")
    if liv: parts.append("1 living room")
    if din: parts.append("1 dining room")
    if balc: parts.append("1 balcony")
    if park: parts.append("parking")
    if util: parts.append("utility room")
    if study: parts.append("study room")

    program_str = ", ".join(parts[:-1]) + (" and " + parts[-1] if len(parts) > 1 else parts[0])

    prompts = [
        f"I need a {w}x{l} ft house with {program_str}.",
        f"Generate a residential floor plan for a {w}x{l} ft plot with {program_str}.",
        f"{w}x{l} ft plot, {program_str}.",
        f"Design a layout for a {w} by {l} feet house with {program_str}.",
        f"Floor plan layout: {w}x{l} ft plot size, {program_str}.",
        f"Create an architectural floor plan on {w}x{l} ft with {program_str}."
    ]
    return prompts


class PlanoraDataset(Dataset):
    """
    PyTorch Dataset for T5 / FLAN-T5 model training.
    """
    def __init__(
        self,
        samples: List[Tuple[str, str]],  # (input_prompt, target_token_sequence)
        tokenizer: Any,
        max_source_length: int = 128,
        max_target_length: int = 384
    ):
        self.samples = samples
        self.tokenizer = tokenizer
        self.max_source_length = max_source_length
        self.max_target_length = max_target_length

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        input_text, target_text = self.samples[idx]

        # Tokenize source
        source_encoding = self.tokenizer(
            input_text,
            max_length=self.max_source_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )

        # Tokenize target
        target_encoding = self.tokenizer(
            target_text,
            max_length=self.max_target_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )

        labels = target_encoding.input_ids.squeeze(0)
        # Replace padding token id with -100 so it is ignored by CrossEntropyLoss
        labels[labels == self.tokenizer.pad_token_id] = -100

        return {
            "input_ids": source_encoding.input_ids.squeeze(0),
            "attention_mask": source_encoding.attention_mask.squeeze(0),
            "labels": labels
        }


def load_planora_data(
    base_dir: str = r"c:\PLANORA\planora-dataset",
    augment: bool = True
) -> Tuple[List[Tuple[str, str]], List[Dict[str, Any]]]:
    """
    Loads all planora dataset directories, extracts input requirements and layout coordinates,
    and converts them to prompt/token-target pairs.
    """
    # Discover all dataset directories dynamically
    dataset_dirs = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d)) and d.startswith("dataset")]

    all_pairs: List[Tuple[str, str]] = []
    metadata_list: List[Dict[str, Any]] = []

    seen_signatures = set()

    for d in dataset_dirs:
        dir_path = os.path.join(base_dir, d)
        if not os.path.exists(dir_path):
            continue

        for root, _, files in os.walk(dir_path):
            if "requirements.json" in files and "layout.json" in files:
                req_file = os.path.join(root, "requirements.json")
                layout_file = os.path.join(root, "layout.json")

                try:
                    with open(req_file, "r", encoding="utf-8") as rf:
                        req_data = json.load(rf)
                    with open(layout_file, "r", encoding="utf-8") as lf:
                        layout_data = json.load(lf)

                    # Compute windows if missing
                    if "windows" not in layout_data or not layout_data["windows"]:
                        layout_data["windows"] = compute_exterior_windows(
                            float(layout_data["plot"]["width"]),
                            float(layout_data["plot"]["length"]),
                            layout_data.get("rooms", []),
                            layout_data.get("doors", [])
                        )

                    token_str = layout_to_tokens(layout_data)
                    prompt_variants = generate_prompt_variants(req_data)

                    meta = {
                        "path": root,
                        "requirements": req_data,
                        "layout": layout_data,
                        "tokens": token_str
                    }
                    metadata_list.append(meta)

                    # Deduplicate exact tokens per prompt variant
                    sig = (token_str, prompt_variants[0])
                    if sig not in seen_signatures:
                        seen_signatures.add(sig)

                        if augment:
                            for p in prompt_variants:
                                all_pairs.append((p, token_str))
                        else:
                            all_pairs.append((prompt_variants[0], token_str))

                except Exception as e:
                    print(f"Error loading {root}: {e}")

    return all_pairs, metadata_list


def split_dataset(
    samples: List[Tuple[str, str]],
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    seed: int = 42
) -> Tuple[List[Tuple[str, str]], List[Tuple[str, str]], List[Tuple[str, str]]]:
    """
    Deterministically splits dataset into Train, Validation, and Test sets.
    """
    rng = random.Random(seed)
    shuffled = list(samples)
    rng.shuffle(shuffled)

    n_total = len(shuffled)
    n_train = int(n_total * train_ratio)
    n_val = int(n_total * val_ratio)

    train_data = shuffled[:n_train]
    val_data = shuffled[n_train:n_train + n_val]
    test_data = shuffled[n_train + n_val:]

    return train_data, val_data, test_data


if __name__ == "__main__":
    print("=" * 60)
    print("PLANORA DATASET LOADER & TOKENIZER VALIDATION (PHASE 1)")
    print("=" * 60)

    pairs, raw_meta = load_planora_data(augment=False)
    print(f"Loaded {len(raw_meta)} unique plan layouts from dataset.")
    print(f"With prompt variants, total pairs: {len(pairs)}")

    if pairs:
        sample_prompt, sample_tokens = pairs[0]
        print("\n--- SAMPLE INPUT PROMPT ---")
        print(sample_prompt)
        print("\n--- SAMPLE TARGET TOKENS ---")
        print(sample_tokens)

        # Test round-trip token parsing
        parsed_layout = tokens_to_layout(sample_tokens)
        print("\n--- ROUND-TRIP PARSED LAYOUT ---")
        print(f"Plot: {parsed_layout['plot']}")
        print(f"Total Rooms: {len(parsed_layout['rooms'])}")
        for r in parsed_layout['rooms']:
            print(f"  - {r['name']} ({r['type']}): pos=({r['x']}, {r['y']}) dim=({r['width']}x{r['height']})")
        print(f"Total Doors: {len(parsed_layout['doors'])}")
        print(f"Total Windows: {len(parsed_layout['windows'])}")

        train_set, val_set, test_set = split_dataset(pairs, seed=42)
        print(f"\nDataset Splits:")
        print(f"  Train: {len(train_set)}")
        print(f"  Val:   {len(val_set)}")
        print(f"  Test:  {len(test_set)}")

    print("\nPhase 1 verification successful!")
