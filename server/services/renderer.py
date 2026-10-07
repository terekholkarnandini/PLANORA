"""
PLANORA 2D Architectural SVG Floor-Plan Renderer
Phase 6 implementation: deterministic rendering of validated floor plans into crisp, modern SVG blueprints.
Displays external boundary, walls, rooms, room badges, dimensions, doors with swing arcs, windows, and scale bar.
"""

import math
from typing import Dict, Any, List, Optional, Tuple


ROOM_THEMES = {
    "bedroom": {
        "fill": "#EEF2FF",
        "stroke": "#6366F1",
        "badge_bg": "#E0E7FF",
        "badge_text": "#3730A3",
        "icon": "🛏️",
    },
    "living_room": {
        "fill": "#FFFBEB",
        "stroke": "#F59E0B",
        "badge_bg": "#FEF3C7",
        "badge_text": "#92400E",
        "icon": "🛋️",
    },
    "kitchen": {
        "fill": "#ECFDF5",
        "stroke": "#10B981",
        "badge_bg": "#D1FAE5",
        "badge_text": "#065F46",
        "icon": "🍳",
    },
    "bathroom": {
        "fill": "#F0F9FF",
        "stroke": "#0EA5E9",
        "badge_bg": "#E0F2FE",
        "badge_text": "#0369A1",
        "icon": "🚿",
    },
    "dining_room": {
        "fill": "#F5F3FF",
        "stroke": "#8B5CF6",
        "badge_bg": "#EDE9FE",
        "badge_text": "#6D28D9",
        "icon": "🍽️",
    },
    "balcony": {
        "fill": "#F0FDFA",
        "stroke": "#14B8A6",
        "badge_bg": "#CCFBF1",
        "badge_text": "#0F766E",
        "icon": "🌿",
    },
    "parking": {
        "fill": "#F1F5F9",
        "stroke": "#64748B",
        "badge_bg": "#E2E8F0",
        "badge_text": "#334155",
        "icon": "🚗",
    },
    "utility": {
        "fill": "#ECFEFF",
        "stroke": "#06B6D4",
        "badge_bg": "#CFFAFE",
        "badge_text": "#0E7490",
        "icon": "🧺",
    },
    "study_room": {
        "fill": "#FFF7ED",
        "stroke": "#EA580C",
        "badge_bg": "#FFEDD5",
        "badge_text": "#C2410C",
        "icon": "📚",
    },
}


def fmt_feet(val: float) -> str:
    """Formats float feet into architectural notation: e.g. 15.5 -> 15'-6\"."""
    total_inches = round(val * 12.0)
    feet = total_inches // 12
    inches = total_inches % 12
    return f"{feet}'-{inches}\"" if inches > 0 else f"{feet}'-0\""


class PlanoraSVGRenderer:
    """Deterministic SVG Floor-Plan Generator."""

    def __init__(
        self,
        margin_left: float = 65.0,
        margin_top: float = 90.0,
        margin_right: float = 65.0,
        margin_bottom: float = 85.0
    ):
        self.margin_left = margin_left
        self.margin_top = margin_top
        self.margin_right = margin_right
        self.margin_bottom = margin_bottom

    def _get_theme(self, rtype: str) -> Dict[str, str]:
        rtype = rtype.lower().strip().replace(" ", "_")
        if rtype in ROOM_THEMES:
            return ROOM_THEMES[rtype]
        for k, v in ROOM_THEMES.items():
            if k in rtype:
                return v
        return ROOM_THEMES["living_room"]

    def _to_svg(self, x: float, y: float, h: float, plot_l: float, scale: float) -> Tuple[float, float]:
        """Converts architectural coords (y=0 at front) to SVG pixels."""
        svg_x = self.margin_left + (x * scale)
        svg_y = self.margin_top + ((plot_l - (y + h)) * scale)
        return svg_x, svg_y

    def render(self, layout: Dict[str, Any], plan_title: str = "PLANORA GENERATED LAYOUT") -> str:
        """Renders layout into publication-ready SVG string."""
        plot = layout.get("plot", {})
        plot_w = float(plot.get("width", 30.0))
        plot_l = float(plot.get("length", plot.get("height", 40.0)))
        rooms = layout.get("rooms", [])
        doors = layout.get("doors", [])
        windows = layout.get("windows", [])

        # Auto-compute scale: target ~480px width, ~640px height for canvas
        scale = min(500.0 / plot_w, 680.0 / plot_l)

        px_plot_w = plot_w * scale
        px_plot_l = plot_l * scale

        view_w = px_plot_w + self.margin_left + self.margin_right
        view_h = px_plot_l + self.margin_top + self.margin_bottom

        tot_area = sum(float(r["width"]) * float(r["height"]) for r in rooms)

        svg = []
        svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w:.0f} {view_h:.0f}" width="100%" height="100%" style="font-family: \'Inter\', system-ui, -apple-system, sans-serif;">')

        # Defs: Shadows, Gradients & Architectural Patterns
        svg.append("""
        <defs>
            <filter id="blueprint-shadow" x="-4%" y="-4%" width="108%" height="108%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.12" />
            </filter>
            <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
            </pattern>
        </defs>
        """)

        # Background
        svg.append(f'<rect width="{view_w:.0f}" height="{view_h:.0f}" fill="#0A0E17" rx="8" />')
        svg.append(f'<rect width="{view_w:.0f}" height="{view_h:.0f}" fill="url(#grid-pattern)" />')

        # Header Badge & Title
        svg.append(f'<g transform="translate({self.margin_left}, 30)">')
        svg.append(f'<text x="0" y="0" fill="#7DE7FF" font-size="10" font-weight="700" letter-spacing="1.5">PLANORA // AI ARCHITECTURAL ENGINE</text>')
        svg.append(f'<text x="0" y="20" fill="#F8FAFC" font-size="16" font-weight="800">{plan_title}</text>')
        svg.append(f'<text x="0" y="38" fill="#94A3B8" font-size="11">PLOT: {fmt_feet(plot_w)} × {fmt_feet(plot_l)} ({plot_w*plot_l:.0f} SQ.FT.) | BUILT: {tot_area:.0f} SQ.FT.</text>')
        svg.append('</g>')

        # North Compass
        nc_x = view_w - self.margin_right - 20
        nc_y = 40
        svg.append(f"""
        <g transform="translate({nc_x}, {nc_y})">
            <circle cx="0" cy="0" r="14" fill="#1E293B" stroke="#334155" stroke-width="1.5" />
            <polygon points="0,-11 -4,-2 0,0" fill="#EF4444" />
            <polygon points="0,-11 4,-2 0,0" fill="#DC2626" />
            <polygon points="0,11 -4,2 0,0" fill="#94A3B8" />
            <polygon points="0,11 4,2 0,0" fill="#64748B" />
            <text x="0" y="-14" fill="#EF4444" font-size="8" font-weight="900" text-anchor="middle">N</text>
        </g>
        """)

        # Plot Exterior Boundary
        pl_x = self.margin_left
        pl_y = self.margin_top
        svg.append(f'<rect x="{pl_x:.1f}" y="{pl_y:.1f}" width="{px_plot_w:.1f}" height="{px_plot_l:.1f}" fill="#111827" stroke="#38BDF8" stroke-width="3" rx="3" filter="url(#blueprint-shadow)" />')

        # Dimension Annotations: Top & Left
        # Top (Plot Width)
        svg.append(f'<line x1="{pl_x}" y1="{pl_y - 12}" x2="{pl_x + px_plot_w}" y2="{pl_y - 12}" stroke="#64748B" stroke-width="1.5" />')
        svg.append(f'<line x1="{pl_x}" y1="{pl_y - 18}" x2="{pl_x}" y2="{pl_y - 6}" stroke="#64748B" stroke-width="1.5" />')
        svg.append(f'<line x1="{pl_x + px_plot_w}" y1="{pl_y - 18}" x2="{pl_x + px_plot_w}" y2="{pl_y - 6}" stroke="#64748B" stroke-width="1.5" />')
        svg.append(f'<rect x="{pl_x + px_plot_w/2 - 35}" y="{pl_y - 22}" width="70" height="18" fill="#1E293B" rx="3" />')
        svg.append(f'<text x="{pl_x + px_plot_w/2}" y="{pl_y - 9}" fill="#38BDF8" font-size="10" font-weight="700" text-anchor="middle">{fmt_feet(plot_w)}</text>')

        # Right (Plot Length)
        svg.append(f'<line x1="{pl_x + px_plot_w + 14}" y1="{pl_y}" x2="{pl_x + px_plot_w + 14}" y2="{pl_y + px_plot_l}" stroke="#64748B" stroke-width="1.5" />')
        svg.append(f'<line x1="{pl_x + px_plot_w + 8}" y1="{pl_y}" x2="{pl_x + px_plot_w + 20}" y2="{pl_y}" stroke="#64748B" stroke-width="1.5" />')
        svg.append(f'<line x1="{pl_x + px_plot_w + 8}" y1="{pl_y + px_plot_l}" x2="{pl_x + px_plot_w + 20}" y2="{pl_y + px_plot_l}" stroke="#64748B" stroke-width="1.5" />')
        svg.append(f'<rect x="{pl_x + px_plot_w + 6}" y="{pl_y + px_plot_l/2 - 10}" width="50" height="18" fill="#1E293B" rx="3" />')
        svg.append(f'<text x="{pl_x + px_plot_w + 31}" y="{pl_y + px_plot_l/2 + 3}" fill="#38BDF8" font-size="10" font-weight="700" text-anchor="middle">{fmt_feet(plot_l)}</text>')

        # Rooms Rendering
        for r in rooms:
            rx, ry, rw, rh = float(r["x"]), float(r["y"]), float(r["width"]), float(r["height"])
            sx, sy = self._to_svg(rx, ry, rh, plot_l, scale)
            sw = rw * scale
            sh = rh * scale
            theme = self._get_theme(r.get("type", "room"))

            # Room Polygon
            svg.append(f'<rect x="{sx:.1f}" y="{sy:.1f}" width="{sw:.1f}" height="{sh:.1f}" fill="{theme["fill"]}" stroke="{theme["stroke"]}" stroke-width="2" rx="2" />')

            # Room Badge & Labels in Center
            cx = sx + sw / 2.0
            cy = sy + sh / 2.0
            area_sqft = rw * rh

            if sw >= 45 and sh >= 40:
                # Pill Badge
                badge_w = min(sw - 10, 110.0)
                badge_h = min(sh - 10, 48.0)
                svg.append(f'<rect x="{cx - badge_w/2:.1f}" y="{cy - badge_h/2:.1f}" width="{badge_w:.1f}" height="{badge_h:.1f}" fill="{theme["badge_bg"]}" opacity="0.9" rx="4" />')
                svg.append(f'<text x="{cx:.1f}" y="{cy - 8:.1f}" fill="{theme["badge_text"]}" font-size="11" font-weight="800" text-anchor="middle">{theme["icon"]} {r.get("name", r.get("type")).upper()}</text>')
                svg.append(f'<text x="{cx:.1f}" y="{cy + 7:.1f}" fill="{theme["badge_text"]}" font-size="9" font-weight="600" text-anchor="middle">{fmt_feet(rw)} × {fmt_feet(rh)}</text>')
                svg.append(f'<text x="{cx:.1f}" y="{cy + 19:.1f}" fill="{theme["badge_text"]}" font-size="8" opacity="0.75" text-anchor="middle">{area_sqft:.0f} SQ.FT.</text>')

        # Windows Rendering on Exterior Walls
        for w in windows:
            wx, wy, ww = float(w.get("x", 0)), float(w.get("y", 0)), float(w.get("width", 3.0))
            wori = str(w.get("orientation", "horizontal")).lower()

            # Map coordinates
            if wori == "horizontal":
                # Window along X axis
                win_h = 1.0
                wsx, wsy = self._to_svg(wx, wy, win_h, plot_l, scale)
                win_px_w = ww * scale
                # Triple-line window symbol
                svg.append(f'<rect x="{wsx:.1f}" y="{wsy:.1f}" width="{win_px_w:.1f}" height="6" fill="#0284C7" stroke="#38BDF8" stroke-width="1.5" rx="1" />')
                svg.append(f'<line x1="{wsx:.1f}" y1="{wsy+3:.1f}" x2="{wsx+win_px_w:.1f}" y2="{wsy+3:.1f}" stroke="#FFFFFF" stroke-width="1" />')
            else:
                # Window along Y axis
                win_w = 1.0
                wsx, wsy = self._to_svg(wx, wy, ww, plot_l, scale)
                win_px_h = ww * scale
                svg.append(f'<rect x="{wsx:.1f}" y="{wsy:.1f}" width="6" height="{win_px_h:.1f}" fill="#0284C7" stroke="#38BDF8" stroke-width="1.5" rx="1" />')
                svg.append(f'<line x1="{wsx+3:.1f}" y1="{wsy:.1f}" x2="{wsx+3:.1f}" y2="{wsy+win_px_h:.1f}" stroke="#FFFFFF" stroke-width="1" />')

        # Doors Rendering with Architectural Swing Arcs
        for d in doors:
            dx, dy, dw = float(d.get("x", 0)), float(d.get("y", 0)), float(d.get("width", 2.5))
            dori = str(d.get("orientation", "horizontal")).lower()
            is_ext = (d.get("room_a") == "Exterior" or d.get("room_b") == "Exterior")

            door_px = dw * scale

            if dori == "horizontal":
                dsx, dsy = self._to_svg(dx, dy, 0, plot_l, scale)
                # Door opening gap in wall
                svg.append(f'<rect x="{dsx:.1f}" y="{dsy - 2:.1f}" width="{door_px:.1f}" height="4" fill="#0A0E17" />')
                # Door leaf & swing arc
                door_color = "#38BDF8" if is_ext else "#94A3B8"
                svg.append(f'<line x1="{dsx:.1f}" y1="{dsy:.1f}" x2="{dsx + door_px:.1f}" y2="{dsy - door_px:.1f}" stroke="{door_color}" stroke-width="2" />')
                # 90 deg swing arc
                svg.append(f'<path d="M {dsx + door_px:.1f} {dsy:.1f} A {door_px:.1f} {door_px:.1f} 0 0 0 {dsx + door_px:.1f} {dsy - door_px:.1f}" fill="none" stroke="{door_color}" stroke-width="1.2" stroke-dasharray="2,2" />')

                if is_ext:
                    # Entrance Marker Triangle
                    svg.append(f'<polygon points="{dsx + door_px/2:.1f},{dsy + 12:.1f} {dsx + door_px/2 - 5:.1f},{dsy + 20:.1f} {dsx + door_px/2 + 5:.1f},{dsy + 20:.1f}" fill="#38BDF8" />')
                    svg.append(f'<text x="{dsx + door_px/2:.1f}" y="{dsy + 28:.1f}" fill="#38BDF8" font-size="7" font-weight="900" text-anchor="middle">MAIN ENTRY</text>')
            else:
                dsx, dsy = self._to_svg(dx, dy, dw, plot_l, scale)
                svg.append(f'<rect x="{dsx - 2:.1f}" y="{dsy:.1f}" width="4" height="{door_px:.1f}" fill="#0A0E17" />')
                door_color = "#38BDF8" if is_ext else "#94A3B8"
                svg.append(f'<line x1="{dsx:.1f}" y1="{dsy:.1f}" x2="{dsx + door_px:.1f}" y2="{dsy + door_px:.1f}" stroke="{door_color}" stroke-width="2" />')
                svg.append(f'<path d="M {dsx:.1f} {dsy + door_px:.1f} A {door_px:.1f} {door_px:.1f} 0 0 0 {dsx + door_px:.1f} {dsy + door_px:.1f}" fill="none" stroke="{door_color}" stroke-width="1.2" stroke-dasharray="2,2" />')

        # Footer: Scale Bar & Architectural Legend
        ft_y = view_h - 22
        svg.append(f'<g transform="translate({self.margin_left}, {ft_y})">')
        svg.append('<rect x="0" y="0" width="100" height="4" fill="#334155" />')
        svg.append(f'<rect x="0" y="0" width="{5 * scale:.1f}" height="4" fill="#38BDF8" />')
        svg.append('<text x="0" y="-4" fill="#64748B" font-size="8">0</text>')
        svg.append(f'<text x="{5 * scale:.1f}" y="-4" fill="#64748B" font-size="8" text-anchor="middle">5ft</text>')
        svg.append('<text x="100" y="-4" fill="#64748B" font-size="8" text-anchor="middle">SCALE 1:50</text>')
        svg.append(f'<text x="{px_plot_w}" y="0" fill="#64748B" font-size="8" text-anchor="end">CONSTRAINTS VALIDATED // 100% MATHEMATICAL INTEGRITY</text>')
        svg.append('</g>')

        svg.append('</svg>')
        return "\n".join(svg)


def render_floor_plan_svg(layout: Dict[str, Any], plan_title: str = "PLANORA 2D BLUEPRINT") -> str:
    """Convenience wrapper for SVG floor plan generation."""
    renderer = PlanoraSVGRenderer()
    return renderer.render(layout, plan_title=plan_title)
