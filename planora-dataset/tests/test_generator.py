"""
Unit and Integration Tests for PLANORA Floor-Plan Generator V1
Run via:
    python -m unittest discover -s tests
or
    pytest
"""

import unittest
from pathlib import Path
from generator.rules import FloorPlanRules, DEFAULT_RULES
from generator.layout import LayoutGenerator, generate_requirements, Room, Layout, PRESETS
from generator.validator import validate_layout
from generator.svg_generator import generate_svg


class TestPlanoraRules(unittest.TestCase):
    def setUp(self):
        self.rules = FloorPlanRules()

    def test_bedroom_minimums(self):
        # 10x10 is valid
        valid, msg = self.rules.check_room_dimensions("bedroom", 10.0, 10.0)
        self.assertTrue(valid, msg)

        # 9.5x10 is invalid
        valid, msg = self.rules.check_room_dimensions("bedroom", 9.5, 10.0)
        self.assertFalse(valid)
        self.assertIn("violates minimum requirement", msg)

    def test_kitchen_minimums(self):
        valid, msg = self.rules.check_room_dimensions("kitchen", 8.0, 8.0)
        self.assertTrue(valid, msg)

        valid, msg = self.rules.check_room_dimensions("kitchen", 7.5, 9.0)
        self.assertFalse(valid)

    def test_bathroom_minimums(self):
        # 5x7 is valid
        valid, msg = self.rules.check_room_dimensions("bathroom", 5.0, 7.0)
        self.assertTrue(valid, msg)

        # 7x5 is also valid (orientation flexible)
        valid, msg = self.rules.check_room_dimensions("bathroom", 7.0, 5.0)
        self.assertTrue(valid, msg)

        # 4.5x8 is invalid (one side below 5)
        valid, msg = self.rules.check_room_dimensions("bathroom", 4.5, 8.0)
        self.assertFalse(valid)

    def test_lifestyle_room_minimums(self):
        # Balcony: 8x4 min (32 sq ft)
        valid, msg = self.rules.check_room_dimensions("balcony", 8.0, 4.0)
        self.assertTrue(valid, msg)
        valid, _ = self.rules.check_room_dimensions("balcony", 7.0, 4.0)
        self.assertFalse(valid)

        # Parking: 9x14 min (126 sq ft)
        valid, msg = self.rules.check_room_dimensions("parking", 10.0, 16.0)
        self.assertTrue(valid, msg)
        valid, _ = self.rules.check_room_dimensions("parking", 8.0, 14.0)
        self.assertFalse(valid)

        # Dining: 8x8 min (64 sq ft)
        valid, msg = self.rules.check_room_dimensions("dining_room", 10.0, 12.0)
        self.assertTrue(valid, msg)

        # Utility: 5x5 min (25 sq ft)
        valid, msg = self.rules.check_room_dimensions("utility", 6.0, 6.0)
        self.assertTrue(valid, msg)


class TestPlanoraValidator(unittest.TestCase):
    def setUp(self):
        self.req = generate_requirements("P001", plot_width=20, plot_length=40)
        self.rules = DEFAULT_RULES

    def test_valid_layout(self):
        rooms = [
            Room("Living Room", "living_room", 0, 0, 20, 14),
            Room("Kitchen", "kitchen", 0, 14, 12, 11),
            Room("Bathroom", "bathroom", 12, 14, 8, 11),
            Room("Bedroom 1", "bedroom", 0, 25, 10, 15),
            Room("Bedroom 2", "bedroom", 10, 25, 10, 15),
        ]
        layout = Layout(20, 40, rooms)
        result = validate_layout(layout, self.req, self.rules)
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(len(result["errors"]), 0)

    def test_boundary_error(self):
        rooms = [
            Room("Living Room", "living_room", 0, 0, 21, 14),  # width 21 > 20
            Room("Kitchen", "kitchen", 0, 14, 12, 11),
            Room("Bathroom", "bathroom", 12, 14, 8, 11),
            Room("Bedroom 1", "bedroom", 0, 25, 10, 15),
            Room("Bedroom 2", "bedroom", 10, 25, 10, 15),
        ]
        layout = Layout(20, 40, rooms)
        result = validate_layout(layout, self.req, self.rules)
        self.assertFalse(result["valid"])
        self.assertTrue(any("exceeds plot width" in err for err in result["errors"]))

    def test_overlap_error(self):
        rooms = [
            Room("Living Room", "living_room", 0, 0, 20, 15),
            Room("Kitchen", "kitchen", 0, 14, 12, 11),  # overlaps y=14..15
            Room("Bathroom", "bathroom", 12, 15, 8, 10),
            Room("Bedroom 1", "bedroom", 0, 25, 10, 15),
            Room("Bedroom 2", "bedroom", 10, 25, 10, 15),
        ]
        layout = Layout(20, 40, rooms)
        result = validate_layout(layout, self.req, self.rules)
        self.assertFalse(result["valid"])
        self.assertTrue(any("overlaps with" in err for err in result["errors"]))

    def test_isolated_room_error(self):
        rooms = [
            Room("Living Room", "living_room", 0, 0, 10, 10),
            Room("Kitchen", "kitchen", 0, 10, 10, 10),
            Room("Bathroom", "bathroom", 0, 20, 10, 10),
            Room("Bedroom 1", "bedroom", 0, 30, 10, 10),
            # Bedroom 2 is floating detached at top right with no shared wall
            Room("Bedroom 2", "bedroom", 10, 30, 10, 10),  # touches Bedroom 1 vertically
        ]
        # Now place a room completely disconnected:
        isolated_rooms = [
            Room("Living Room", "living_room", 0, 0, 10, 10),
            Room("Kitchen", "kitchen", 0, 10, 10, 10),
            Room("Bathroom", "bathroom", 0, 20, 10, 10),
            Room("Bedroom 1", "bedroom", 0, 30, 10, 10),
            Room("Bedroom 2", "bedroom", 10, 0, 10, 10),  # touches only Living Room vertically
        ]
        # Make a truly disconnected layout:
        island_rooms = [
            Room("Living Room", "living_room", 0, 0, 10, 10),
            Room("Kitchen", "kitchen", 0, 10, 10, 10),
            Room("Bathroom", "bathroom", 0, 20, 10, 10),
            Room("Bedroom 1", "bedroom", 0, 30, 10, 10),
            # Gap along X: starts at x=15, width=5 -> separated by 5 ft gap!
            Room("Bedroom 2", "bedroom", 15, 0, 5, 10),
        ]
        layout = Layout(20, 40, island_rooms)
        result = validate_layout(layout, self.req, self.rules)
        self.assertFalse(result["valid"])
        self.assertTrue(any("isolated" in err or "disconnected" in err for err in result["errors"]))


class TestPlanoraGenerationAndSVG(unittest.TestCase):
    def test_procedural_generation_and_svg(self):
        req = generate_requirements("P001", 20, 40)
        gen = LayoutGenerator(DEFAULT_RULES)
        layout = gen.generate(req, seed=123)
        res = validate_layout(layout, req, DEFAULT_RULES)
        self.assertTrue(res["valid"])

        svg = generate_svg(layout, "P001")
        self.assertIn("<svg", svg)
        self.assertIn("P001", svg)
        self.assertIn("LIVING ROOM", svg)
        self.assertIn("BEDROOM 1", svg)
        self.assertIn("BEDROOM 2", svg)
        self.assertIn("KITCHEN", svg)
        self.assertIn("BATHROOM", svg)
        self.assertIn("ENTRY", svg)

    def test_all_presets_validity(self):
        """Test that every preset in PRESETS generates a 100% valid layout."""
        gen = LayoutGenerator()
        for preset_name, cfg in PRESETS.items():
            req = generate_requirements(preset_name, **cfg)
            rules = FloorPlanRules(plot_width=cfg["plot_width"], plot_length=cfg["plot_length"])
            layout = gen.generate(req, seed=42)
            res = validate_layout(layout, req, rules)
            self.assertTrue(res["valid"], f"Preset '{preset_name}' failed validation: {res.get('errors')}")

    def test_lifestyle_svg_generation(self):
        """Test that lifestyle layouts generate SVG with proper badges and styling."""
        req = generate_requirements("P_VIP", **PRESETS["3b2b_parking_balcony_30x50"])
        rules = FloorPlanRules(30.0, 50.0)
        layout = LayoutGenerator(rules).generate(req, seed=42)
        svg = generate_svg(layout, "P_VIP")
        self.assertIn("PARKING", svg)
        self.assertIn("DINING", svg)
        self.assertIn("BALCONY", svg)


if __name__ == "__main__":
    unittest.main()
