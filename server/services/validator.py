"""
PLANORA Constraint Validation Engine
Phase 5 implementation: strict architectural, geometric, and topological validation of floor plans.
"""

from typing import Dict, Any, List, Set, Tuple, Optional
from collections import deque


# Configurable Architectural Constraints (in feet)
MIN_ROOM_DIMENSIONS = {
    "bedroom": {"min_w": 10.0, "min_h": 10.0, "min_area": 100.0, "max_dim": 28.0},
    "living_room": {"min_w": 10.0, "min_h": 10.0, "min_area": 100.0, "max_dim": 35.0},
    "kitchen": {"min_w": 7.0, "min_h": 7.0, "min_area": 55.0, "max_dim": 22.0},
    "bathroom": {"min_short": 4.5, "min_long": 6.5, "min_area": 30.0, "max_dim": 16.0},
    "dining_room": {"min_w": 7.5, "min_h": 7.5, "min_area": 60.0, "max_dim": 25.0},
    "balcony": {"min_w": 6.0, "min_h": 3.5, "min_area": 25.0, "max_dim": 25.0},
    "parking": {"min_w": 8.5, "min_h": 13.0, "min_area": 115.0, "max_dim": 25.0},
    "utility": {"min_w": 4.5, "min_h": 4.5, "min_area": 20.0, "max_dim": 16.0},
    "study_room": {"min_w": 7.5, "min_h": 7.5, "min_area": 55.0, "max_dim": 20.0},
}


def validate_floor_plan(layout: Dict[str, Any], requirements: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Evaluates a floor plan against all 11 architectural constraints:
    1. Plot boundary
    2. Room overlap
    3. Required room count
    4. Required room types
    5. Minimum room dimensions
    6. Maximum room dimensions
    7. Parking requirement
    8. Connectivity / adjacency
    9. Entrance placement
    10. Doors validity
    11. Windows validity
    """
    errors: List[str] = []
    warnings: List[str] = []

    plot = layout.get("plot", {})
    plot_w = float(plot.get("width", 30.0))
    plot_l = float(plot.get("length", plot.get("height", 40.0)))
    rooms = layout.get("rooms", [])
    doors = layout.get("doors", [])
    windows = layout.get("windows", [])

    tol = 0.05  # coordinate tolerance in feet

    if not rooms:
        return {
            "valid": False,
            "errors": ["Layout contains no room elements."],
            "warnings": []
        }

    # 1. Plot Boundary Check
    for r in rooms:
        name = r.get("name", r.get("type", "Room"))
        rx = float(r.get("x", 0))
        ry = float(r.get("y", 0))
        rw = float(r.get("width", 0))
        rh = float(r.get("height", 0))

        if rx < -tol or ry < -tol:
            errors.append(f"{name} is positioned outside plot boundary (negative coords: x={rx:.1f}, y={ry:.1f}).")
        if (rx + rw) > (plot_w + tol):
            errors.append(f"{name} exceeds plot width (x+w={rx+rw:.1f} > plot width={plot_w:.1f}).")
        if (ry + rh) > (plot_l + tol):
            errors.append(f"{name} exceeds plot length (y+h={ry+rh:.1f} > plot length={plot_l:.1f}).")

    # 2. Room Overlap Check
    n_rooms = len(rooms)
    for i in range(n_rooms):
        for j in range(i + 1, n_rooms):
            r1 = rooms[i]
            r2 = rooms[j]
            r1_x, r1_y, r1_w, r1_h = float(r1["x"]), float(r1["y"]), float(r1["width"]), float(r1["height"])
            r2_x, r2_y, r2_w, r2_h = float(r2["x"]), float(r2["y"]), float(r2["width"]), float(r2["height"])

            # Check interior overlap
            x_overlap = (max(r1_x, r2_x) < min(r1_x + r1_w, r2_x + r2_w) - tol)
            y_overlap = (max(r1_y, r2_y) < min(r1_y + r1_h, r2_y + r2_h) - tol)

            if x_overlap and y_overlap:
                errors.append(
                    f"{r1.get('name', 'Room 1')} ({r1_w:.1f}x{r1_h:.1f} at {r1_x:.1f},{r1_y:.1f}) "
                    f"overlaps with {r2.get('name', 'Room 2')} ({r2_w:.1f}x{r2_h:.1f} at {r2_x:.1f},{r2_y:.1f})."
                )

    # 3 & 4. Required Room Count & Types Check
    actual_counts: Dict[str, int] = {}
    for r in rooms:
        rtype = r.get("type", "").lower().strip()
        actual_counts[rtype] = actual_counts.get(rtype, 0) + 1

    if requirements and "rooms" in requirements:
        req_rooms = requirements["rooms"]
        for req_type, expected_count in req_rooms.items():
            if expected_count > 0:
                # normalize key
                norm_req = "living_room" if "living" in req_type else ("bathroom" if "bath" in req_type else req_type.rstrip("s"))
                actual_c = actual_counts.get(norm_req, 0)
                if actual_c == 0:
                    errors.append(f"Required room type missing: {req_type.replace('_', ' ').title()}.")
                elif actual_c < expected_count:
                    errors.append(f"Room count deficit: Expected {expected_count} {req_type}, found {actual_c}.")

    # 5 & 6. Minimum & Maximum Room Dimensions
    for r in rooms:
        rtype = r.get("type", "").lower().strip()
        name = r.get("name", rtype)
        rw = float(r.get("width", 0))
        rh = float(r.get("height", 0))
        area = rw * rh

        rules = MIN_ROOM_DIMENSIONS.get(rtype)
        if rules:
            max_d = rules.get("max_dim", 30.0)
            if rw > max_d or rh > max_d:
                warnings.append(f"{name} dimension ({rw:.1f}x{rh:.1f}) exceeds recommended maximum of {max_d} ft.")

            if rtype == "bathroom":
                short_s = min(rw, rh)
                long_s = max(rw, rh)
                if short_s < rules["min_short"] - tol or long_s < rules["min_long"] - tol:
                    errors.append(f"{name} dimension ({rw:.1f}x{rh:.1f} ft) is below minimum required {rules['min_short']}x{rules['min_long']} ft.")
            else:
                min_w = rules.get("min_w", 6.0)
                min_h = rules.get("min_h", 6.0)
                if rw < min_w - tol or rh < min_h - tol:
                    errors.append(f"{name} dimension ({rw:.1f}x{rh:.1f} ft) is below minimum required {min_w}x{min_h} ft.")

            min_a = rules.get("min_area", 20.0)
            if area < min_a - tol:
                errors.append(f"{name} total area ({area:.1f} sq ft) is below minimum of {min_a} sq ft.")

    # 7. Parking Requirement Check
    if requirements and requirements.get("rooms", {}).get("parking", 0) > 0:
        if actual_counts.get("parking", 0) == 0:
            errors.append("Parking was requested by user but is missing from generated layout.")

    # 8. Connectivity / Circulation Adjacency Check
    # Build shared wall adjacency graph
    adj: Dict[str, Set[str]] = {r.get("name", str(idx)): set() for idx, r in enumerate(rooms)}
    for i in range(n_rooms):
        for j in range(i + 1, n_rooms):
            r1 = rooms[i]
            r2 = rooms[j]
            name1 = r1.get("name", str(i))
            name2 = r2.get("name", str(j))

            # Check if sharing a common wall of at least 2.5 ft
            x1, y1, w1, h1 = float(r1["x"]), float(r1["y"]), float(r1["width"]), float(r1["height"])
            x2, y2, w2, h2 = float(r2["x"]), float(r2["y"]), float(r2["width"]), float(r2["height"])

            # Horizontal shared boundary (y1 + h1 == y2 or y2 + h2 == y1)
            if abs((y1 + h1) - y2) < tol or abs((y2 + h2) - y1) < tol:
                overlap_x = min(x1 + w1, x2 + w2) - max(x1, x2)
                if overlap_x >= 2.4:
                    adj[name1].add(name2)
                    adj[name2].add(name1)

            # Vertical shared boundary (x1 + w1 == x2 or x2 + w2 == x1)
            if abs((x1 + w1) - x2) < tol or abs((x2 + w2) - x1) < tol:
                overlap_y = min(y1 + h1, y2 + h2) - max(y1, y2)
                if overlap_y >= 2.4:
                    adj[name1].add(name2)
                    adj[name2].add(name1)

    # Check for isolated rooms (rooms with zero adjacent rooms)
    for rname, neighbors in adj.items():
        if len(neighbors) == 0 and len(rooms) > 1:
            errors.append(f"{rname} is physically isolated with no adjacent walls to other rooms.")

    # 9. Entrance Placement
    # Ensure there is an exterior entrance door (typically into living room or parking on front wall y=0)
    has_exterior_entrance = False
    for d in doors:
        if d.get("room_a") == "Exterior" or d.get("room_b") == "Exterior":
            has_exterior_entrance = True
            break
    if not has_exterior_entrance:
        # Check if living room touches y=0
        living_touches_front = any(r.get("type") == "living_room" and abs(float(r.get("y", 0))) < tol for r in rooms)
        if not living_touches_front:
            warnings.append("Living room does not directly touch front plot boundary (y=0).")
        else:
            warnings.append("No explicit exterior entrance door defined in door table.")

    # 10. Doors Validity
    for d in doors:
        dx, dy, dw = float(d.get("x", 0)), float(d.get("y", 0)), float(d.get("width", 2.5))
        if dw < 2.0:
            errors.append(f"Door width {dw:.1f} ft between {d.get('room_a')} and {d.get('room_b')} is below standard 2.0 ft.")
        if dx < -tol or dy < -tol or dx > plot_w + tol or dy > plot_l + tol:
            errors.append(f"Door between {d.get('room_a')} and {d.get('room_b')} is placed outside plot.")

    # 11. Windows Validity
    for w in windows:
        wx, wy, ww = float(w.get("x", 0)), float(w.get("y", 0)), float(w.get("width", 3.0))
        # Window should lie on exterior plot boundary
        on_left = abs(wx) < tol
        on_right = abs(wx - plot_w) < tol or abs(wx + ww - plot_w) < tol
        on_front = abs(wy) < tol
        on_rear = abs(wy - plot_l) < tol or abs(wy + float(w.get("height", 0)) - plot_l) < tol

        if not (on_left or on_right or on_front or on_rear):
            warnings.append(f"Window for {w.get('room')} at ({wx:.1f}, {wy:.1f}) is on an interior wall rather than exterior facade.")

    is_valid = len(errors) == 0

    return {
        "valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "metrics": {
            "room_count": len(rooms),
            "plot_area": plot_w * plot_l,
            "built_area": sum(float(r["width"]) * float(r["height"]) for r in rooms),
            "doors_count": len(doors),
            "windows_count": len(windows)
        }
    }
