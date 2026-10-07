"""
PLANORA Automated Dataset Engine
One-click end-to-end dataset generator and ML packaging pipeline.
Features:
1. Bulk generation & validation of N floor plans
2. Support for multi-plot sizes (20x40, 25x40, 30x40, 30x50, 40x60)
3. Support for multi-room programs (1B1B, 2B1B, 2B2B, 3B2B, 4B3B)
4. Mixed-mode dataset generation (random combinations across presets)
5. Automated Train/Validation/Test split (e.g. 80/10/10)
6. Direct export to LLM fine-tuning JSONL (prompt -> SVG or prompt -> layout JSON)
7. Tabular CSV/Parquet-ready summary export
8. Automatic re-indexing of preview.html interactive gallery
"""

import os
import sys
import json
import csv
import random
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional

# Ensure parent directory is in sys.path
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from generator.rules import FloorPlanRules, DEFAULT_RULES
from generator.layout import LayoutGenerator, generate_requirements, Layout, PRESETS
from generator.validator import validate_layout
from generator.svg_generator import generate_svg
from generator.export_preview import generate_preview_html


def build_llm_sample(plan_id: str, requirements: Dict[str, Any], layout: Layout, svg_content: str, target: str = "svg") -> Dict[str, Any]:
    """
    Format a dataset item into standard ChatML format for LLM fine-tuning.
    """
    plot = requirements["plot"]
    rooms = requirements["rooms"]

    bath_str = f"{rooms['bathrooms']} bathrooms" if rooms['bathrooms'] > 1 else "1 bathroom"
    bed_str = f"{rooms['bedrooms']} bedrooms" if rooms['bedrooms'] > 1 else "1 bedroom"

    parts = [bed_str, bath_str, f"{rooms['kitchen']} kitchen", f"{rooms['living_room']} living room"]
    if rooms.get("dining_room", 0):
        parts.append(f"{rooms['dining_room']} dining room")
    if rooms.get("balcony", 0):
        parts.append(f"{rooms['balcony']} balcony")
    if rooms.get("parking", 0):
        parts.append(f"{rooms['parking']} car parking porch")
    if rooms.get("utility", 0):
        parts.append(f"{rooms['utility']} utility room")
    if rooms.get("study_room", 0):
        parts.append(f"{rooms['study_room']} study room")

    program_str = ", ".join(parts)
    user_prompt = (
        f"Generate a valid residential architectural floor plan for a rectangular plot of "
        f"{plot['width']}x{plot['length']} {plot['unit']} with {program_str}. "
        f"Ensure zero overlaps, valid circulation, and satisfy minimum architectural room dimensions."
    )

    if target == "svg":
        assistant_reply = svg_content
    elif target == "layout":
        assistant_reply = json.dumps(layout.to_dict(), indent=2)
    else:
        assistant_reply = json.dumps({
            "layout": layout.to_dict(),
            "svg": svg_content
        }, indent=2)

    return {
        "id": plan_id,
        "messages": [
            {
                "role": "system",
                "content": "You are PLANORA, an AI residential architect that generates mathematically verified, code-compliant floor plans."
            },
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": assistant_reply}
        ]
    }


def run_automated_pipeline(
    count: int = 50,
    output_dir: str = "./dataset",
    preset: Optional[str] = None,
    plot_width: Optional[float] = None,
    plot_length: Optional[float] = None,
    bedrooms: Optional[int] = None,
    bathrooms: Optional[int] = None,
    balcony: Optional[int] = None,
    dining_room: Optional[int] = None,
    parking: Optional[int] = None,
    utility: Optional[int] = None,
    study_room: Optional[int] = None,
    mixed: bool = False,
    train_split: float = 0.8,
    val_split: float = 0.1,
    test_split: float = 0.1,
    seed: int = 42,
    clean: bool = True,
    update_preview: bool = True,
) -> Dict[str, Any]:
    """
    Executes the full automated dataset creation, validation, ML packaging,
    and preview re-indexing workflow.
    """
    out_path = Path(output_dir).resolve()
    out_path.mkdir(parents=True, exist_ok=True)

    if clean:
        print(f"[*] Cleaning existing plan folders in {out_path}...")
        for child in out_path.iterdir():
            if child.is_dir() and child.name.startswith("P"):
                for sub in child.iterdir():
                    sub.unlink()
                child.rmdir()

    rng = random.Random(seed)

    # Determine generation mode
    mode_desc = ""
    if mixed:
        mode_desc = "Mixed Variety Mode (Random combinations across presets)"
    elif preset and preset in PRESETS:
        p_cfg = PRESETS[preset]
        plot_width = p_cfg["plot_width"]
        plot_length = p_cfg["plot_length"]
        bedrooms = p_cfg["bedrooms"]
        bathrooms = p_cfg["bathrooms"]
        balcony = balcony if balcony is not None else p_cfg.get("balcony", 0)
        dining_room = dining_room if dining_room is not None else p_cfg.get("dining_room", 0)
        parking = parking if parking is not None else p_cfg.get("parking", 0)
        utility = utility if utility is not None else p_cfg.get("utility", 0)
        study_room = study_room if study_room is not None else p_cfg.get("study_room", 0)
        extras = []
        if balcony: extras.append(f"{balcony} Balcony")
        if dining_room: extras.append("Dining")
        if parking: extras.append("Parking")
        if utility: extras.append("Utility")
        if study_room: extras.append("Study")
        extra_str = f" + {', '.join(extras)}" if extras else ""
        mode_desc = f"Preset Mode: {preset} ({plot_width:.0f}x{plot_length:.0f} ft, {bedrooms} Bed, {bathrooms} Bath{extra_str})"
    else:
        plot_width = plot_width or 20.0
        plot_length = plot_length or 40.0
        bedrooms = bedrooms or 2
        bathrooms = bathrooms or 1
        balcony = balcony or 0
        dining_room = dining_room or 0
        parking = parking or 0
        utility = utility or 0
        study_room = study_room or 0
        mode_desc = f"Custom Mode: {plot_width:.0f}x{plot_length:.0f} ft, {bedrooms} Bed, {bathrooms} Bath"

    print("\n" + "=" * 65)
    print("PLANORA AUTOMATED DATASET & ML PACKAGING PIPELINE")
    print("=" * 65)
    print(f"Configuration:    {mode_desc}")
    print(f"Target Count:     {count} verified plans")
    print(f"Train/Val/Test:   {int(train_split*100)}% / {int(val_split*100)}% / {int(test_split*100)}%")
    print(f"Output Directory: {out_path}")
    print("-" * 65)

    valid_count = 0
    total_attempts = 0
    llm_samples_svg: List[Dict[str, Any]] = []
    llm_samples_layout: List[Dict[str, Any]] = []
    tabular_rows: List[Dict[str, Any]] = []

    while valid_count < count:
        total_attempts += 1
        item_num = valid_count + 1
        plan_id = f"P{item_num:03d}"

        # If mixed mode, select random preset for this example
        if mixed:
            preset_name = rng.choice(list(PRESETS.keys()))
            cfg = PRESETS[preset_name]
            cur_pw = cfg["plot_width"]
            cur_pl = cfg["plot_length"]
            cur_beds = cfg["bedrooms"]
            cur_baths = cfg["bathrooms"]
            cur_balcony = cfg.get("balcony", 0)
            cur_dining = cfg.get("dining_room", 0)
            cur_parking = cfg.get("parking", 0)
            cur_utility = cfg.get("utility", 0)
            cur_study = cfg.get("study_room", 0)
        else:
            cur_pw = plot_width
            cur_pl = plot_length
            cur_beds = bedrooms
            cur_baths = bathrooms
            cur_balcony = balcony
            cur_dining = dining_room
            cur_parking = parking
            cur_utility = utility
            cur_study = study_room

        rules = FloorPlanRules(plot_width=cur_pw, plot_length=cur_pl)
        layout_gen = LayoutGenerator(rules)

        # 1. Generate Requirements
        requirements = generate_requirements(
            plan_id=plan_id,
            plot_width=cur_pw,
            plot_length=cur_pl,
            bedrooms=cur_beds,
            bathrooms=cur_baths,
            kitchen=1,
            living_room=1,
            balcony=cur_balcony,
            dining_room=cur_dining,
            parking=cur_parking,
            utility=cur_utility,
            study_room=cur_study,
        )

        # 2. Procedural Candidate Layout
        step_seed = rng.randint(0, 10_000_000)
        candidate = layout_gen.generate(requirements, seed=step_seed)

        # 3. Validation
        val_res = validate_layout(candidate, requirements, rules)

        if val_res["valid"]:
            # 4. Generate SVG
            svg_content = generate_svg(candidate, plan_id)

            # 5. Save Item Directory (P001, P002, ...)
            plan_dir = out_path / plan_id
            plan_dir.mkdir(parents=True, exist_ok=True)

            with open(plan_dir / "requirements.json", "w", encoding="utf-8") as f:
                json.dump(requirements, f, indent=2)

            with open(plan_dir / "layout.json", "w", encoding="utf-8") as f:
                json.dump(candidate.to_dict(), f, indent=2)

            with open(plan_dir / "floorplan.svg", "w", encoding="utf-8") as f:
                f.write(svg_content)

            # 6. ML Data Samples
            llm_samples_svg.append(build_llm_sample(plan_id, requirements, candidate, svg_content, target="svg"))
            llm_samples_layout.append(build_llm_sample(plan_id, requirements, candidate, svg_content, target="layout"))

            # Tabular feature row
            row = {
                "plan_id": plan_id,
                "archetype": candidate.archetype,
                "plot_width": candidate.plot_width,
                "plot_length": candidate.plot_length,
                "plot_area": candidate.plot_width * candidate.plot_length,
                "bedrooms_count": cur_beds,
                "bathrooms_count": cur_baths,
                "balcony_count": cur_balcony,
                "dining_count": cur_dining,
                "parking_count": cur_parking,
                "utility_count": cur_utility,
                "study_count": cur_study,
                "rooms_count": len(candidate.rooms),
                "doors_count": len(candidate.doors),
                "is_valid": True,
            }
            # Append individual room areas
            for r in candidate.rooms:
                clean_name = r.name.lower().replace(" ", "_")
                row[f"{clean_name}_area"] = r.area
            tabular_rows.append(row)

            valid_count += 1
            if valid_count % max(1, count // 10) == 0 or valid_count == count:
                extra_tags = []
                if cur_parking: extra_tags.append("Pkg")
                if cur_balcony: extra_tags.append("Balc")
                if cur_dining: extra_tags.append("Din")
                tag_str = f" + {'/'.join(extra_tags)}" if extra_tags else ""
                print(f"[*] Progress: {valid_count}/{count} plans ({cur_pw:.0f}x{cur_pl:.0f}, {cur_beds}B{cur_baths}B{tag_str}) -> Valid")

    # 7. Split into Train / Val / Test
    indices = list(range(count))
    rng.shuffle(indices)

    n_train = int(count * train_split)
    n_val = int(count * val_split)

    train_idx = set(indices[:n_train])
    val_idx = set(indices[n_train:n_train + n_val])
    test_idx = set(indices[n_train + n_val:])

    # 8. Export JSONL files for LLM training
    ml_dir = out_path / "ml_exports"
    ml_dir.mkdir(parents=True, exist_ok=True)

    def write_jsonl(filename: Path, samples: List[Dict[str, Any]], target_indices: set):
        with open(filename, "w", encoding="utf-8") as f:
            for i in target_indices:
                f.write(json.dumps(samples[i]) + "\n")

    write_jsonl(ml_dir / "train_svg.jsonl", llm_samples_svg, train_idx)
    write_jsonl(ml_dir / "val_svg.jsonl", llm_samples_svg, val_idx)
    write_jsonl(ml_dir / "test_svg.jsonl", llm_samples_svg, test_idx)

    write_jsonl(ml_dir / "train_layout.jsonl", llm_samples_layout, train_idx)
    write_jsonl(ml_dir / "val_layout.jsonl", llm_samples_layout, val_idx)
    write_jsonl(ml_dir / "test_layout.jsonl", llm_samples_layout, test_idx)

    # 9. Export Tabular CSV
    csv_file = ml_dir / "floorplans_tabular.csv"
    if tabular_rows:
        # Collect all unique fieldnames
        all_keys = set()
        for r in tabular_rows:
            all_keys.update(r.keys())
        fieldnames = ["plan_id", "archetype", "plot_width", "plot_length", "plot_area", "bedrooms_count", "bathrooms_count", "rooms_count", "doors_count", "is_valid"]
        for k in sorted(all_keys):
            if k not in fieldnames:
                fieldnames.append(k)

        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, restval=0.0)
            writer.writeheader()
            writer.writerows(tabular_rows)

    # 10. Automatically Refresh preview.html
    if update_preview:
        preview_file = parent_dir / "preview.html"
        generate_preview_html(out_path, preview_file)

    print("\n" + "=" * 65)
    print("PIPELINE EXECUTION COMPLETED")
    print("=" * 65)
    print(f"Generated Plans:  {valid_count} (100% valid)")
    print(f"Total Attempts:   {total_attempts}")
    print(f"Train / Val / Test: {len(train_idx)} / {len(val_idx)} / {len(test_idx)}")
    print(f"Dataset Folder:   {out_path}")
    print(f"ML Exports:       {ml_dir}")
    print(f"  |-- train_svg.jsonl ({len(train_idx)} samples)")
    print(f"  |-- val_svg.jsonl   ({len(val_idx)} samples)")
    print(f"  |-- train_layout.jsonl")
    print(f"  |-- val_layout.jsonl")
    print(f"  \\-- floorplans_tabular.csv")
    print(f"Browser Preview:  {parent_dir / 'preview.html'}")
    print("=" * 65 + "\n")

    return {
        "valid_count": valid_count,
        "ml_dir": str(ml_dir),
        "train_count": len(train_idx),
        "val_count": len(val_idx),
        "test_count": len(test_idx),
    }


def main():
    parser = argparse.ArgumentParser(
        description="PLANORA Automated Dataset Engine & Multi-Configuration Generator"
    )
    parser.add_argument(
        "--count",
        "-c",
        type=int,
        default=50,
        help="Number of valid floor plans to generate and package (default: 50)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="./dataset",
        help="Output dataset directory path (default: ./dataset)",
    )
    parser.add_argument(
        "--preset",
        type=str,
        default=None,
        choices=list(PRESETS.keys()),
        help=f"Preset configuration: {', '.join(PRESETS.keys())}",
    )
    parser.add_argument(
        "--plot-width",
        type=float,
        default=None,
        help="Plot width in feet (e.g. 20, 25, 30, 40)",
    )
    parser.add_argument(
        "--plot-length",
        type=float,
        default=None,
        help="Plot length in feet (e.g. 30, 40, 50, 60)",
    )
    parser.add_argument(
        "--bedrooms",
        type=int,
        default=None,
        help="Number of bedrooms (1, 2, 3, 4)",
    )
    parser.add_argument(
        "--bathrooms",
        type=int,
        default=None,
        help="Number of bathrooms (1, 2, 3)",
    )
    parser.add_argument(
        "--balcony",
        type=int,
        default=None,
        help="Number of balconies (0, 1)",
    )
    parser.add_argument(
        "--dining",
        type=int,
        default=None,
        help="Number of dining rooms (0, 1)",
    )
    parser.add_argument(
        "--parking",
        type=int,
        default=None,
        help="Number of car parking porches (0, 1)",
    )
    parser.add_argument(
        "--utility",
        type=int,
        default=None,
        help="Number of utility/laundry rooms (0, 1)",
    )
    parser.add_argument(
        "--study",
        type=int,
        default=None,
        help="Number of study/office rooms (0, 1)",
    )
    parser.add_argument(
        "--mixed",
        action="store_true",
        help="Generate a diverse dataset mixing various plot sizes and room configurations",
    )
    parser.add_argument(
        "--train-split",
        type=float,
        default=0.8,
        help="Proportion of training set (default: 0.8)",
    )
    parser.add_argument(
        "--val-split",
        type=float,
        default=0.1,
        help="Proportion of validation set (default: 0.1)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Do not clean dataset directory before generating",
    )

    args = parser.parse_args()

    run_automated_pipeline(
        count=args.count,
        output_dir=args.output,
        preset=args.preset,
        plot_width=args.plot_width,
        plot_length=args.plot_length,
        bedrooms=args.bedrooms,
        bathrooms=args.bathrooms,
        balcony=args.balcony,
        dining_room=args.dining,
        parking=args.parking,
        utility=args.utility,
        study_room=args.study,
        mixed=args.mixed,
        train_split=args.train_split,
        val_split=args.val_split,
        test_split=round(1.0 - (args.train_split + args.val_split), 2),
        seed=args.seed,
        clean=not args.no_clean,
        update_preview=True,
    )


if __name__ == "__main__":
    main()
