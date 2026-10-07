"""
PLANORA Floor-Plan Validator
Performs strict architectural and geometric validation:
1. Boundary check (all rooms within plot boundary)
2. Overlap check (no interior room overlap)
3. Room-size check (all rooms meet or exceed minimum dimensions and area)
4. Room-count check (exact match with requirements)
5. Basic connectivity check (no isolated rooms, walkable adjacency graph)
"""

from collections import deque
from typing import Dict, Any, List, Tuple
from generator.rules import FloorPlanRules, DEFAULT_RULES
from generator.layout import Layout, Room


class FloorPlanValidator:
    """Validator class to evaluate floor-plan layouts against architectural constraints."""

    def __init__(self, rules: FloorPlanRules = DEFAULT_RULES):
        self.rules = rules

    def validate(self, layout: Layout, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a layout against requirements and architectural rules.
        Returns dictionary:
        {
            "valid": bool,
            "errors": List[str]
        }
        """
        errors: List[str] = []

        plot_w = float(requirements["plot"]["width"])
        plot_l = float(requirements["plot"]["length"])
        req_rooms = requirements.get("rooms", {})

        # 1. Boundary Check
        boundary_errors = self._check_boundaries(layout.rooms, plot_w, plot_l)
        errors.extend(boundary_errors)

        # 2. Overlap Check
        overlap_errors = self._check_overlaps(layout.rooms)
        errors.extend(overlap_errors)

        # 3. Room-Size Check
        size_errors = self._check_room_sizes(layout.rooms)
        errors.extend(size_errors)

        # 4. Room-Count Check
        count_errors = self._check_room_counts(layout.rooms, req_rooms)
        errors.extend(count_errors)

        # 5. Basic Connectivity Check
        connectivity_errors = self._check_connectivity(layout.rooms)
        errors.extend(connectivity_errors)

        return {
            "valid": len(errors) == 0,
            "errors": errors,
        }

    def _check_boundaries(self, rooms: List[Room], plot_w: float, plot_l: float) -> List[str]:
        """Verify that every room is fully inside the plot boundary."""
        errors = []
        tol = 1e-4
        for r in rooms:
            if r.x < -tol:
                errors.append(f"{r.name} violates left boundary: x={r.x:.2f} < 0")
            if r.y < -tol:
                errors.append(f"{r.name} violates bottom boundary: y={r.y:.2f} < 0")
            if r.x + r.width > plot_w + tol:
                errors.append(
                    f"{r.name} exceeds plot width: x+width={r.x + r.width:.2f} > plot_width={plot_w:.2f}"
                )
            if r.y + r.height > plot_l + tol:
                errors.append(
                    f"{r.name} exceeds plot length: y+height={r.y + r.height:.2f} > plot_length={plot_l:.2f}"
                )
        return errors

    def _check_overlaps(self, rooms: List[Room]) -> List[str]:
        """Verify that no two rooms overlap in 2D space."""
        errors = []
        n = len(rooms)
        for i in range(n):
            for j in range(i + 1, n):
                r1 = rooms[i]
                r2 = rooms[j]
                if r1.overlaps(r2):
                    errors.append(
                        f"{r1.name} ({r1.x:.1f},{r1.y:.1f},{r1.width:.1f}x{r1.height:.1f}) "
                        f"overlaps with {r2.name} ({r2.x:.1f},{r2.y:.1f},{r2.width:.1f}x{r2.height:.1f})"
                    )
        return errors

    def _check_room_sizes(self, rooms: List[Room]) -> List[str]:
        """Verify that each room satisfies minimum width, length, and area rules."""
        errors = []
        for r in rooms:
            is_valid, msg = self.rules.check_room_dimensions(r.room_type, r.width, r.height)
            if not is_valid:
                errors.append(f"{r.name}: {msg}")
        return errors

    def _check_room_counts(self, rooms: List[Room], req_rooms: Dict[str, int]) -> List[str]:
        """Verify that the layout contains exactly the required number of each room type."""
        errors = []
        type_counts: Dict[str, int] = {
            "bedroom": 0,
            "bathroom": 0,
            "kitchen": 0,
            "living_room": 0,
            "balcony": 0,
            "dining_room": 0,
            "parking": 0,
            "utility": 0,
            "study_room": 0,
        }

        for r in rooms:
            k = r.room_type.lower().replace(" ", "_")
            if k in type_counts:
                type_counts[k] += 1
            else:
                errors.append(f"Unexpected room type found in layout: {r.name} ({r.room_type})")

        # Check required counts
        expected_bedrooms = req_rooms.get("bedrooms", 2)
        expected_bathrooms = req_rooms.get("bathrooms", 1)
        expected_kitchen = req_rooms.get("kitchen", 1)
        expected_living = req_rooms.get("living_room", 1)
        expected_balcony = req_rooms.get("balcony", 0)
        expected_dining = req_rooms.get("dining_room", 0)
        expected_parking = req_rooms.get("parking", 0)
        expected_utility = req_rooms.get("utility", 0)
        expected_study = req_rooms.get("study_room", 0)

        if type_counts["bedroom"] != expected_bedrooms:
            errors.append(f"Expected {expected_bedrooms} bedrooms, found {type_counts['bedroom']}")
        if type_counts["bathroom"] != expected_bathrooms:
            errors.append(f"Expected {expected_bathrooms} bathrooms, found {type_counts['bathroom']}")
        if type_counts["kitchen"] != expected_kitchen:
            errors.append(f"Expected {expected_kitchen} kitchen, found {type_counts['kitchen']}")
        if type_counts["living_room"] != expected_living:
            errors.append(f"Expected {expected_living} living room, found {type_counts['living_room']}")
        if expected_balcony and type_counts["balcony"] != expected_balcony:
            errors.append(f"Expected {expected_balcony} balcony, found {type_counts['balcony']}")
        if expected_dining and type_counts["dining_room"] != expected_dining:
            errors.append(f"Expected {expected_dining} dining room, found {type_counts['dining_room']}")
        if expected_parking and type_counts["parking"] != expected_parking:
            errors.append(f"Expected {expected_parking} parking, found {type_counts['parking']}")
        if expected_utility and type_counts["utility"] != expected_utility:
            errors.append(f"Expected {expected_utility} utility, found {type_counts['utility']}")
        if expected_study and type_counts["study_room"] != expected_study:
            errors.append(f"Expected {expected_study} study room, found {type_counts['study_room']}")

        total_expected = (
            expected_bedrooms + expected_bathrooms + expected_kitchen + expected_living +
            expected_balcony + expected_dining + expected_parking + expected_utility + expected_study
        )
        if len(rooms) != total_expected:
            errors.append(f"Total room count mismatch: expected {total_expected}, found {len(rooms)}")

        return errors

    def _check_connectivity(self, rooms: List[Room]) -> List[str]:
        """
        Check connectivity graph:
        All rooms must form a single connected graph where rooms share walls
        sufficient for door openings (min 2.5 ft). No room may be completely isolated.
        """
        errors = []
        if not rooms:
            return ["Layout has no rooms to validate connectivity"]

        # Build adjacency graph
        adj: Dict[str, List[str]] = {r.name: [] for r in rooms}
        min_door_wall = self.rules.min_door_width

        n = len(rooms)
        for i in range(n):
            for j in range(i + 1, n):
                r1 = rooms[i]
                r2 = rooms[j]
                if r1.shared_wall(r2, min_length=min_door_wall):
                    adj[r1.name].append(r2.name)
                    adj[r2.name].append(r1.name)

        # Check for isolated rooms (degree 0)
        for name, neighbors in adj.items():
            if len(neighbors) == 0:
                errors.append(
                    f"{name} is isolated: it does not share an accessible wall (>= {min_door_wall} ft) with any other room"
                )

        # Graph connectivity check via BFS
        start_room = rooms[0].name
        # Prefer living room as starting hub if available
        for r in rooms:
            if r.room_type == "living_room":
                start_room = r.name
                break

        visited = set()
        queue = deque([start_room])
        visited.add(start_room)

        while queue:
            curr = queue.popleft()
            for neighbor in adj.get(curr, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        if len(visited) < len(rooms):
            unvisited = [r.name for r in rooms if r.name not in visited]
            errors.append(
                f"Layout is partitioned into disconnected sections. Unreachable rooms: {', '.join(unvisited)}"
            )

        return errors


def validate_layout(
    layout: Layout,
    requirements: Dict[str, Any],
    rules: FloorPlanRules = DEFAULT_RULES,
) -> Dict[str, Any]:
    """Helper functional wrapper for layout validation."""
    validator = FloorPlanValidator(rules)
    return validator.validate(layout, requirements)
