"""
PLANORA Layout Repair Service
Phase 5 implementation: deterministic corrections for model-generated floor-plan coordinates.
Resolves boundary violations, minor room overlaps, dimensional undercuts, and recalibrates doors/windows.
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from copy import deepcopy

# Add dataset generator to path
dataset_dir = Path(r"c:\PLANORA\planora-dataset")
if str(dataset_dir) not in sys.path:
    sys.path.insert(0, str(dataset_dir))

from server.services.validator import validate_floor_plan, MIN_ROOM_DIMENSIONS
from generator.layout import LayoutGenerator


def clamp_to_boundary(rooms: List[Dict[str, Any]], plot_w: float, plot_l: float) -> bool:
    """Clamps all room coordinates within the plot perimeter."""
    modified = False
    for r in rooms:
        w = float(r.get("width", 10.0))
        h = float(r.get("height", 10.0))

        # Adjust dimensions if larger than plot
        if w > plot_w:
            w = plot_w
            r["width"] = round(w, 1)
            modified = True
        if h > plot_l:
            h = plot_l
            r["height"] = round(h, 1)
            modified = True

        rx = float(r.get("x", 0.0))
        ry = float(r.get("y", 0.0))

        # Clamp X
        if rx < 0.0:
            r["x"] = 0.0
            modified = True
        elif rx + w > plot_w:
            r["x"] = round(max(0.0, plot_w - w), 1)
            modified = True

        # Clamp Y
        if ry < 0.0:
            r["y"] = 0.0
            modified = True
        elif ry + h > plot_l:
            r["y"] = round(max(0.0, plot_l - h), 1)
            modified = True

    return modified


def resolve_overlaps(rooms: List[Dict[str, Any]], plot_w: float, plot_l: float) -> bool:
    """Detects and resolves small geometric overlaps between adjacent rooms."""
    modified = False
    n = len(rooms)
    tol = 0.05

    for i in range(n):
        for j in range(i + 1, n):
            r1 = rooms[i]
            r2 = rooms[j]

            x1, y1, w1, h1 = float(r1["x"]), float(r1["y"]), float(r1["width"]), float(r1["height"])
            x2, y2, w2, h2 = float(r2["x"]), float(r2["y"]), float(r2["width"]), float(r2["height"])

            x_overlap = min(x1 + w1, x2 + w2) - max(x1, x2)
            y_overlap = min(y1 + h1, y2 + h2) - max(y1, y2)

            if x_overlap > tol and y_overlap > tol:
                # Resolve in whichever axis has smaller overlap
                if x_overlap <= y_overlap:
                    # Separate along X
                    if x1 <= x2:
                        # r1 is left of r2; shift partition
                        new_split = round(x1 + w1 - x_overlap, 1)
                        r1["width"] = round(new_split - x1, 1)
                        modified = True
                    else:
                        new_split = round(x2 + w2 - x_overlap, 1)
                        r2["width"] = round(new_split - x2, 1)
                        modified = True
                else:
                    # Separate along Y
                    if y1 <= y2:
                        # r1 is below r2; shift partition
                        new_split = round(y1 + h1 - y_overlap, 1)
                        r1["height"] = round(new_split - y1, 1)
                        modified = True
                    else:
                        new_split = round(y2 + h2 - y_overlap, 1)
                        r2["height"] = round(new_split - y2, 1)
                        modified = True

    return modified


def repair_room_dimensions(rooms: List[Dict[str, Any]], plot_w: float, plot_l: float) -> bool:
    """Enforces minimum dimension rules where reasonable space permits."""
    modified = False
    for r in rooms:
        rtype = r.get("type", "").lower()
        rule = MIN_ROOM_DIMENSIONS.get(rtype)
        if not rule:
            continue

        w = float(r.get("width", 0))
        h = float(r.get("height", 0))
        rx = float(r.get("x", 0))
        ry = float(r.get("y", 0))

        if rtype == "bathroom":
            min_s = rule["min_short"]
            min_l = rule["min_long"]
            if min(w, h) < min_s:
                if w < min_s and rx + min_s <= plot_w:
                    r["width"] = min_s
                    modified = True
                elif h < min_s and ry + min_s <= plot_l:
                    r["height"] = min_s
                    modified = True
        else:
            min_w = rule.get("min_w", 6.0)
            min_h = rule.get("min_h", 6.0)
            if w < min_w and rx + min_w <= plot_w:
                r["width"] = min_w
                modified = True
            if h < min_h and ry + min_h <= plot_l:
                r["height"] = min_h
                modified = True

    return modified


def repair_layout(
    layout: Dict[str, Any],
    requirements: Optional[Dict[str, Any]] = None
) -> Tuple[Dict[str, Any], Dict[str, Any], bool]:
    """
    Executes layout repair pipeline:
    1. Runs initial validation.
    2. If invalid, applies deterministic clamping, overlap resolution, and dimension fixing.
    3. Re-validates.
    Returns: (final_layout, validation_report, was_repaired)
    """
    initial_val = validate_floor_plan(layout, requirements)
    if initial_val["valid"]:
        return layout, initial_val, False

    # Attempt repair on a copy
    candidate = deepcopy(layout)
    plot_w = float(candidate.get("plot", {}).get("width", 30.0))
    plot_l = float(candidate.get("plot", {}).get("length", candidate.get("plot", {}).get("height", 40.0)))
    rooms = candidate.get("rooms", [])

    if not rooms:
        try:
            gen = LayoutGenerator()
            req_dict = {
                "id": "P_SYNTHESIZED",
                "plot": {"width": plot_w, "length": plot_l, "unit": "ft"},
                "rooms": requirements.get("rooms", {}) if requirements else {
                    "bedrooms": 2, "bathrooms": 1, "kitchen": 1, "living_room": 1
                }
            }
            synth_layout = gen.generate(req_dict)
            synth_dict = synth_layout.to_dict()
            synth_val = validate_floor_plan(synth_dict, requirements)
            synth_val["warnings"].append("Plan was synthesized by Planora architectural constraint solver.")
            return synth_dict, synth_val, True
        except Exception as exc:
            print("Layout synthesis exception:", exc)
            return layout, initial_val, False

    pass1 = clamp_to_boundary(rooms, plot_w, plot_l)
    pass2 = resolve_overlaps(rooms, plot_w, plot_l)
    pass3 = repair_room_dimensions(rooms, plot_w, plot_l)
    pass4 = clamp_to_boundary(rooms, plot_w, plot_l)

    repaired = pass1 or pass2 or pass3 or pass4

    repaired_val = validate_floor_plan(candidate, requirements)

    # If candidate still has missing rooms or critical errors, synthesize valid plan using Planora Layout Engine
    if not repaired_val["valid"]:
        try:
            from generator.layout import LayoutGenerator
            gen = LayoutGenerator()
            # Construct standard requirements format
            req_dict = {
                "id": "P_REPAIRED",
                "plot": {
                    "width": plot_w,
                    "length": plot_l,
                    "unit": "ft"
                },
                "rooms": requirements.get("rooms", {}) if requirements else {
                    "bedrooms": 2, "bathrooms": 1, "kitchen": 1, "living_room": 1
                }
            }
            synth_layout = gen.generate(req_dict)
            synth_dict = synth_layout.to_dict()
            synth_val = validate_floor_plan(synth_dict, requirements)
            synth_val["warnings"].append("Plan was repaired and completed by Planora architectural constraint solver.")
            return synth_dict, synth_val, True
        except Exception as e:
            pass

    # Return repaired layout if valid or if it has fewer errors than initial
    if repaired_val["valid"] or len(repaired_val["errors"]) < len(initial_val["errors"]):
        if repaired:
            repaired_val["warnings"].append("Layout was automatically repaired by Planora constraint engine.")
        return candidate, repaired_val, True

    # Otherwise return original candidate with errors
    return layout, initial_val, False
