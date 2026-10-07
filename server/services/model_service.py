"""
PLANORA Model Service
Orchestrates the complete Planora AI Workflow:
User Prompt -> Prompt Requirements -> T5-Small Inference -> Token Parsing -> Constraint Validation -> Repair Engine -> SVG 2D Blueprint
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Add project root to sys.path
current_dir = Path(__file__).resolve().parent
server_dir = current_dir.parent
project_root = server_dir.parent
for p in [str(project_root), str(server_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from server.services.parser import (
    parse_model_output,
    extract_requirements_from_prompt,
)
from server.services.validator import validate_floor_plan
from server.services.repair import repair_layout
from server.services.renderer import render_floor_plan_svg
from training.dataset_loader import compute_exterior_windows


class PlanoraModelService:
    """Singleton service managing T5 model lifecycle and inference pipeline."""

    _instance: Optional["PlanoraModelService"] = None

    def __init__(self, model_dir: str = r"c:\PLANORA\server\models\planora_t5"):
        self.model_dir = model_dir
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = None
        self.model = None
        self._load_model()

    @classmethod
    def get_instance(cls) -> "PlanoraModelService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_model(self):
        """Loads fine-tuned model or fallback base model."""
        load_path = self.model_dir if os.path.exists(os.path.join(self.model_dir, "config.json")) else "google/flan-t5-small"
        print(f"[*] PlanoraModelService loading model from: {load_path}")
        self.tokenizer = AutoTokenizer.from_pretrained(load_path)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(load_path)
        self.model.to(self.device)
        self.model.eval()
        print("[*] PlanoraModelService model ready.")

    def generate(self, prompt: str) -> Dict[str, Any]:
        """
        Executes end-to-end plan generation pipeline.
        """
        prompt = prompt.strip()
        if not prompt:
            return {
                "success": False,
                "error": "Empty prompt provided",
                "validation": {"valid": False, "errors": ["No prompt provided"], "warnings": []}
            }

        # 1. Extract requirements from user prompt
        requirements = extract_requirements_from_prompt(prompt)

        # 2. T5 Model Generation
        inputs = self.tokenizer(prompt, return_tensors="pt", max_length=128, truncation=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=320,
                num_beams=2,
                repetition_penalty=1.2,
                no_repeat_ngram_size=4,
                early_stopping=True
            )

        raw_tokens = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()

        # 3. Parse tokens into structured JSON layout
        layout, parse_error = parse_model_output(raw_tokens)

        # If layout is empty or missing rooms, construct initial architectural layout from requirements
        if not layout or not layout.get("rooms"):
            # Provide base layout structure respecting plot and rooms requested
            pw = requirements["plot"]["width"]
            pl = requirements["plot"]["length"]
            layout = {
                "plot": {"width": pw, "height": pl, "length": pl, "unit": "ft"},
                "rooms": [],
                "doors": [],
                "windows": []
            }

        # Ensure plot dimensions match prompt requirements
        layout["plot"]["width"] = requirements["plot"]["width"]
        layout["plot"]["length"] = requirements["plot"]["length"]
        layout["plot"]["height"] = requirements["plot"]["length"]

        # 4. Synthesize windows and doors if missing
        if not layout.get("windows"):
            layout["windows"] = compute_exterior_windows(
                layout["plot"]["width"],
                layout["plot"]["length"],
                layout.get("rooms", []),
                layout.get("doors", [])
            )

        # 5. Constraint Validation & Repair Engine
        final_layout, val_report, was_repaired = repair_layout(layout, requirements)

        # Ensure exterior windows are up to date with final room bounds
        if not final_layout.get("windows"):
            final_layout["windows"] = compute_exterior_windows(
                final_layout["plot"]["width"],
                final_layout["plot"]["length"],
                final_layout.get("rooms", []),
                final_layout.get("doors", [])
            )

        # 6. SVG Blueprint Rendering
        svg_blueprint = render_floor_plan_svg(final_layout, plan_title=f"{prompt[:38]}...")

        return {
            "success": val_report["valid"],
            "prompt": prompt,
            "raw_tokens": raw_tokens,
            "requirements": requirements,
            "layout": final_layout,
            "validation": val_report,
            "svg": svg_blueprint,
            "was_repaired": was_repaired
        }


# Singleton accessor
def get_model_service() -> PlanoraModelService:
    return PlanoraModelService.get_instance()
