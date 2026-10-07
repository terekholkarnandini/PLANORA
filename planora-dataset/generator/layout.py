"""
PLANORA Layout Generator
Procedural residential floor-plan layout generation.
Generates structured room geometries, coordinates, dimensions, and door placements
based on architectural archetypes and controlled variations.
Supports:
- Multi-plot sizes (20x30, 20x40, 25x40, 30x40, 30x50, 40x60)
- Multi-room programs (1B1B, 2B1B, 2B2B, 3B2B, 4B3B)
"""

import random
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple

from generator.rules import FloorPlanRules, DEFAULT_RULES


@dataclass
class Room:
    """Represents a single rectangular room within the floor plan."""
    name: str              # e.g., "Bedroom 1", "Living Room"
    room_type: str         # e.g., "bedroom", "living_room", "kitchen", "bathroom"
    x: float               # X coordinate in feet (origin at bottom-left, y=0 is front)
    y: float               # Y coordinate in feet
    width: float           # Width along X axis in feet
    height: float          # Height along Y axis in feet

    def __post_init__(self):
        self.x = round(float(self.x), 2)
        self.y = round(float(self.y), 2)
        self.width = round(float(self.width), 2)
        self.height = round(float(self.height), 2)

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def x_max(self) -> float:
        return self.x + self.width

    @property
    def y_max(self) -> float:
        return self.y + self.height

    def overlaps(self, other: "Room", epsilon: float = 1e-4) -> bool:
        """
        Returns True if this room has interior intersection with another room.
        Sharing an edge or corner is NOT an overlap.
        """
        x_overlap = (max(self.x, other.x) < min(self.x_max, other.x_max) - epsilon)
        y_overlap = (max(self.y, other.y) < min(self.y_max, other.y_max) - epsilon)
        return x_overlap and y_overlap

    def shared_wall(self, other: "Room", min_length: float = 2.5) -> Optional[Tuple[str, float, float, float]]:
        """
        Check if self and other share a common wall segment of at least min_length.
        Returns: (orientation, fixed_coord, start_coord, end_coord) or None.
        Orientation is 'horizontal' (along X) or 'vertical' (along Y).
        """
        tol = 1e-3
        # Check horizontal shared wall (one is above the other)
        if abs(self.y_max - other.y) < tol or abs(other.y_max - self.y) < tol:
            fixed_y = self.y_max if abs(self.y_max - other.y) < tol else other.y_max
            x_start = max(self.x, other.x)
            x_end = min(self.x_max, other.x_max)
            if x_end - x_start >= min_length - tol:
                return ("horizontal", fixed_y, x_start, x_end)

        # Check vertical shared wall (one is to the side of the other)
        if abs(self.x_max - other.x) < tol or abs(other.x_max - self.x) < tol:
            fixed_x = self.x_max if abs(self.x_max - other.x) < tol else other.x_max
            y_start = max(self.y, other.y)
            y_end = min(self.y_max, other.y_max)
            if y_end - y_start >= min_length - tol:
                return ("vertical", fixed_x, y_start, y_end)

        return None

    def to_dict(self) -> Dict[str, Any]:
        """Output room dictionary matching dataset requirement format."""
        return {
            "name": self.name,
            "room": self.name,
            "type": self.room_type,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "width": round(self.width, 2),
            "height": round(self.height, 2),
        }


@dataclass
class Door:
    """Represents a door or opening connecting two spaces."""
    room_a: str
    room_b: str
    x: float
    y: float
    width: float
    orientation: str           # 'horizontal' or 'vertical'
    swing_direction: str = "inward"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "room_a": self.room_a,
            "room_b": self.room_b,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "width": round(self.width, 2),
            "orientation": self.orientation,
            "swing": self.swing_direction,
        }


@dataclass
class Layout:
    """Complete residential floor-plan layout."""
    plot_width: float
    plot_length: float
    rooms: List[Room]
    doors: List[Door] = field(default_factory=list)
    archetype: str = "custom"
    requirements_id: str = "P000"

    def get_room(self, name: str) -> Optional[Room]:
        for r in self.rooms:
            if r.name.lower() == name.lower() or r.room_type.lower() == name.lower():
                return r
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plot": {
                "width": round(self.plot_width, 2),
                "length": round(self.plot_length, 2),
            },
            "rooms": [r.to_dict() for r in self.rooms],
            "doors": [d.to_dict() for d in self.doors],
            "archetype": self.archetype,
        }


def generate_requirements(
    plan_id: str,
    plot_width: float = 20.0,
    plot_length: float = 40.0,
    bedrooms: int = 2,
    bathrooms: int = 1,
    kitchen: int = 1,
    living_room: int = 1,
    balcony: int = 0,
    dining_room: int = 0,
    parking: int = 0,
    utility: int = 0,
    study_room: int = 0,
) -> Dict[str, Any]:
    """Generate structured requirements dictionary for a floor plan."""
    rooms: Dict[str, int] = {
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "kitchen": kitchen,
        "living_room": living_room,
    }
    if balcony:
        rooms["balcony"] = balcony
    if dining_room:
        rooms["dining_room"] = dining_room
    if parking:
        rooms["parking"] = parking
    if utility:
        rooms["utility"] = utility
    if study_room:
        rooms["study_room"] = study_room

    return {
        "id": plan_id,
        "plot": {
            "width": int(plot_width) if plot_width.is_integer() else plot_width,
            "length": int(plot_length) if plot_length.is_integer() else plot_length,
            "unit": "ft",
        },
        "rooms": rooms,
    }


# Standard Presets for Easy Multi-Dataset Generation
PRESETS: Dict[str, Dict[str, Any]] = {
    # Standard Core Configurations
    "2b1b_20x40": {"plot_width": 20.0, "plot_length": 40.0, "bedrooms": 2, "bathrooms": 1, "kitchen": 1, "living_room": 1},
    "2b2b_20x40": {"plot_width": 20.0, "plot_length": 40.0, "bedrooms": 2, "bathrooms": 2, "kitchen": 1, "living_room": 1},
    "2b2b_25x40": {"plot_width": 25.0, "plot_length": 40.0, "bedrooms": 2, "bathrooms": 2, "kitchen": 1, "living_room": 1},
    "3b2b_25x40": {"plot_width": 25.0, "plot_length": 40.0, "bedrooms": 3, "bathrooms": 2, "kitchen": 1, "living_room": 1},
    "3b2b_30x40": {"plot_width": 30.0, "plot_length": 40.0, "bedrooms": 3, "bathrooms": 2, "kitchen": 1, "living_room": 1},
    "3b2b_30x50": {"plot_width": 30.0, "plot_length": 50.0, "bedrooms": 3, "bathrooms": 2, "kitchen": 1, "living_room": 1},
    "4b3b_40x60": {"plot_width": 40.0, "plot_length": 60.0, "bedrooms": 4, "bathrooms": 3, "kitchen": 1, "living_room": 1},
    "1b1b_20x30": {"plot_width": 20.0, "plot_length": 30.0, "bedrooms": 1, "bathrooms": 1, "kitchen": 1, "living_room": 1},

    # Premium Lifestyle Presets (Balcony, Dining, Car Parking, Utility)
    "2b1b_balcony_20x40": {
        "plot_width": 20.0, "plot_length": 40.0, "bedrooms": 2, "bathrooms": 1, "kitchen": 1, "living_room": 1, "balcony": 1
    },
    "2b2b_dining_balcony_25x40": {
        "plot_width": 25.0, "plot_length": 40.0, "bedrooms": 2, "bathrooms": 2, "kitchen": 1, "living_room": 1, "dining_room": 1, "balcony": 1
    },
    "3b2b_parking_balcony_30x50": {
        "plot_width": 30.0, "plot_length": 50.0, "bedrooms": 3, "bathrooms": 2, "kitchen": 1, "living_room": 1, "parking": 1, "dining_room": 1, "balcony": 1
    },
    "4b3b_villa_parking_balcony_40x60": {
        "plot_width": 40.0, "plot_length": 60.0, "bedrooms": 4, "bathrooms": 3, "kitchen": 1, "living_room": 1, "parking": 1, "dining_room": 1, "balcony": 1, "utility": 1
    },
}


class LayoutGenerator:
    """
    Procedural layout generator creating varied, valid residential floor plans.
    Dynamically routes based on plot dimensions and room programs,
    including lifestyle components (Balcony, Dining, Parking, Utility, Study).
    """

    def __init__(self, rules: FloorPlanRules = DEFAULT_RULES):
        self.rules = rules

    def generate(self, requirements: Dict[str, Any], seed: Optional[int] = None) -> Layout:
        """Generate a candidate layout from given requirements."""
        rng = random.Random(seed) if seed is not None else random.Random()

        plot_w = float(requirements["plot"]["width"])
        plot_l = float(requirements["plot"]["length"])
        plan_id = requirements.get("id", "P001")

        req_rooms = requirements.get("rooms", {})
        n_beds = req_rooms.get("bedrooms", 2)
        n_baths = req_rooms.get("bathrooms", 1)
        has_balcony = req_rooms.get("balcony", 0) > 0
        has_dining = req_rooms.get("dining_room", 0) > 0
        has_parking = req_rooms.get("parking", 0) > 0

        # Route to appropriate archetype family based on configuration
        if has_parking and n_beds >= 4:
            rooms, arch_name = self._generate_4bed_villa_parking_balcony_layout(plot_w, plot_l, rng)
        elif has_parking and n_beds >= 3:
            rooms, arch_name = self._generate_parking_balcony_layout(plot_w, plot_l, n_beds, n_baths, rng)
        elif has_balcony and has_dining:
            rooms, arch_name = self._generate_dining_balcony_layout(plot_w, plot_l, n_beds, n_baths, rng)
        elif has_balcony:
            rooms, arch_name = self._generate_balcony_layout(plot_w, plot_l, n_beds, n_baths, rng)
        elif n_beds == 1:
            rooms, arch_name = self._generate_1bed_layout(plot_w, plot_l, rng)
        elif n_beds == 2 and n_baths >= 2:
            rooms, arch_name = self._generate_2bed_2bath_layout(plot_w, plot_l, rng)
        elif n_beds == 3:
            rooms, arch_name = self._generate_3bed_layout(plot_w, plot_l, n_baths, rng)
        elif n_beds >= 4:
            rooms, arch_name = self._generate_4bed_layout(plot_w, plot_l, n_baths, rng)
        else:
            # Default 2 Bed, 1 Bath
            rooms, arch_name = self._generate_2bed_1bath_layout(plot_w, plot_l, rng)

        # Horizontal Mirroring (left-right flip) for 2x diversity
        if rng.random() > 0.5:
            rooms = self._mirror_horizontal(rooms, plot_w)
            arch_name += "_mirrored"

        # Generate realistic doors on shared walls between rooms & front entrance
        doors = self._generate_doors(rooms, plot_w, plot_l)

        return Layout(
            plot_width=plot_w,
            plot_length=plot_l,
            rooms=rooms,
            doors=doors,
            archetype=arch_name,
            requirements_id=plan_id,
        )

    # --------------------------------------------------------------------------
    # LIFESTYLE ARCHETYPES: Balcony, Dining, Car Parking, Utility
    # --------------------------------------------------------------------------
    def _generate_balcony_layout(self, W: float, L: float, n_beds: int, n_baths: int, rng: random.Random) -> Tuple[List[Room], str]:
        """2 Bed, 1 Bath + Private Master Balcony (20x40 ft, 800 sq ft)."""
        y_liv = rng.choice([13.0, 14.0])
        y_mid_h = rng.choice([10.0, 11.0])
        y_rear_start = y_liv + y_mid_h

        w_k = W / 2.0
        w_bath = W / 2.0

        rear_depth = L - y_rear_start
        h_balcony = 5.0
        h_bed1 = rear_depth - h_balcony

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, W, y_liv),
            Room("Kitchen", "kitchen", 0.0, y_liv, w_k, y_mid_h),
            Room("Bathroom", "bathroom", w_k, y_liv, w_bath, y_mid_h),
            Room("Bedroom 2", "bedroom", 0.0, y_rear_start, W / 2.0, rear_depth),
            Room("Bedroom 1", "bedroom", W / 2.0, y_rear_start, W / 2.0, h_bed1),
            Room("Balcony", "balcony", W / 2.0, y_rear_start + h_bed1, W / 2.0, h_balcony),
        ]
        return rooms, "2bed_master_garden_balcony"

    def _generate_dining_balcony_layout(self, W: float, L: float, n_beds: int, n_baths: int, rng: random.Random) -> Tuple[List[Room], str]:
        """2 Bed, 2 Bath + Dining + Private Balcony (25x40 ft, 1,000 sq ft)."""
        y_front = 14.0
        w_liv = max(13.0, W * 0.58)
        w_din = W - w_liv

        y_mid_h = 11.0
        y_rear_start = y_front + y_mid_h
        rear_depth = L - y_rear_start
        h_balcony = 5.0
        h_bed1 = rear_depth - h_balcony

        w_kit = W * 0.5
        w_baths = W - w_kit

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, w_liv, y_front),
            Room("Dining Room", "dining_room", w_liv, 0.0, w_din, y_front),
            Room("Kitchen", "kitchen", 0.0, y_front, w_kit, y_mid_h),
            Room("Bathroom 2", "bathroom", w_kit, y_front, w_baths / 2.0, y_mid_h),
            Room("Bathroom 1", "bathroom", w_kit + (w_baths / 2.0), y_front, w_baths / 2.0, y_mid_h),
            Room("Bedroom 2", "bedroom", 0.0, y_rear_start, W / 2.0, rear_depth),
            Room("Bedroom 1", "bedroom", W / 2.0, y_rear_start, W / 2.0, h_bed1),
            Room("Balcony", "balcony", W / 2.0, y_rear_start + h_bed1, W / 2.0, h_balcony),
        ]
        return rooms, "2bed_dining_master_balcony_suite"

    def _generate_4bed_villa_parking_balcony_layout(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        """4 Bed, 3 Bath + Car Parking Porch + Dining + Balcony + Utility (40x60 ft, 2,400 sq ft)."""
        w_park = 12.0
        w_liv = W - w_park
        y_front = 16.0

        y_mid_1 = 13.0
        y_zone2 = y_front + y_mid_1
        w_din = 15.0
        w_kit = 13.0
        w_util_bath = W - (w_din + w_kit)
        h_util = 6.0
        h_bath3 = y_mid_1 - h_util

        y_mid_2 = 14.0
        y_zone3 = y_zone2 + y_mid_2
        w_bed4 = 18.0
        w_bed3 = W - w_bed4

        rear_depth = L - y_zone3
        w_bed2 = 18.0
        w_bed1 = 14.0
        w_rear_bath = W - (w_bed2 + w_bed1)
        h_balcony = 5.0
        h_bath1 = 6.0
        h_bath2 = rear_depth - (h_balcony + h_bath1)

        rooms = [
            Room("Parking", "parking", 0.0, 0.0, w_park, y_front),
            Room("Living Room", "living_room", w_park, 0.0, w_liv, y_front),
            Room("Dining Room", "dining_room", 0.0, y_front, w_din, y_mid_1),
            Room("Kitchen", "kitchen", w_din, y_front, w_kit, y_mid_1),
            Room("Utility", "utility", w_din + w_kit, y_front, w_util_bath, h_util),
            Room("Bathroom 3", "bathroom", w_din + w_kit, y_front + h_util, w_util_bath, h_bath3),
            Room("Bedroom 4", "bedroom", 0.0, y_zone2, w_bed4, y_mid_2),
            Room("Bedroom 3", "bedroom", w_bed4, y_zone2, w_bed3, y_mid_2),
            Room("Bedroom 2", "bedroom", 0.0, y_zone3, w_bed2, rear_depth),
            Room("Bedroom 1", "bedroom", w_bed2, y_zone3, w_bed1, rear_depth),
            Room("Bathroom 2", "bathroom", w_bed2 + w_bed1, y_zone3, w_rear_bath, h_bath2),
            Room("Bathroom 1", "bathroom", w_bed2 + w_bed1, y_zone3 + h_bath2, w_rear_bath, h_bath1),
            Room("Balcony", "balcony", w_bed2 + w_bed1, L - h_balcony, w_rear_bath, h_balcony),
        ]
        return rooms, "executive_villa_estate_parking_balcony"

    def _generate_parking_balcony_layout(self, W: float, L: float, n_beds: int, n_baths: int, rng: random.Random) -> Tuple[List[Room], str]:
        """3 Bed, 2 Bath + Car Parking Porch + Dining + Balcony (30x50 ft, 1,500 sq ft)."""
        w_park = max(10.0, W * 0.33)
        w_liv = W - w_park
        y_front = 16.0

        y_mid_1 = 10.0
        y_zone2 = y_front + y_mid_1
        w_din = W * 0.4
        w_kit = W * 0.35
        w_bath2 = W - (w_din + w_kit)

        y_mid_2 = 12.0
        y_zone3 = y_zone2 + y_mid_2

        rear_depth = L - y_zone3
        h_balcony = 5.0

        rooms = [
            Room("Parking", "parking", 0.0, 0.0, w_park, y_front),
            Room("Living Room", "living_room", w_park, 0.0, w_liv, y_front),
            Room("Dining Room", "dining_room", 0.0, y_front, w_din, y_mid_1),
            Room("Kitchen", "kitchen", w_din, y_front, w_kit, y_mid_1),
            Room("Bathroom 2", "bathroom", w_din + w_kit, y_front, w_bath2, y_mid_1),
            Room("Bedroom 3", "bedroom", 0.0, y_zone2, W / 2.0, y_mid_2),
            Room("Bedroom 2", "bedroom", W / 2.0, y_zone2, W / 2.0, y_mid_2),
            Room("Bedroom 1", "bedroom", 0.0, y_zone3, W * 0.6, rear_depth),
            Room("Bathroom 1", "bathroom", W * 0.6, y_zone3, W * 0.4, rear_depth - h_balcony),
            Room("Balcony", "balcony", W * 0.6, L - h_balcony, W * 0.4, h_balcony),
        ]
        return rooms, "executive_residence_parking_balcony"

    # --------------------------------------------------------------------------
    # 1 BEDROOM, 1 BATHROOM (Studio / 1-BHK)
    # --------------------------------------------------------------------------
    def _generate_1bed_layout(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        y_split = rng.choice([L * 0.45, L * 0.5])
        w_bed = max(11.0, W * 0.6)
        w_bath = W - w_bed

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, max(12.0, W * 0.6), y_split),
            Room("Kitchen", "kitchen", max(12.0, W * 0.6), 0.0, W - max(12.0, W * 0.6), y_split),
            Room("Bedroom 1", "bedroom", 0.0, y_split, w_bed, L - y_split),
            Room("Bathroom", "bathroom", w_bed, y_split, w_bath, L - y_split),
        ]
        return rooms, "1bed_suite_open_living"

    # --------------------------------------------------------------------------
    # 2 BEDROOMS, 1 BATHROOM (V1 Standard)
    # --------------------------------------------------------------------------
    def _generate_2bed_1bath_layout(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        archetypes = [
            self._archetype_front_living_mid_service_rear_twins,
            self._archetype_front_living_and_kitchen_split_rear_bedrooms,
            self._archetype_front_living_mid_bedrooms_rear_master,
            self._archetype_front_living_garden_kitchen_rear_twins,
            self._archetype_open_concept_front_living_linear_core,
            self._archetype_staggered_private_rear_front_living,
        ]
        func = rng.choice(archetypes)
        return func(W, L, rng)

    def _archetype_front_living_mid_service_rear_twins(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        y_liv = rng.choice([13.0, 14.0, 15.0])
        y_mid_height = rng.choice([10.0, 11.0, 12.0])
        y_mid = y_liv + y_mid_height
        w_k = rng.choice([11.0, 12.0])
        w_bath = W - w_k

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, W, y_liv),
            Room("Kitchen", "kitchen", 0.0, y_liv, w_k, y_mid_height),
            Room("Bathroom", "bathroom", w_k, y_liv, w_bath, y_mid_height),
            Room("Bedroom 1", "bedroom", 0.0, y_mid, W / 2.0, L - y_mid),
            Room("Bedroom 2", "bedroom", W / 2.0, y_mid, W / 2.0, L - y_mid),
        ]
        return rooms, "front_living_mid_service_rear_twins"

    def _archetype_front_living_and_kitchen_split_rear_bedrooms(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        w_liv = rng.choice([11.0, 12.0])
        w_k = W - w_liv
        y_kit = rng.choice([12.0, 13.0])
        y_bath = rng.choice([8.0, 9.0])
        y_rear = y_kit + y_bath

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, w_liv, y_rear),
            Room("Kitchen", "kitchen", w_liv, 0.0, w_k, y_kit),
            Room("Bathroom", "bathroom", w_liv, y_kit, w_k, y_bath),
            Room("Bedroom 1", "bedroom", 0.0, y_rear, W / 2.0, L - y_rear),
            Room("Bedroom 2", "bedroom", W / 2.0, y_rear, W / 2.0, L - y_rear),
        ]
        return rooms, "front_living_and_kitchen_split_rear_bedrooms"

    def _archetype_front_living_mid_bedrooms_rear_master(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        y_liv = rng.choice([13.0, 14.0])
        y_mid_height = rng.choice([12.0, 13.0])
        y_rear_start = y_liv + y_mid_height
        w_bed1 = rng.choice([12.0, 13.0])
        w_bath = W - w_bed1

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, W, y_liv),
            Room("Bedroom 2", "bedroom", 0.0, y_liv, W / 2.0, y_mid_height),
            Room("Kitchen", "kitchen", W / 2.0, y_liv, W / 2.0, y_mid_height),
            Room("Bedroom 1", "bedroom", 0.0, y_rear_start, w_bed1, L - y_rear_start),
            Room("Bathroom", "bathroom", w_bed1, y_rear_start, w_bath, L - y_rear_start),
        ]
        return rooms, "front_living_mid_bedrooms_rear_master"

    def _archetype_front_living_garden_kitchen_rear_twins(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        y_liv = rng.choice([14.0, 15.0])
        y_mid_height = rng.choice([11.0, 12.0])
        y_rear_start = y_liv + y_mid_height
        w_bed2 = rng.choice([11.0, 12.0])
        w_bath = W - w_bed2

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, W, y_liv),
            Room("Bedroom 2", "bedroom", 0.0, y_liv, w_bed2, y_mid_height),
            Room("Bathroom", "bathroom", w_bed2, y_liv, w_bath, y_mid_height),
            Room("Bedroom 1", "bedroom", 0.0, y_rear_start, W / 2.0, L - y_rear_start),
            Room("Kitchen", "kitchen", W / 2.0, y_rear_start, W / 2.0, L - y_rear_start),
        ]
        return rooms, "front_living_garden_kitchen_rear_twins"

    def _archetype_open_concept_front_living_linear_core(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        y_front = rng.choice([13.0, 14.0])
        y_mid_height = rng.choice([12.0, 13.0])
        y_rear_start = y_front + y_mid_height
        w_liv = rng.choice([11.0, 12.0])
        w_k = W - w_liv
        w_bed2 = rng.choice([11.0, 12.0])
        w_bath = W - w_bed2

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, w_liv, y_front),
            Room("Kitchen", "kitchen", w_liv, 0.0, w_k, y_front),
            Room("Bedroom 2", "bedroom", 0.0, y_front, w_bed2, y_mid_height),
            Room("Bathroom", "bathroom", w_bed2, y_front, w_bath, y_mid_height),
            Room("Bedroom 1", "bedroom", 0.0, y_rear_start, W, L - y_rear_start),
        ]
        return rooms, "open_concept_front_living_linear_core"

    def _archetype_staggered_private_rear_front_living(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        y_liv = rng.choice([13.0, 14.0, 15.0])
        y_mid_height = rng.choice([10.0, 11.0])
        y_rear_start = y_liv + y_mid_height

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, W, y_liv),
            Room("Kitchen", "kitchen", 0.0, y_liv, 10.0, y_mid_height),
            Room("Bathroom", "bathroom", 10.0, y_liv, W - 10.0, y_mid_height),
            Room("Bedroom 1", "bedroom", 0.0, y_rear_start, W / 2.0, L - y_rear_start),
            Room("Bedroom 2", "bedroom", W / 2.0, y_rear_start, W / 2.0, L - y_rear_start),
        ]
        return rooms, "staggered_private_rear_front_living"

    # --------------------------------------------------------------------------
    # 2 BEDROOMS, 2 BATHROOMS (Master En-suite + Common Bath)
    # --------------------------------------------------------------------------
    def _generate_2bed_2bath_layout(self, W: float, L: float, rng: random.Random) -> Tuple[List[Room], str]:
        if W < 24.0:
            y_liv = 12.0
            y_mid_h = 10.0
            y_rear_start = y_liv + y_mid_h
            rear_depth = L - y_rear_start

            rooms = [
                Room("Living Room", "living_room", 0.0, 0.0, W, y_liv),
                Room("Kitchen", "kitchen", 0.0, y_liv, W / 2.0, y_mid_h),
                Room("Bathroom 2", "bathroom", W / 2.0, y_liv, W / 2.0, 5.0),
                Room("Bathroom 1", "bathroom", W / 2.0, y_liv + 5.0, W / 2.0, 5.0),
                Room("Bedroom 2", "bedroom", 0.0, y_rear_start, W / 2.0, rear_depth),
                Room("Bedroom 1", "bedroom", W / 2.0, y_rear_start, W / 2.0, rear_depth),
            ]
            return rooms, "2bed_2bath_compact_suite"

        # Front Zone: Living Room & Kitchen
        y_front = rng.choice([13.0, 14.0])
        w_k = max(10.0, W * 0.42)
        w_liv = W - w_k

        # Mid Zone: Common Bathroom 2 (depth 8 ft) & Bedroom 2
        y_bath2_end = y_front + 8.0
        y_rear_start = y_bath2_end

        # Rear Zone: y_rear_start to L (depth at least 18-20 ft)
        rear_depth = L - y_rear_start
        h_bath1 = 7.0
        h_bed1 = rear_depth - h_bath1  # at least 11-13 ft!

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, w_liv, y_front),
            Room("Kitchen", "kitchen", w_liv, 0.0, w_k, y_front),
            Room("Bathroom 2", "bathroom", w_liv, y_front, w_k, 8.0),
            Room("Bedroom 2", "bedroom", 0.0, y_front, w_liv, L - y_front),
            Room("Bathroom 1", "bathroom", w_liv, y_bath2_end, w_k, h_bath1),
            Room("Bedroom 1", "bedroom", w_liv, y_bath2_end + h_bath1, w_k, h_bed1),
        ]
        return rooms, "2bed_2bath_master_suite"

    # --------------------------------------------------------------------------
    # 3 BEDROOMS, 2 BATHROOMS (Family Home)
    # --------------------------------------------------------------------------
    def _generate_3bed_layout(self, W: float, L: float, n_baths: int, rng: random.Random) -> Tuple[List[Room], str]:
        if L < 45.0:
            y_front = 14.0
            y_mid_h = 12.0
            y_rear = y_front + y_mid_h
            rear_h = L - y_rear

            rooms = [
                Room("Living Room", "living_room", 0.0, 0.0, W * 0.55, y_front),
                Room("Kitchen", "kitchen", W * 0.55, 0.0, W * 0.45, y_front),
                Room("Bedroom 3", "bedroom", 0.0, y_front, W * 0.5, y_mid_h),
                Room("Bathroom 2", "bathroom", W * 0.5, y_front, W * 0.25, y_mid_h),
                Room("Bathroom 1", "bathroom", W * 0.75, y_front, W * 0.25, y_mid_h),
                Room("Bedroom 2", "bedroom", 0.0, y_rear, W * 0.5, rear_h),
                Room("Bedroom 1", "bedroom", W * 0.5, y_rear, W * 0.5, rear_h),
            ]
            return rooms, "3bed_2bath_wide_lot_suite"

        y_front = rng.choice([14.0, 15.0, 16.0])
        y_mid_height = rng.choice([12.0, 13.0])
        y_rear_start = y_front + y_mid_height

        w_liv = max(14.0, W * 0.55)
        w_k = W - w_liv

        h_bath1 = 8.0
        h_bed1 = (L - y_rear_start) - h_bath1

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, w_liv, y_front),
            Room("Kitchen", "kitchen", w_liv, 0.0, w_k, y_front),
            Room("Bedroom 3", "bedroom", 0.0, y_front, max(11.0, W * 0.55), y_mid_height),
            Room("Bathroom 2", "bathroom", max(11.0, W * 0.55), y_front, W - max(11.0, W * 0.55), y_mid_height),
            Room("Bedroom 2", "bedroom", 0.0, y_rear_start, W / 2.0, L - y_rear_start),
            Room("Bathroom 1", "bathroom", W / 2.0, y_rear_start, W / 2.0, h_bath1),
            Room("Bedroom 1", "bedroom", W / 2.0, y_rear_start + h_bath1, W / 2.0, h_bed1),
        ]
        return rooms, "3bed_2bath_family_residence"

    # --------------------------------------------------------------------------
    # 4 BEDROOMS, 3 BATHROOMS (Luxury Villa)
    # --------------------------------------------------------------------------
    def _generate_4bed_layout(self, W: float, L: float, n_baths: int, rng: random.Random) -> Tuple[List[Room], str]:
        y_front = 16.0
        y_mid_height = 14.0
        y_rear_start = y_front + y_mid_height

        rooms = [
            Room("Living Room", "living_room", 0.0, 0.0, W * 0.6, y_front),
            Room("Kitchen", "kitchen", W * 0.6, 0.0, W * 0.4, y_front),
            Room("Bedroom 4", "bedroom", 0.0, y_front, W * 0.45, y_mid_height),
            Room("Bathroom 3", "bathroom", W * 0.45, y_front, W * 0.2, y_mid_height),
            Room("Bedroom 3", "bedroom", W * 0.65, y_front, W * 0.35, y_mid_height),
            Room("Bedroom 2", "bedroom", 0.0, y_rear_start, W * 0.4, L - y_rear_start),
            Room("Bathroom 2", "bathroom", W * 0.4, y_rear_start, W * 0.2, 9.0),
            Room("Bathroom 1", "bathroom", W * 0.4, y_rear_start + 9.0, W * 0.2, (L - y_rear_start) - 9.0),
            Room("Bedroom 1", "bedroom", W * 0.6, y_rear_start, W * 0.4, L - y_rear_start),
        ]
        return rooms, "4bed_3bath_luxury_estate"

    # --------------------------------------------------------------------------
    # Helper Transformations & Door Generation
    # --------------------------------------------------------------------------
    def _mirror_horizontal(self, rooms: List[Room], plot_w: float) -> List[Room]:
        """Horizontally mirror all rooms along X axis: new_x = plot_w - (x + width)."""
        mirrored = []
        for r in rooms:
            new_x = round(plot_w - (r.x + r.width), 4)
            mirrored.append(Room(r.name, r.room_type, new_x, r.y, r.width, r.height))
        return mirrored

    def _generate_doors(self, rooms: List[Room], plot_w: float, plot_l: float) -> List[Door]:
        """
        Detect shared walls and place doors connecting rooms.
        The main entrance door is ALWAYS on the front exterior wall (y=0)
        leading directly into the Living Room.
        """
        doors: List[Door] = []
        door_width = self.rules.min_door_width

        # 1. Main Entrance Door
        living = None
        for r in rooms:
            if r.room_type == "living_room" and r.y == 0.0:
                living = r
                break
        if not living:
            for r in rooms:
                if r.room_type == "living_room":
                    living = r
                    break

        if living and living.y == 0.0:
            door_x = living.x + min(2.5, living.width - door_width - 1.0)
            doors.append(
                Door(
                    room_a="Exterior",
                    room_b=living.name,
                    x=door_x,
                    y=0.0,
                    width=3.0,
                    orientation="horizontal",
                    swing_direction="inward",
                )
            )

        # 2. Interior Doors
        connected_rooms = set()
        if living:
            connected_rooms.add(living.name)

        if living:
            for r in rooms:
                if r.name == living.name:
                    continue
                shared = living.shared_wall(r, min_length=door_width + 0.5)
                if shared:
                    orientation, fixed, start, end = shared
                    door_pos = start + 0.5
                    if orientation == "horizontal":
                        doors.append(Door(living.name, r.name, door_pos, fixed, door_width, orientation, "inward"))
                    else:
                        doors.append(Door(living.name, r.name, fixed, door_pos, door_width, orientation, "inward"))
                    connected_rooms.add(r.name)

        # Connect remaining rooms through other shared walls
        for r in rooms:
            if r.name in connected_rooms:
                continue
            for other in rooms:
                if other.name == r.name:
                    continue
                shared = r.shared_wall(other, min_length=door_width + 0.5)
                if shared:
                    orientation, fixed, start, end = shared
                    door_pos = start + 0.5
                    if orientation == "horizontal":
                        doors.append(Door(other.name, r.name, door_pos, fixed, door_width, orientation, "inward"))
                    else:
                        doors.append(Door(other.name, r.name, fixed, door_pos, door_width, orientation, "inward"))
                    connected_rooms.add(r.name)
                    break

        return doors
