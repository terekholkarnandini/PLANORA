"""
PLANORA Architectural Model Evaluation Pipeline
Phase 9 implementation: calculates real domain-specific metrics for floor-plan generation.
Evaluates:
- Room Count Accuracy
- Required Room Accuracy
- Boundary Violation Rate
- Room Overlap Rate
- Constraint Satisfaction Rate
- Valid Plan Generation Rate
- Coordinate Error (MAE)
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

# Add project root to sys.path
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
for p in [str(project_root), str(project_root / "server"), str(project_root / "planora-dataset")]:
    if p not in sys.path:
        sys.path.insert(0, p)

from server.services.model_service import get_model_service
from server.services.parser import extract_requirements_from_prompt
from server.services.validator import validate_floor_plan
from training.dataset_loader import tokens_to_layout, load_planora_data, split_dataset


def run_evaluation(
    model_dir: str = r"c:\PLANORA\server\models\planora_t5",
    max_samples: int = 25,
    output_file: Optional[str] = None
) -> Dict[str, Any]:
    print("=" * 68)
    print("PLANORA ARCHITECTURAL MODEL EVALUATION (PHASE 9)")
    print(f"Model Directory: {model_dir}")
    print(f"Max Test Samples: {max_samples}")
    print("=" * 68)

    service = get_model_service()

    # Load test samples
    test_json = os.path.join(model_dir, "test_samples.json")
    test_pairs = []
    if os.path.exists(test_json):
        with open(test_json, "r", encoding="utf-8") as tf:
            test_pairs = json.load(tf)
    else:
        pairs, _ = load_planora_data(augment=False)
        _, _, test_pairs = split_dataset(pairs, seed=42)

    eval_samples = test_pairs[:max_samples]
    total_evaluated = len(eval_samples)
    print(f"[*] Evaluating {total_evaluated} test samples...\n")

    correct_room_counts = 0
    all_required_present = 0
    boundary_violations = 0
    overlap_violations = 0
    perfectly_valid_plans = 0
    coord_errors: List[float] = []

    results_table = []

    for idx, (prompt, target_tokens) in enumerate(eval_samples, 1):
        gt_layout = tokens_to_layout(target_tokens)
        gt_rooms = gt_layout.get("rooms", [])

        # Model generation & validation
        res = service.generate(prompt)
        pred_layout = res["layout"]
        val_report = res["validation"]
        req = res["requirements"]

        pred_rooms = pred_layout.get("rooms", [])

        # 1. Room Count Accuracy
        req_total_rooms = sum(req["rooms"].values())
        if len(pred_rooms) >= req_total_rooms:
            correct_room_counts += 1

        # 2. Required Room Types
        type_reqs = [k for k, v in req["rooms"].items() if v > 0]
        pred_types = set(r["type"] for r in pred_rooms)
        all_req_met = all(
            ("living_room" in pred_types if "living" in t else (t in pred_types or t.rstrip("s") in pred_types))
            for t in type_reqs
        )
        if all_req_met:
            all_required_present += 1

        # 3. Boundary Violations
        has_boundary_err = any("boundary" in e or "exceeds" in e for e in val_report.get("errors", []))
        if has_boundary_err:
            boundary_violations += 1

        # 4. Room Overlap
        has_overlap = any("overlap" in e for e in val_report.get("errors", []))
        if has_overlap:
            overlap_violations += 1

        # 5. Valid Plan Rate
        if val_report.get("valid", False):
            perfectly_valid_plans += 1

        # 6. Coordinate Error (MAE on shared room types)
        for pr in pred_rooms:
            matching_gt = [gr for gr in gt_rooms if gr["type"] == pr["type"]]
            if matching_gt:
                best_diff = min(
                    abs(pr["width"] - gr["width"]) + abs(pr["height"] - gr["height"])
                    for gr in matching_gt
                )
                coord_errors.append(best_diff)

        status_str = "VALID" if val_report.get("valid") else "REPAIRED" if res.get("was_repaired") else "INVALID"
        print(f"[{idx:02d}/{total_evaluated:02d}] Prompt: '{prompt[:42]}...' -> {len(pred_rooms)} rooms [{status_str}]")

        results_table.append({
            "id": idx,
            "prompt": prompt,
            "rooms_count": len(pred_rooms),
            "valid": val_report.get("valid", False),
            "errors": val_report.get("errors", []),
            "was_repaired": res.get("was_repaired", False)
        })

    # Aggregate Metrics
    room_count_acc = (correct_room_counts / total_evaluated) * 100.0 if total_evaluated else 0.0
    req_room_acc = (all_required_present / total_evaluated) * 100.0 if total_evaluated else 0.0
    boundary_violation_rate = (boundary_violations / total_evaluated) * 100.0 if total_evaluated else 0.0
    overlap_rate = (overlap_violations / total_evaluated) * 100.0 if total_evaluated else 0.0
    valid_plan_rate = (perfectly_valid_plans / total_evaluated) * 100.0 if total_evaluated else 0.0
    constraint_satisfaction = 100.0 - ((boundary_violation_rate + overlap_rate) / 2.0)
    avg_coord_err = sum(coord_errors) / max(1, len(coord_errors))

    metrics = {
        "total_test_samples": total_evaluated,
        "room_count_accuracy_pct": round(room_count_acc, 1),
        "required_room_accuracy_pct": round(req_room_acc, 1),
        "boundary_violation_rate_pct": round(boundary_violation_rate, 1),
        "room_overlap_rate_pct": round(overlap_rate, 1),
        "constraint_satisfaction_rate_pct": round(constraint_satisfaction, 1),
        "valid_plan_generation_rate_pct": round(valid_plan_rate, 1),
        "average_coordinate_mae_ft": round(avg_coord_err, 2),
    }

    print("\n" + "=" * 68)
    print("FINAL EVALUATION METRICS REPORT")
    print("=" * 68)
    print(f"  Total Test Samples Evaluated:    {metrics['total_test_samples']}")
    print(f"  Room Count Accuracy:             {metrics['room_count_accuracy_pct']}%")
    print(f"  Required Room Accuracy:          {metrics['required_room_accuracy_pct']}%")
    print(f"  Boundary Violation Rate:         {metrics['boundary_violation_rate_pct']}%")
    print(f"  Room Overlap Rate:               {metrics['room_overlap_rate_pct']}%")
    print(f"  Constraint Satisfaction Rate:    {metrics['constraint_satisfaction_rate_pct']}%")
    print(f"  Valid Plan Generation Rate:      {metrics['valid_plan_generation_rate_pct']}%")
    print(f"  Average Coordinate MAE:          {metrics['average_coordinate_mae_ft']} ft")
    print("=" * 68)

    save_path = output_file or os.path.join(model_dir, "evaluation_metrics.json")
    with open(save_path, "w", encoding="utf-8") as mf:
        json.dump({"metrics": metrics, "samples": results_table}, mf, indent=2)

    print(f"[*] Evaluation report persisted to: {save_path}\n")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Planora Architectural Generation")
    parser.add_argument("--model-dir", type=str, default=r"c:\PLANORA\server\models\planora_t5")
    parser.add_argument("--samples", type=int, default=15)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    run_evaluation(model_dir=args.model_dir, max_samples=args.samples, output_file=args.output)
