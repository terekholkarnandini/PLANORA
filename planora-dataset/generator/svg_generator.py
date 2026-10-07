"""
PLANORA SVG Floor-Plan Generator
Renders publication-quality, beautiful 2D vector architectural floor plans.
Optimized for visual excellence, modern web display (React/Next.js),
and clear communication of room zones, dimensions, doors, and specifications.
"""

import math
from typing import Dict, Any, List, Optional, Tuple
from generator.layout import Layout, Room, Door


class SVGFloorPlanGenerator:
    """Generates modern architectural 2D SVG floor plans from Layout objects."""

    def __init__(
        self,
        scale: Optional[float] = None,  # If None, automatically computes optimal scale based on plot size
        margin_left: float = 60.0,
        margin_top: float = 100.0,
        margin_right: float = 60.0,
        margin_bottom: float = 90.0,
    ):
        self.fixed_scale = scale
        self.scale = scale or 24.0
        self.margin_left = margin_left
        self.margin_top = margin_top
        self.margin_right = margin_right
        self.margin_bottom = margin_bottom

        # Room styling palette (clean architectural tints)
        self.room_styles = {
            "bedroom": {
                "fill": "#EEF2FF",      # Soft indigo tint
                "stroke": "#6366F1",    # Indigo border
                "badge_bg": "#E0E7FF",
                "badge_text": "#3730A3",
                "icon": "bed",
            },
            "living_room": {
                "fill": "#FFFBEB",      # Soft warm amber tint
                "stroke": "#F59E0B",    # Amber border
                "badge_bg": "#FEF3C7",
                "badge_text": "#92400E",
                "icon": "living",
            },
            "kitchen": {
                "fill": "#ECFDF5",      # Clean mint/sage tint
                "stroke": "#10B981",    # Emerald border
                "badge_bg": "#D1FAE5",
                "badge_text": "#065F46",
                "icon": "kitchen",
            },
            "bathroom": {
                "fill": "#F0F9FF",      # Light sky blue tint
                "stroke": "#0EA5E9",    # Sky border
                "badge_bg": "#E0F2FE",
                "badge_text": "#0369A1",
                "icon": "bath",
            },
            "balcony": {
                "fill": "#F0FDFA",      # Fresh mint/teal tint
                "stroke": "#14B8A6",    # Teal border
                "badge_bg": "#CCFBF1",
                "badge_text": "#0F766E",
                "icon": "balcony",
            },
            "dining_room": {
                "fill": "#FEF3C7",      # Warm golden tint
                "stroke": "#D97706",    # Amber border
                "badge_bg": "#FDE68A",
                "badge_text": "#B45309",
                "icon": "dining",
            },
            "parking": {
                "fill": "#F1F5F9",      # Slate concrete tint
                "stroke": "#64748B",    # Slate border
                "badge_bg": "#E2E8F0",
                "badge_text": "#334155",
                "icon": "parking",
            },
            "utility": {
                "fill": "#F0FDF4",      # Clean water/wash tint
                "stroke": "#16A34A",    # Green border
                "badge_bg": "#DCFCE7",
                "badge_text": "#15803D",
                "icon": "utility",
            },
            "study_room": {
                "fill": "#F5F3FF",      # Subtle violet tint
                "stroke": "#8B5CF6",    # Violet border
                "badge_bg": "#EDE9FE",
                "badge_text": "#6D28D9",
                "icon": "study",
            },
        }

    def _get_style(self, room_type: str) -> Dict[str, str]:
        key = room_type.lower().replace(" ", "_")
        if key in self.room_styles:
            return self.room_styles[key]
        if "bedroom" in key:
            return self.room_styles["bedroom"]
        if "bath" in key:
            return self.room_styles["bathroom"]
        if "kitchen" in key:
            return self.room_styles["kitchen"]
        if "balcony" in key:
            return self.room_styles["balcony"]
        if "dining" in key:
            return self.room_styles["dining_room"]
        if "parking" in key or "car" in key or "garage" in key:
            return self.room_styles["parking"]
        if "utility" in key or "wash" in key or "laundry" in key:
            return self.room_styles["utility"]
        if "study" in key or "office" in key:
            return self.room_styles["study_room"]
        return self.room_styles["living_room"]

    def _to_svg_coords(self, x: float, y: float, height: float, plot_length: float) -> Tuple[float, float]:
        """
        Converts architectural Cartesian coords (y=0 at front bottom, y=plot_length at rear top)
        to SVG coordinates (SVG y=0 at top).
        """
        svg_x = self.margin_left + (x * self.scale)
        # Flip Y so that y=0 is at the bottom (front) and y=plot_length is at top (rear)
        svg_y = self.margin_top + ((plot_length - (y + height)) * self.scale)
        return svg_x, svg_y

    def generate(self, layout: Layout, plan_id: Optional[str] = None) -> str:
        """Renders a complete SVG string for the given layout."""
        pid = plan_id or layout.requirements_id or "P001"
        plot_w = layout.plot_width
        plot_l = layout.plot_length

        if self.fixed_scale is None:
            self.scale = min(480.0 / plot_w, 960.0 / plot_l)

        plot_pixel_w = plot_w * self.scale
        plot_pixel_h = plot_l * self.scale

        total_width = plot_pixel_w + self.margin_left + self.margin_right
        total_height = plot_pixel_h + self.margin_top + self.margin_bottom

        svg_parts: List[str] = []

        # 1. XML Header and Definitions
        svg_parts.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_width:.0f} {total_height:.0f}" '
            f'width="{total_width:.0f}" height="{total_height:.0f}" '
            f'style="background-color: #FAFAFA; font-family: -apple-system, BlinkMacSystemFont, '
            f'\'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;">'
        )
        svg_parts.append(self._render_defs())

        # 2. Header Title Block
        svg_parts.append(self._render_header(pid, plot_w, plot_l, total_width))

        # 3. Plot Background Grid & Outer Plot Boundary
        plot_svg_x = self.margin_left
        plot_svg_y = self.margin_top
        svg_parts.append(
            f'  <!-- Plot Boundary Background -->\n'
            f'  <rect x="{plot_svg_x}" y="{plot_svg_y}" width="{plot_pixel_w}" height="{plot_pixel_h}" '
            f'fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="4,4" rx="4" />'
        )

        # 4. Rooms (Fills & Interior Walls)
        for room in layout.rooms:
            svg_parts.append(self._render_room(room, plot_l))

        # 5. Room Labels & Icons
        for room in layout.rooms:
            svg_parts.append(self._render_room_labels(room, plot_l))

        # 6. Doors & Door Swings
        for door in layout.doors:
            svg_parts.append(self._render_door(door, plot_l))

        # 7. Exterior Walls (Bold outer shell)
        svg_parts.append(
            f'  <!-- Exterior Plot Frame -->\n'
            f'  <rect x="{plot_svg_x}" y="{plot_svg_y}" width="{plot_pixel_w}" height="{plot_pixel_h}" '
            f'fill="none" stroke="#0F172A" stroke-width="4.5" rx="2" />'
        )

        # 8. Dimensions & Annotations
        svg_parts.append(self._render_dimensions(plot_w, plot_l, plot_svg_x, plot_svg_y, plot_pixel_w, plot_pixel_h))

        # 9. Compass & Scale Bar Footer
        svg_parts.append(self._render_footer(total_width, total_height, plot_pixel_w))

        # Close SVG
        svg_parts.append('</svg>')
        return "\n".join(svg_parts)

    def _render_defs(self) -> str:
        return """  <defs>
    <!-- Drop Shadows -->
    <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.04" />
    </filter>
    <!-- Dimension Arrow Marker -->
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 2 L 10 5 L 0 8 z" fill="#64748B" />
    </marker>
  </defs>"""

    def _render_header(self, plan_id: str, plot_w: float, plot_l: float, total_width: float) -> str:
        area = int(plot_w * plot_l)
        return f"""  <!-- Header Block -->
  <g id="header" transform="translate(0, 0)">
    <!-- Top Accent Bar -->
    <rect x="0" y="0" width="{total_width}" height="5" fill="#2563EB" />
    
    <!-- Title & Brand -->
    <text x="{self.margin_left}" y="38" font-size="16" font-weight="800" letter-spacing="1.5" fill="#0F172A">
      PLANORA <tspan fill="#2563EB">STUDIO</tspan>
    </text>
    <text x="{self.margin_left}" y="56" font-size="11" font-weight="600" letter-spacing="0.5" fill="#64748B">
      RESIDENTIAL ARCHITECTURAL FLOOR PLAN • {plot_w:.0f}' × {plot_l:.0f}' ({area} SQ FT)
    </text>

    <!-- Plan ID Badge -->
    <rect x="{total_width - self.margin_right - 90}" y="22" width="90" height="28" rx="6" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.2" />
    <text x="{total_width - self.margin_right - 45}" y="41" font-size="12" font-weight="700" fill="#1D4ED8" text-anchor="middle">
      {plan_id}
    </text>
    
    <!-- Subtitle specs -->
    <text x="{self.margin_left}" y="80" font-size="11" font-weight="500" fill="#475569">
      Config: <tspan font-weight="700" fill="#0F172A">2 Bed • 1 Bath • Living • Kitchen</tspan> | Type: Compact Urban Row House
    </text>
  </g>"""

    def _render_room(self, room: Room, plot_length: float) -> str:
        svg_x, svg_y = self._to_svg_coords(room.x, room.y, room.height, plot_length)
        w = room.width * self.scale
        h = room.height * self.scale
        style = self._get_style(room.room_type)

        return f"""  <!-- Room: {room.name} -->
  <g id="room_{room.name.lower().replace(' ', '_')}">
    <rect x="{svg_x:.1f}" y="{svg_y:.1f}" width="{w:.1f}" height="{h:.1f}" 
          fill="{style['fill']}" stroke="#1E293B" stroke-width="2.5" />
  </g>"""

    def _render_room_labels(self, room: Room, plot_length: float) -> str:
        svg_x, svg_y = self._to_svg_coords(room.x, room.y, room.height, plot_length)
        w = room.width * self.scale
        h = room.height * self.scale
        center_x = svg_x + (w / 2.0)
        center_y = svg_y + (h / 2.0)
        style = self._get_style(room.room_type)

        area = int(round(room.area))
        dim_str = f"{room.width:.0f}' × {room.height:.0f}'"

        icon_svg = self._get_icon_svg(style["icon"], center_x, center_y - 20)

        return f"""  <!-- Labels for {room.name} -->
  <g id="labels_{room.name.lower().replace(' ', '_')}" pointer-events="none">
    {icon_svg}
    <text x="{center_x:.1f}" y="{center_y + 4:.1f}" font-size="12" font-weight="700" fill="#0F172A" text-anchor="middle" letter-spacing="0.5">
      {room.name.upper()}
    </text>
    <text x="{center_x:.1f}" y="{center_y + 19:.1f}" font-size="10.5" font-weight="600" fill="#475569" text-anchor="middle">
      {dim_str}
    </text>
    <text x="{center_x:.1f}" y="{center_y + 32:.1f}" font-size="9" font-weight="500" fill="#94A3B8" text-anchor="middle">
      ({area} sq ft)
    </text>
  </g>"""

    def _render_door(self, door: Door, plot_length: float) -> str:
        """Render realistic architectural door swing."""
        # Convert door position to SVG
        # For door leaf & swing arc
        door_px = door.width * self.scale

        if door.orientation == "horizontal":
            # Horizontal wall at door.y
            svg_x = self.margin_left + (door.x * self.scale)
            # Wall y coordinate
            svg_y = self.margin_top + ((plot_length - door.y) * self.scale)

            # Check if this is the main entrance (door.y == 0)
            if door.y == 0.0 or door.room_a == "Exterior":
                # Front entry door swing inward (upward in SVG)
                return f"""  <!-- Main Entry Door -->
  <g id="entry_door">
    <!-- Opening gap mask -->
    <line x1="{svg_x:.1f}" y1="{svg_y:.1f}" x2="{svg_x + door_px:.1f}" y2="{svg_y:.1f}" stroke="#FFFFFF" stroke-width="5" />
    <!-- Door Swing Arc (inward/upward) -->
    <path d="M {svg_x:.1f} {svg_y - door_px:.1f} A {door_px:.1f} {door_px:.1f} 0 0 1 {svg_x + door_px:.1f} {svg_y:.1f}" 
          fill="none" stroke="#2563EB" stroke-width="1.2" stroke-dasharray="3,3" />
    <!-- Door Leaf -->
    <line x1="{svg_x:.1f}" y1="{svg_y:.1f}" x2="{svg_x:.1f}" y2="{svg_y - door_px:.1f}" stroke="#0F172A" stroke-width="2.5" />
    <!-- Entry Label & Arrow -->
    <text x="{svg_x + (door_px / 2.0):.1f}" y="{svg_y + 22:.1f}" font-size="9.5" font-weight="800" fill="#2563EB" text-anchor="middle">▲ ENTRY</text>
  </g>"""
            else:
                # Interior horizontal door
                return f"""  <!-- Interior Door ({door.room_a} -> {door.room_b}) -->
  <g>
    <!-- Wall opening -->
    <line x1="{svg_x:.1f}" y1="{svg_y:.1f}" x2="{svg_x + door_px:.1f}" y2="{svg_y:.1f}" stroke="#FFFFFF" stroke-width="4" />
    <!-- Door Swing Arc -->
    <path d="M {svg_x:.1f} {svg_y - door_px:.1f} A {door_px:.1f} {door_px:.1f} 0 0 1 {svg_x + door_px:.1f} {svg_y:.1f}" 
          fill="none" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="2.5,2.5" />
    <!-- Door Leaf -->
    <line x1="{svg_x:.1f}" y1="{svg_y:.1f}" x2="{svg_x:.1f}" y2="{svg_y - door_px:.1f}" stroke="#1E293B" stroke-width="2.2" />
  </g>"""
        else:
            # Vertical wall at door.x
            svg_x = self.margin_left + (door.x * self.scale)
            # Wall y in SVG (top of door)
            svg_y = self.margin_top + ((plot_length - (door.y + door.width)) * self.scale)

            return f"""  <!-- Interior Door Vertical ({door.room_a} -> {door.room_b}) -->
  <g>
    <!-- Wall opening -->
    <line x1="{svg_x:.1f}" y1="{svg_y:.1f}" x2="{svg_x:.1f}" y2="{svg_y + door_px:.1f}" stroke="#FFFFFF" stroke-width="4" />
    <!-- Door Swing Arc -->
    <path d="M {svg_x + door_px:.1f} {svg_y:.1f} A {door_px:.1f} {door_px:.1f} 0 0 1 {svg_x:.1f} {svg_y + door_px:.1f}" 
          fill="none" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="2.5,2.5" />
    <!-- Door Leaf -->
    <line x1="{svg_x:.1f}" y1="{svg_y:.1f}" x2="{svg_x + door_px:.1f}" y2="{svg_y:.1f}" stroke="#1E293B" stroke-width="2.2" />
  </g>"""

    def _render_dimensions(
        self,
        plot_w: float,
        plot_l: float,
        x: float,
        y: float,
        w: float,
        h: float,
    ) -> str:
        """Render outer dimension leader lines and text."""
        dim_offset = 18.0
        return f"""  <!-- Dimension Annotations -->
  <g id="dimensions" stroke="#64748B" stroke-width="1" fill="#64748B" font-size="10" font-weight="600">
    <!-- Top Width Dimension: 20'-0" -->
    <line x1="{x}" y1="{y - dim_offset}" x2="{x + w}" y2="{y - dim_offset}" marker-start="url(#arrow)" marker-end="url(#arrow)" />
    <line x1="{x}" y1="{y - 5}" x2="{x}" y2="{y - dim_offset - 4}" stroke="#94A3B8" stroke-dasharray="2,2" />
    <line x1="{x + w}" y1="{y - 5}" x2="{x + w}" y2="{y - dim_offset - 4}" stroke="#94A3B8" stroke-dasharray="2,2" />
    <text x="{x + (w / 2.0)}" y="{y - dim_offset - 6}" text-anchor="middle" stroke="none" fill="#334155">{plot_w:.0f}'-0" (WIDTH)</text>

    <!-- Left Length Dimension: 40'-0" -->
    <line x1="{x - dim_offset}" y1="{y}" x2="{x - dim_offset}" y2="{y + h}" marker-start="url(#arrow)" marker-end="url(#arrow)" />
    <line x1="{x - 5}" y1="{y}" x2="{x - dim_offset - 4}" y2="{y}" stroke="#94A3B8" stroke-dasharray="2,2" />
    <line x1="{x - 5}" y1="{y + h}" x2="{x - dim_offset - 4}" y2="{y + h}" stroke="#94A3B8" stroke-dasharray="2,2" />
    <text x="{x - dim_offset - 8}" y="{y + (h / 2.0)}" text-anchor="middle" transform="rotate(-90, {x - dim_offset - 8}, {y + (h / 2.0)})" stroke="none" fill="#334155">
      {plot_l:.0f}'-0" (LENGTH)
    </text>
  </g>"""

    def _render_footer(self, total_width: float, total_height: float, plot_w_px: float) -> str:
        """Render scale bar, North indicator, and footer badge."""
        footer_y = total_height - 35
        return f"""  <!-- Footer & Scale Bar -->
  <g id="footer" transform="translate(0, 0)">
    <!-- Scale Bar (10 ft) -->
    <g transform="translate({self.margin_left}, {footer_y})">
      <text x="0" y="-8" font-size="9" font-weight="600" fill="#64748B">SCALE: 1/4" = 1'-0"</text>
      <!-- 0 to 10 ft bar -->
      <rect x="0" y="0" width="{5 * self.scale}" height="4" fill="#0F172A" />
      <rect x="{5 * self.scale}" y="0" width="{5 * self.scale}" height="4" fill="#94A3B8" />
      <text x="0" y="14" font-size="8" fill="#64748B">0</text>
      <text x="{5 * self.scale}" y="14" font-size="8" fill="#64748B" text-anchor="middle">5'</text>
      <text x="{10 * self.scale}" y="14" font-size="8" fill="#64748B" text-anchor="end">10 FT</text>
    </g>

    <!-- North Arrow -->
    <g transform="translate({total_width - self.margin_right - 40}, {footer_y - 8})">
      <circle cx="15" cy="15" r="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.2" />
      <polygon points="15,4 19,16 15,13" fill="#EF4444" />
      <polygon points="15,4 11,16 15,13" fill="#94A3B8" />
      <text x="15" y="-1" font-size="9" font-weight="800" fill="#EF4444" text-anchor="middle">N</text>
    </g>

    <!-- Synthetic Dataset Tag -->
    <text x="{total_width / 2.0}" y="{total_height - 15}" font-size="8.5" font-weight="500" fill="#94A3B8" text-anchor="middle">
      PLANORA Synthetic Dataset Generator V1 • Research & Prototyping
    </text>
  </g>"""

    def _get_icon_svg(self, icon_type: str, cx: float, cy: float) -> str:
        """Render small architectural icon for room classification."""
        if icon_type == "bed":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <rect x="2" y="2" width="16" height="14" rx="2" fill="none" stroke="#3730A3" stroke-width="1.3" />
              <rect x="4" y="4" width="5" height="4" rx="1" fill="#3730A3" />
              <rect x="11" y="4" width="5" height="4" rx="1" fill="#3730A3" />
              <line x1="2" y1="10" x2="18" y2="10" stroke="#3730A3" stroke-width="1.2" />
            </g>"""
        elif icon_type == "kitchen":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <rect x="2" y="3" width="16" height="12" rx="1.5" fill="none" stroke="#065F46" stroke-width="1.3" />
              <circle cx="6.5" cy="9" r="2" fill="none" stroke="#065F46" stroke-width="1" />
              <circle cx="13.5" cy="9" r="2" fill="none" stroke="#065F46" stroke-width="1" />
            </g>"""
        elif icon_type == "bath":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <path d="M 3 9 C 3 14 17 14 17 9 L 17 6 L 3 6 Z" fill="none" stroke="#0369A1" stroke-width="1.3" />
              <path d="M 5 6 L 5 3 C 5 2 7 2 7 3" fill="none" stroke="#0369A1" stroke-width="1.2" />
            </g>"""
        elif icon_type == "balcony":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <rect x="2" y="4" width="16" height="10" rx="1" fill="none" stroke="#0F766E" stroke-width="1.3" />
              <line x1="6" y1="4" x2="6" y2="14" stroke="#0F766E" stroke-width="1" />
              <line x1="10" y1="4" x2="10" y2="14" stroke="#0F766E" stroke-width="1" />
              <line x1="14" y1="4" x2="14" y2="14" stroke="#0F766E" stroke-width="1" />
            </g>"""
        elif icon_type == "dining":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <circle cx="10" cy="9" r="5" fill="none" stroke="#B45309" stroke-width="1.3" />
              <circle cx="10" cy="2" r="1.5" fill="#B45309" />
              <circle cx="10" cy="16" r="1.5" fill="#B45309" />
              <circle cx="3" cy="9" r="1.5" fill="#B45309" />
              <circle cx="17" cy="9" r="1.5" fill="#B45309" />
            </g>"""
        elif icon_type == "parking":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <rect x="3" y="2" width="14" height="14" rx="2" fill="none" stroke="#334155" stroke-width="1.3" />
              <text x="10" y="13" font-size="11" font-weight="800" fill="#334155" text-anchor="middle">P</text>
            </g>"""
        elif icon_type == "utility":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <rect x="3" y="3" width="14" height="13" rx="1.5" fill="none" stroke="#15803D" stroke-width="1.3" />
              <circle cx="10" cy="9.5" r="3.5" fill="none" stroke="#15803D" stroke-width="1" />
              <circle cx="6" cy="5.5" r="1" fill="#15803D" />
            </g>"""
        elif icon_type == "study":
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <rect x="2" y="3" width="16" height="10" rx="1" fill="none" stroke="#6D28D9" stroke-width="1.3" />
              <line x1="2" y1="10" x2="18" y2="10" stroke="#6D28D9" stroke-width="1.2" />
              <line x1="10" y1="10" x2="10" y2="14" stroke="#6D28D9" stroke-width="1.2" />
            </g>"""
        else:  # living
            return f"""<g transform="translate({cx - 10:.1f}, {cy:.1f})" opacity="0.45">
              <rect x="2" y="6" width="16" height="8" rx="2" fill="none" stroke="#92400E" stroke-width="1.3" />
              <rect x="4" y="2" width="12" height="5" rx="1" fill="none" stroke="#92400E" stroke-width="1" />
            </g>"""


def generate_svg(layout: Layout, plan_id: Optional[str] = None) -> str:
    """Helper wrapper function to generate SVG string from layout."""
    generator = SVGFloorPlanGenerator()
    return generator.generate(layout, plan_id)
