"""
PLANORA Synthetic Floor-Plan Dataset Generator
Main execution script for generating valid, diverse residential floor plans.
Executes the pipeline:
Requirements -> Generate Layout -> Validate Layout -> Save Valid Layout -> Generate Next
"""

import os
import sys
import json
import argparse
import random
from pathlib import Path
from typing import Dict, Any, List

# Ensure parent directory is on sys.path so 'generator' can be imported
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from generator.rules import FloorPlanRules, DEFAULT_RULES
from generator.layout import LayoutGenerator, generate_requirements, Layout
from generator.validator import validate_layout
from generator.svg_generator import generate_svg


def save_dataset_item(
    item_dir: Path,
    requirements: Dict[str, Any],
    layout: Layout,
    svg_content: str,
) -> None:
    """Save requirements.json, layout.json, and floorplan.svg into item_dir."""
    item_dir.mkdir(parents=True, exist_ok=True)

    # 1. requirements.json
    req_file = item_dir / "requirements.json"
    with open(req_file, "w", encoding="utf-8") as f:
        json.dump(requirements, f, indent=2)

    # 2. layout.json
    layout_file = item_dir / "layout.json"
    with open(layout_file, "w", encoding="utf-8") as f:
        json.dump(layout.to_dict(), f, indent=2)

    # 3. floorplan.svg
    svg_file = item_dir / "floorplan.svg"
    with open(svg_file, "w", encoding="utf-8") as f:
        f.write(svg_content)


def run_generator(
    count: int = 10,
    output_dir: str = "./dataset",
    seed: int = None,
    plot_width: float = 20.0,
    plot_length: float = 40.0,
    clean: bool = False,
    verbose: bool = False,
) -> Dict[str, Any]:
    """
    Generate the specified number of valid floor plans.
    Retries automatically on any invalid layout until the requested count is achieved.
    """
    out_path = Path(output_dir).resolve()
    out_path.mkdir(parents=True, exist_ok=True)

    if clean:
        for child in out_path.iterdir():
            if child.is_dir() and child.name.startswith("P"):
                for sub in child.iterdir():
                    sub.unlink()
                child.rmdir()

    rules = FloorPlanRules(plot_width=plot_width, plot_length=plot_length)
    layout_gen = LayoutGenerator(rules)
    rng = random.Random(seed) if seed is not None else random.Random()

    valid_count = 0
    rejected_count = 0
    total_attempts = 0
    generated_ids: List[str] = []

    print("\n" + "=" * 55)
    print("PLANORA SYNTHETIC DATASET GENERATOR")
    print("=" * 55)
    print(f"Target count:  {count}")
    print(f"Plot Size:     {plot_width:.0f} x {plot_length:.0f} ft (800 sq ft)")
    print(f"Output folder: {out_path}")
    print("-" * 55)

    while valid_count < count:
        total_attempts += 1
        item_num = valid_count + 1
        plan_id = f"P{item_num:03d}"

        # 1. Generate Requirements
        requirements = generate_requirements(
            plan_id=plan_id,
            plot_width=plot_width,
            plot_length=plot_length,
            bedrooms=2,
            bathrooms=1,
            kitchen=1,
            living_room=1,
        )

        # 2. Generate Candidate Layout
        step_seed = rng.randint(0, 10_000_000)
        candidate_layout = layout_gen.generate(requirements, seed=step_seed)

        # 3. Validate Candidate Layout
        val_result = validate_layout(candidate_layout, requirements, rules)

        if val_result["valid"]:
            # 4. Generate SVG Floor Plan
            svg_content = generate_svg(candidate_layout, plan_id)

            # 5. Save Valid Layout to dataset/Pxxx/
            item_dir = out_path / plan_id
            save_dataset_item(item_dir, requirements, candidate_layout, svg_content)

            valid_count += 1
            generated_ids.append(plan_id)

            if verbose or count <= 20 or valid_count % 10 == 0 or valid_count == count:
                print(
                    f"[{valid_count:03d}/{count:03d}] Generated {plan_id} "
                    f"({candidate_layout.archetype}) -> Valid"
                )
        else:
            rejected_count += 1
            if verbose:
                print(f"[REJECTED] Attempt {total_attempts} failed validation: {val_result['errors']}")

    # Summary Report matching specifications
    rel_saved_path = f"./{out_path.name}/" if out_path.is_relative_to(Path.cwd()) else str(out_path)

    print("\n" + "=" * 55)
    print("PLANORA SYNTHETIC DATASET GENERATOR - SUMMARY REPORT")
    print("=" * 55)
    print(f"Requested layouts: {count}")
    print(f"Valid layouts:     {valid_count}")
    print(f"Rejected layouts:  {rejected_count}")
    print(f"Total attempts:    {total_attempts}")
    print(f"Success rate:      {(valid_count / total_attempts) * 100:.1f}%")
    print(f"\nDataset saved to:  {rel_saved_path}")
    print("\nGenerated Plan IDs:")
    id_chunks = [generated_ids[i:i + 10] for i in range(0, len(generated_ids), 10)]
    for chunk in id_chunks:
        print("  " + ", ".join(chunk))
    print("=" * 55 + "\n")

    return {
        "requested": count,
        "valid": valid_count,
        "rejected": rejected_count,
        "total_attempts": total_attempts,
        "generated_ids": generated_ids,
        "output_dir": str(out_path),
    }


def main():
    parser = argparse.ArgumentParser(
        description="PLANORA V1 - Synthetic Residential Floor-Plan Dataset Generator"
    )
    parser.add_argument(
        "--count",
        "-c",
        type=int,
        default=10,
        help="Number of valid floor plans to generate (default: 10)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="./dataset",
        help="Output directory path (default: ./dataset)",
    )
    parser.add_argument(
        "--seed",
        "-s",
        type=int,
        default=None,
        help="Random seed for reproducible dataset generation",
    )
    parser.add_argument(
        "--plot-width",
        type=float,
        default=20.0,
        help="Plot width in feet (default: 20)",
    )
    parser.add_argument(
        "--plot-length",
        type=float,
        default=40.0,
        help="Plot length in feet (default: 40)",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Clean the output directory before generating new plans",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Print detailed rejection and validation messages",
    )

    args = parser.parse_args()

    run_generator(
        count=args.count,
        output_dir=args.output,
        seed=args.seed,
        plot_width=args.plot_width,
        plot_length=args.plot_length,
        clean=args.clean,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    main()
