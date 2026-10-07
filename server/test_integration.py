import urllib.request
import json
import sys

def test_frontend():
    print("=== Testing Frontend (Vite) ===")
    url = "http://127.0.0.1:5174/generate"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as resp:
            code = resp.getcode()
            content = resp.read().decode('utf-8')
            print(f"Frontend HTTP Status: {code}")
            assert code == 200, f"Expected 200, got {code}"
            assert "html" in content.lower(), "Expected HTML response"
            print(" Frontend serving successfully.")
    except Exception as e:
        print(f" Frontend error: {e}")
        return False
    return True

def test_backend_prompt(prompt_text, expected_rooms):
    print(f"\n=== Testing Backend with Prompt: '{prompt_text}' ===")
    url = "http://127.0.0.1:8000/generate-plan"
    data = json.dumps({"prompt": prompt_text}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            code = resp.getcode()
            body = json.loads(resp.read().decode('utf-8'))
            print(f"Backend HTTP Status: {code}")
            assert code == 200, f"Expected 200, got {code}"
            assert body.get("success") is True, "Expected success: True"
            
            layout = body.get("layout", {})
            plot = layout.get("plot", {})
            rooms = layout.get("rooms", [])
            doors = layout.get("doors", [])
            windows = layout.get("windows", [])
            svg = body.get("svg", "")
            validation = body.get("validation", {})
            
            print(f" Plot: {plot.get('width')} x {plot.get('length')} {plot.get('unit')}")
            print(f" Rooms ({len(rooms)}): {[r.get('type') for r in rooms]}")
            print(f" Doors: {len(doors)}, Windows: {len(windows)}")
            print(f" Validation Valid: {validation.get('valid')}")
            print(f" Validation Errors: {validation.get('errors')}")
            print(f" SVG Blueprint Length: {len(svg)} chars")
            
            assert len(rooms) >= expected_rooms, f"Expected >= {expected_rooms} rooms, got {len(rooms)}"
            assert len(svg) > 1000, "Expected non-trivial SVG output"
            assert "<svg" in svg and "</svg>" in svg, "SVG tags missing"
            assert validation.get("valid") is True, f"Validation failed: {validation.get('errors')}"
            
            print(" Floor plan passed all architectural constraints and rendered correctly.")
            return True
    except Exception as e:
        print(f" Backend error: {e}")
        return False

def main():
    fe_ok = test_frontend()
    
    p1_ok = test_backend_prompt(
        "I need a 30x40 ft house with 2 bedrooms, 2 bathrooms, 1 kitchen, 1 living room, 1 dining room and parking.",
        expected_rooms=7
    )
    
    p2_ok = test_backend_prompt(
        "Floor plan layout: 20x30 ft plot size, 1 bedroom, 1 bathroom, 1 kitchen and 1 living room.",
        expected_rooms=4
    )
    
    p3_ok = test_backend_prompt(
        "Floor plan layout: 30x50 ft plot size, 3 bedrooms, 2 bathrooms, 1 kitchen, 1 living room and parking.",
        expected_rooms=8
    )
    
    if fe_ok and p1_ok and p2_ok and p3_ok:
        print("\n ALL SYSTEM TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    main()
