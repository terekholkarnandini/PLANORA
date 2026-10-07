"""
PLANORA Structured Output Parser
Phase 4 implementation: converts raw model output (or token sequences) into a robust, structured floor-plan dictionary.
Also extracts user requirements from natural language for constraint validation.
"""

import re
import json
from typing import Dict, Any, List, Optional, Tuple


ROOM_TYPE_MAP = {
    "bedroom": "bedroom",
    "master_bedroom": "bedroom",
    "bed": "bedroom",
    "living": "living_room",
    "living_room": "living_room",
    "hall": "living_room",
    "kitchen": "kitchen",
    "bathroom": "bathroom",
    "bath": "bathroom",
    "toilet": "bathroom",
    "wc": "bathroom",
    "balcony": "balcony",
    "dining": "dining_room",
    "dining_room": "dining_room",
    "parking": "parking",
    "car_parking": "parking",
    "garage": "parking",
    "car_porch": "parking",
    "porch": "parking",
    "utility": "utility",
    "laundry": "utility",
    "wash": "utility",
    "study": "study_room",
    "study_room": "study_room",
    "office": "study_room",
}


def normalize_room_type(raw_type: str) -> str:
    """Normalizes any variant of room name to the canonical room type string."""
    key = raw_type.lower().strip().replace(" ", "_")
    if key in ROOM_TYPE_MAP:
        return ROOM_TYPE_MAP[key]
    for k, v in ROOM_TYPE_MAP.items():
        if k in key:
            return v
    return key


def extract_requirements_from_prompt(prompt: str) -> Dict[str, Any]:
    """
    Extracts plot dimensions and requested room counts from natural language prompt.
    Returns:
    {
        "plot": {"width": 30.0, "length": 40.0, "unit": "ft"},
        "rooms": {
            "bedrooms": 2,
            "bathrooms": 2,
            "kitchen": 1,
            "living_room": 1,
            "dining_room": 1,
            "parking": 1,
            ...
        }
    }
    """
    clean_p = prompt.lower()

    # 1. Plot dimensions regex: e.g. "30x40", "30 x 40", "30 by 40", "20*40"
    plot_w, plot_l = 30.0, 40.0
    dim_match = re.search(r"(\d+)\s*(?:x|by|\*)\s*(\d+)\s*(?:ft|feet)?", clean_p)
    if dim_match:
        plot_w = float(dim_match.group(1))
        plot_l = float(dim_match.group(2))
    else:
        # Check area e.g. "1200 sq.ft" -> default 30x40
        area_match = re.search(r"(\d+)\s*(?:sq\s*ft|sqft|square\s*feet)", clean_p)
        if area_match:
            area = float(area_match.group(1))
            if area <= 650:
                plot_w, plot_l = 20.0, 30.0
            elif area <= 900:
                plot_w, plot_l = 20.0, 40.0
            elif area <= 1100:
                plot_w, plot_l = 25.0, 40.0
            elif area <= 1350:
                plot_w, plot_l = 30.0, 40.0
            elif area <= 1800:
                plot_w, plot_l = 30.0, 50.0
            else:
                plot_w, plot_l = 40.0, 60.0

    # 2. Room counts extraction helper
    def count_for_keywords(keywords: List[str], default: int = 0) -> int:
        for kw in keywords:
            # Look for number before keyword, e.g., "2 bedrooms", "3 bhk", "1 kitchen"
            pattern = rf"(\d+)\s*(?:-|–)?\s*(?:bhk|bed|beds|bedroom|bedrooms|bath|baths|bathroom|bathrooms|kitchen|kitchens|living|dining|balcony|parking|utility|study)?"
            m = re.search(rf"(\d+)\s+{kw}", clean_p)
            if m:
                return int(m.group(1))
            # Check "two bedrooms", "three bedrooms"
            words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}
            for w, n in words.items():
                if f"{w} {kw}" in clean_p:
                    return n

            # Check if mentioned without number, e.g., "with kitchen and parking"
            if kw in clean_p:
                return max(1, default)
        return default

    # BHK notation: e.g. "2 bhk", "3bhk"
    bhk_match = re.search(r"(\d+)\s*bhk", clean_p)
    bhk_count = int(bhk_match.group(1)) if bhk_match else None

    beds = bhk_count if bhk_count else count_for_keywords(["bedroom", "bedrooms", "bed", "beds"], default=2)
    baths = count_for_keywords(["bathroom", "bathrooms", "bath", "baths", "toilet"], default=1)
    kitchen = count_for_keywords(["kitchen", "kitchens"], default=1)
    living = count_for_keywords(["living room", "living", "hall"], default=1)
    dining = 1 if any(k in clean_p for k in ["dining", "dining room"]) else 0
    balcony = 1 if any(k in clean_p for k in ["balcony", "balconies"]) else 0
    parking = 1 if any(k in clean_p for k in ["parking", "car parking", "garage", "car porch"]) else 0
    utility = 1 if any(k in clean_p for k in ["utility", "laundry", "wash room"]) else 0
    study = 1 if any(k in clean_p for k in ["study", "study room", "office", "work room"]) else 0

    return {
        "plot": {
            "width": plot_w,
            "length": plot_l,
            "height": plot_l,
            "unit": "ft"
        },
        "rooms": {
            "bedrooms": beds,
            "bathrooms": baths,
            "kitchen": max(1, kitchen),
            "living_room": max(1, living),
            "dining_room": dining,
            "balcony": balcony,
            "parking": parking,
            "utility": utility,
            "study_room": study
        }
    }


def safe_float(val: Any, default: float = 0.0) -> float:
    try:
        clean = re.sub(r"[^0-9.]", "", str(val))
        return float(clean) if clean else default
    except Exception:
        return default


def parse_model_output(output_str: str) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Robust parser converting T5 model text into structured JSON layout.
    Returns (layout_dict, error_message).
    If error occurs, returns safe partial layout or structured error.
    """
    if not output_str or not output_str.strip():
        return {}, "Empty model output received"

    text = output_str.strip()

    # Case 1: Already valid JSON
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            if "rooms" in parsed and "plot" in parsed:
                return parsed, None
        except Exception:
            pass

    # Case 2: Controlled layout tokens format
    try:
        layout = {
            "plot": {"width": 30.0, "height": 40.0, "length": 40.0, "unit": "ft"},
            "rooms": [],
            "doors": [],
            "windows": []
        }

        # Plot match (handles <plot>, plot>, <plot, plot)
        plot_m = re.search(r"<?\s*plot\s*>?\s*([0-9.]+)\s+([0-9.]+)", text, re.IGNORECASE)
        if plot_m:
            pw = safe_float(plot_m.group(1), 30.0)
            pl = safe_float(plot_m.group(2), 40.0)
            layout["plot"] = {"width": pw, "height": pl, "length": pl, "unit": "ft"}

        # Rooms matches: handles <room>, room>, room >, <room, room/room, room
        room_matches = list(re.finditer(r"(?:<room>|room\s*>|<room|room\/room|\broom\b)\s*([a-zA-Z0-9_]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)", text, re.IGNORECASE))
        if not room_matches:
            # Try looser room match
            room_matches = list(re.finditer(r"room[>\s/]+([a-zA-Z0-9_]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)", text, re.IGNORECASE))

        type_counts: Dict[str, int] = {}
        for rm in room_matches:
            rtype = normalize_room_type(rm.group(1))
            if rtype in ("room", "type"):
                continue
            type_counts[rtype] = type_counts.get(rtype, 0) + 1
            name = f"{rtype.replace('_', ' ').title()}"
            if type_counts[rtype] > 1 or rtype in ("bedroom", "bathroom"):
                name = f"{name} {type_counts[rtype]}"

            rx = safe_float(rm.group(2), 0.0)
            ry = safe_float(rm.group(3), 0.0)
            rw = safe_float(rm.group(4), 10.0)
            rh = safe_float(rm.group(5), 10.0)

            layout["rooms"].append({
                "name": name,
                "room": name,
                "type": rtype,
                "x": round(rx, 2),
                "y": round(ry, 2),
                "width": round(rw, 2),
                "height": round(rh, 2)
            })

        # Doors matches: <door>, door>, door >
        door_matches = re.finditer(r"(?:<door>|door\s*>|<door|\bdoor\b)\s*([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([a-zA-Z]+)", text, re.IGNORECASE)
        for dm in door_matches:
            layout["doors"].append({
                "room_a": dm.group(1).replace("_", " ").title(),
                "room_b": dm.group(2).replace("_", " ").title(),
                "x": round(safe_float(dm.group(3)), 2),
                "y": round(safe_float(dm.group(4)), 2),
                "width": round(safe_float(dm.group(5), 2.5), 2),
                "orientation": dm.group(6).lower(),
                "swing": "inward"
            })

        # Windows matches: <window>, window>, window >
        win_matches = re.finditer(r"(?:<window>|window\s*>|<window|\bwindow\b)\s*([a-zA-Z0-9_]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([a-zA-Z]+)", text, re.IGNORECASE)
        for wm in win_matches:
            layout["windows"].append({
                "room": wm.group(1).replace("_", " ").title(),
                "x": round(safe_float(wm.group(2)), 2),
                "y": round(safe_float(wm.group(3)), 2),
                "width": round(safe_float(wm.group(4), 3.0), 2),
                "orientation": wm.group(5).lower()
            })

        return layout, None

    except Exception as exc:
        return {}, f"Error during parsing tokens: {str(exc)}"
