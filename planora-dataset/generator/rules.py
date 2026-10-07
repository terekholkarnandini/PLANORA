"""
PLANORA Floor-Plan Architectural Rules
Defines minimum dimensions, room requirements, and spatial constraints.
Designed to be modular, configurable, and extensible for future plot sizes and room types.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Tuple, List


@dataclass
class RoomRule:
    """Architectural constraint rules for a specific room type."""
    min_width: float      # Minimum width in feet
    min_length: float     # Minimum length in feet
    min_area: float       # Minimum area in square feet
    recommended_min_dim: float = 0.0  # Optional recommended dimension


@dataclass
class PlotRule:
    """Plot boundary constraints."""
    width: float = 20.0
    length: float = 40.0
    unit: str = "ft"

    @property
    def total_area(self) -> float:
        return self.width * self.length


class FloorPlanRules:
    """
    Central repository of architectural rules for floor-plan generation.
    All parameters are configurable to allow adjusting constraints.
    """

    def __init__(
        self,
        plot_width: float = 20.0,
        plot_length: float = 40.0,
        room_rules: Dict[str, RoomRule] = None,
        min_door_width: float = 2.5,
        min_wall_overlap_for_door: float = 3.0,
    ):
        self.plot = PlotRule(width=plot_width, length=plot_length)
        self.min_door_width = min_door_width
        self.min_wall_overlap_for_door = min_wall_overlap_for_door

        # Default V1 Room Rules
        self.room_rules: Dict[str, RoomRule] = room_rules or {
            "bedroom": RoomRule(
                min_width=10.0,
                min_length=10.0,
                min_area=100.0,
            ),
            "living_room": RoomRule(
                min_width=10.0,
                min_length=10.0,
                min_area=100.0,
            ),
            "kitchen": RoomRule(
                min_width=8.0,
                min_length=8.0,
                min_area=64.0,
            ),
            "bathroom": RoomRule(
                min_width=5.0,
                min_length=7.0,
                min_area=35.0,
            ),
            "balcony": RoomRule(
                min_width=8.0,
                min_length=4.0,
                min_area=32.0,
            ),
            "dining_room": RoomRule(
                min_width=8.0,
                min_length=8.0,
                min_area=64.0,
            ),
            "parking": RoomRule(
                min_width=9.0,
                min_length=14.0,
                min_area=126.0,
            ),
            "utility": RoomRule(
                min_width=5.0,
                min_length=5.0,
                min_area=25.0,
            ),
            "study_room": RoomRule(
                min_width=8.0,
                min_length=8.0,
                min_area=64.0,
            ),
        }

        # Supported standard plot sizes
        self.supported_plots: List[Tuple[float, float]] = [
            (20.0, 30.0),
            (20.0, 40.0),
            (25.0, 40.0),
            (30.0, 40.0),
            (30.0, 50.0),
            (40.0, 60.0),
        ]

    def get_room_rule(self, room_type: str) -> RoomRule:
        """Fetch rule for a room type (normalized)."""
        key = room_type.lower().replace(" ", "_")
        if key in self.room_rules:
            return self.room_rules[key]
        if "bedroom" in key:
            return self.room_rules["bedroom"]
        if "bath" in key:
            return self.room_rules["bathroom"]
        if "kitchen" in key:
            return self.room_rules["kitchen"]
        if "living" in key:
            return self.room_rules["living_room"]
        if "balcony" in key:
            return self.room_rules["balcony"]
        if "dining" in key:
            return self.room_rules["dining_room"]
        if "parking" in key or "car" in key or "garage" in key:
            return self.room_rules["parking"]
        if "utility" in key or "wash" in key or "laundry" in key:
            return self.room_rules["utility"]
        if "study" in key or "office" in key:
            return self.room_rules["study_room"]
        raise KeyError(f"No rule configured for room type: {room_type}")

    def check_room_dimensions(self, room_type: str, width: float, height: float) -> Tuple[bool, str]:
        """
        Check if given room dimensions satisfy minimum rules.
        For directional flexibility (e.g. bathroom 5x7 or 7x5),
        the shorter side must be >= min_width and longer side >= min_length
        when min_width < min_length.
        """
        rule = self.get_room_rule(room_type)
        w, h = width, height

        # For asymmetric minimums like Bathroom (5x7)
        if rule.min_width != rule.min_length:
            short_side = min(w, h)
            long_side = max(w, h)
            target_short = min(rule.min_width, rule.min_length)
            target_long = max(rule.min_width, rule.min_length)

            if short_side < target_short - 1e-4 or long_side < target_long - 1e-4:
                return False, (
                    f"{room_type} dimension {w:.1f}x{h:.1f} violates minimum requirement "
                    f"of at least {target_short:.1f}x{target_long:.1f} ft."
                )
        else:
            if w < rule.min_width - 1e-4 or h < rule.min_length - 1e-4:
                return False, (
                    f"{room_type} dimension {w:.1f}x{h:.1f} violates minimum requirement "
                    f"of {rule.min_width:.1f}x{rule.min_length:.1f} ft."
                )

        area = w * h
        if area < rule.min_area - 1e-4:
            return False, f"{room_type} area {area:.1f} sq ft is below minimum {rule.min_area:.1f} sq ft."

        return True, ""


# Default instance ready for use
DEFAULT_RULES = FloorPlanRules()
