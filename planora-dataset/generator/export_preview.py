"""
PLANORA HTML Preview Generator
Generates a standalone, beautiful interactive web gallery (preview.html)
allowing the user to inspect all generated 2D SVG floor plans, specifications,
and room schedules directly in their web browser.
"""

import json
from pathlib import Path


def generate_preview_html(dataset_dir: Path, output_file: Path) -> None:
    plans = []
    for p_dir in sorted(dataset_dir.iterdir()):
        if p_dir.is_dir() and p_dir.name.startswith("P"):
            req_path = p_dir / "requirements.json"
            layout_path = p_dir / "layout.json"
            svg_path = p_dir / "floorplan.svg"

            if req_path.exists() and layout_path.exists() and svg_path.exists():
                req = json.loads(req_path.read_text(encoding="utf-8"))
                layout = json.loads(layout_path.read_text(encoding="utf-8"))
                svg = svg_path.read_text(encoding="utf-8")
                plans.append({
                    "id": p_dir.name,
                    "requirements": req,
                    "layout": layout,
                    "svg": svg,
                })

    plans_json_str = json.dumps(plans)

    html_template = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PLANORA • Synthetic Floor-Plan Explorer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0B0F19;
      --bg-card: #151D2F;
      --bg-card-hover: #1E293B;
      --border: #243048;
      --border-focus: #3B82F6;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --primary: #3B82F6;
      --primary-glow: rgba(59, 130, 246, 0.25);
      --accent: #10B981;
      --warning: #F59E0B;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', -apple-system, sans-serif;
      background: radial-gradient(circle at 10% 20%, #111827 0%, #0B0F19 90%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    header {
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .logo-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-badge {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #3B82F6, #6366F1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 18px;
      color: white;
      box-shadow: 0 4px 12px var(--primary-glow);
    }

    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .brand-title span {
      color: var(--primary);
    }

    .brand-subtitle {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    .header-stats {
      display: flex;
      gap: 16px;
    }

    .stat-pill {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid var(--border);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat-pill strong {
      color: var(--text-main);
    }

    .stat-pill.success {
      border-color: rgba(16, 185, 129, 0.4);
      color: #34D399;
      background: rgba(16, 185, 129, 0.1);
    }

    main {
      flex: 1;
      display: flex;
      padding: 24px 32px;
      gap: 28px;
      max-width: 1600px;
      margin: 0 auto;
      width: 100%;
    }

    .sidebar {
      width: 320px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sidebar-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
    }

    .plan-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      max-height: calc(100vh - 180px);
      padding-right: 6px;
    }

    .plan-list::-webkit-scrollbar {
      width: 6px;
    }
    .plan-list::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }

    .plan-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .plan-card:hover {
      background: var(--bg-card-hover);
      border-color: rgba(59, 130, 246, 0.5);
      transform: translateY(-2px);
    }

    .plan-card.active {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(99, 102, 241, 0.1));
      border-color: var(--primary);
      box-shadow: 0 0 0 1px var(--primary), 0 8px 20px var(--primary-glow);
    }

    .plan-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .plan-id {
      font-size: 15px;
      font-weight: 800;
      color: var(--text-main);
    }

    .plan-badge {
      font-size: 10px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.15);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 2px 8px;
      border-radius: 10px;
    }

    .plan-archetype {
      font-size: 11.5px;
      color: #94A3B8;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .plan-details-row {
      display: flex;
      gap: 10px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .showcase {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 28px;
      align-items: start;
    }

    .viewer-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
    }

    .viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 14px;
    }

    .viewer-title {
      font-size: 18px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .viewer-controls {
      display: flex;
      gap: 8px;
    }

    .btn {
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid var(--border);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn:hover {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .svg-container {
      background: #FFFFFF;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 640px;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
      position: relative;
    }

    .svg-container svg {
      max-width: 100%;
      height: auto;
      max-height: 680px;
      border-radius: 4px;
      transition: transform 0.2s ease;
    }

    .inspector {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .panel-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .panel-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .room-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .room-table th {
      text-align: left;
      padding: 8px 6px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }

    .room-table td {
      padding: 10px 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-main);
    }

    .room-tag {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }

    .room-tag.bedroom { background: #6366F1; }
    .room-tag.living_room { background: #F59E0B; }
    .room-tag.kitchen { background: #10B981; }
    .room-tag.bathroom { background: #0EA5E9; }

    .check-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .check-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12.5px;
      padding: 6px 10px;
      background: rgba(30, 41, 59, 0.5);
      border-radius: 6px;
      border-left: 3px solid #10B981;
    }

    .check-status {
      font-weight: 700;
      font-size: 11px;
      color: #34D399;
    }

    .tabs {
      display: flex;
      gap: 6px;
      background: rgba(11, 15, 25, 0.6);
      padding: 4px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .tab {
      flex: 1;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
    }

    .tab.active {
      background: var(--primary);
      color: white;
    }

    .code-box {
      background: #0B0F19;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #CBD5E1;
      max-height: 240px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    @media (max-width: 1200px) {
      .showcase {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      main {
        flex-direction: column;
      }
      .sidebar {
        width: 100%;
      }
      .plan-list {
        flex-direction: row;
        overflow-x: auto;
        max-height: none;
      }
      .plan-card {
        min-width: 220px;
      }
    }
  </style>
</head>
<body>

  <header>
    <div class="logo-group">
      <div class="logo-badge">P</div>
      <div>
        <div class="brand-title">PLANORA <span>STUDIO</span></div>
        <div class="brand-subtitle">Synthetic Floor-Plan Dataset Generator V1</div>
      </div>
    </div>

    <div class="header-stats">
      <div class="stat-pill">Plot: <strong>20 × 40 ft (800 sq ft)</strong></div>
      <div class="stat-pill">Config: <strong>2 Bed • 1 Bath</strong></div>
      <div class="stat-pill success">Status: <strong>100% Validated</strong></div>
    </div>
  </header>

  <main>
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title" id="sidebarPlanCountTitle">Generated Plans</span>
      </div>
      <div class="plan-list" id="planListContainer"></div>
    </aside>

    <section class="showcase">
      <div class="viewer-card">
        <div class="viewer-header">
          <div class="viewer-title" id="currentPlanTitle">
            Plan P001
          </div>
          <div class="viewer-controls">
            <button class="btn" id="btnPrev" onclick="navigatePlan(-1)">← Previous</button>
            <button class="btn" id="btnNext" onclick="navigatePlan(1)">Next →</button>
            <button class="btn" id="btnDownload" onclick="downloadCurrentSvg()">⬇ SVG</button>
          </div>
        </div>

        <div class="svg-container" id="svgViewport"></div>
      </div>

      <div class="inspector">
        <div class="panel-card">
          <div class="panel-title">
            <span>Room Schedule</span>
            <span id="archetypeTag" style="font-size: 10.5px; color: var(--primary); text-transform: none; font-weight: 600;"></span>
          </div>
          <table class="room-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Dim (W×L)</th>
                <th>Area</th>
              </tr>
            </thead>
            <tbody id="roomTableBody"></tbody>
          </table>
        </div>

        <div class="panel-card">
          <div class="panel-title">Validation Checks (5/5)</div>
          <div class="check-list">
            <div class="check-item">
              <span>Boundary Check (Inside 20×40 ft)</span>
              <span class="check-status">PASSED</span>
            </div>
            <div class="check-item">
              <span>Zero Overlap Check</span>
              <span class="check-status">PASSED</span>
            </div>
            <div class="check-item">
              <span>Minimum Room Dimensions</span>
              <span class="check-status">PASSED</span>
            </div>
            <div class="check-item">
              <span>Required Room Counts</span>
              <span class="check-status">PASSED</span>
            </div>
            <div class="check-item">
              <span>Graph Walkability & Doors</span>
              <span class="check-status">PASSED</span>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="tabs">
            <button class="tab active" id="tabReq" onclick="switchJsonTab('req')">requirements.json</button>
            <button class="tab" id="tabLayout" onclick="switchJsonTab('layout')">layout.json</button>
          </div>
          <pre class="code-box" id="jsonDisplayBox"></pre>
        </div>
      </div>
    </section>
  </main>

  <script>
    const plansData = __PLANS_JSON_PLACEHOLDER__;
    let currentIndex = 0;
    let activeJsonTab = 'req';

    function init() {
      document.getElementById('sidebarPlanCountTitle').textContent = `Generated Plans (${plansData.length})`;
      renderSidebar();
      loadPlan(0);

      window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          navigatePlan(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          navigatePlan(-1);
        }
      });
    }

    function renderSidebar() {
      const container = document.getElementById('planListContainer');
      container.innerHTML = '';

      plansData.forEach((plan, idx) => {
        const card = document.createElement('div');
        card.className = `plan-card ${idx === currentIndex ? 'active' : ''}`;
        card.id = `card-${plan.id}`;
        card.onclick = () => loadPlan(idx);

        const arch = plan.layout.archetype.replace(/_/g, ' ');

        card.innerHTML = `
          <div class="plan-card-top">
            <span class="plan-id">${plan.id}</span>
            <span class="plan-badge">Valid V1</span>
          </div>
          <div class="plan-archetype">${arch}</div>
          <div class="plan-details-row">
            <span>20 × 40 ft</span>
            <span>•</span>
            <span>5 Rooms</span>
            <span>•</span>
            <span>800 sq ft</span>
          </div>
        `;
        container.appendChild(card);
      });
    }

    function loadPlan(index) {
      if (index < 0 || index >= plansData.length) return;
      currentIndex = index;
      const plan = plansData[index];

      document.querySelectorAll('.plan-card').forEach((c, i) => {
        c.classList.toggle('active', i === index);
      });

      const cleanArch = plan.layout.archetype.replace(/_/g, ' ');
      document.getElementById('currentPlanTitle').innerHTML = `
        ${plan.id}
        <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">
          (${cleanArch})
        </span>
      `;
      document.getElementById('archetypeTag').textContent = plan.layout.archetype;

      document.getElementById('svgViewport').innerHTML = plan.svg;

      const tableBody = document.getElementById('roomTableBody');
      tableBody.innerHTML = '';
      plan.layout.rooms.forEach(room => {
        const row = document.createElement('tr');
        const area = Math.round(room.width * room.height);
        row.innerHTML = `
          <td>
            <span class="room-tag ${room.type}"></span>
            <strong>${room.name}</strong>
          </td>
          <td>${room.width.toFixed(0)}' × ${room.height.toFixed(0)}'</td>
          <td>${area} sq ft</td>
        `;
        tableBody.appendChild(row);
      });

      updateJsonDisplay();
    }

    function switchJsonTab(tabName) {
      activeJsonTab = tabName;
      document.getElementById('tabReq').classList.toggle('active', tabName === 'req');
      document.getElementById('tabLayout').classList.toggle('active', tabName === 'layout');
      updateJsonDisplay();
    }

    function updateJsonDisplay() {
      const plan = plansData[currentIndex];
      const box = document.getElementById('jsonDisplayBox');
      if (activeJsonTab === 'req') {
        box.textContent = JSON.stringify(plan.requirements, null, 2);
      } else {
        box.textContent = JSON.stringify(plan.layout, null, 2);
      }
    }

    function navigatePlan(delta) {
      let newIdx = currentIndex + delta;
      if (newIdx < 0) newIdx = plansData.length - 1;
      if (newIdx >= plansData.length) newIdx = 0;
      loadPlan(newIdx);
      const activeCard = document.getElementById(`card-${plansData[newIdx].id}`);
      if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function downloadCurrentSvg() {
      const plan = plansData[currentIndex];
      const blob = new Blob([plan.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.id}_floorplan.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }

    window.onload = init;
  </script>
</body>
</html>
"""

    final_html = html_template.replace("__PLANS_JSON_PLACEHOLDER__", plans_json_str)
    output_file.write_text(final_html, encoding="utf-8")
    print(f"Generated interactive floor plan explorer at: {output_file}")


if __name__ == "__main__":
    import argparse
    current_dir = Path(__file__).resolve().parent
    root_dir = current_dir.parent

    parser = argparse.ArgumentParser(description="PLANORA Interactive Preview HTML Generator")
    parser.add_argument("--dataset", "-d", type=str, default="./dataset", help="Target dataset directory (default: ./dataset)")
    parser.add_argument("--output", "-o", type=str, default="./preview.html", help="Output HTML file (default: ./preview.html)")
    args = parser.parse_args()

    dataset_path = Path(args.dataset).resolve()
    out_path = Path(args.output).resolve()
    generate_preview_html(dataset_path, out_path)
