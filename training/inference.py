"""
PLANORA T5 Inference Pipeline
Phase 3 implementation for executing inference on natural language residential requirements.
"""

import os
import sys
import argparse
import re
from pathlib import Path
from typing import Dict, Any, Optional

# Add project root to path
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from training.dataset_loader import tokens_to_layout, normalize_room_type


class PlanoraInferenceEngine:
    """
    Inference engine that takes natural-language home requirements
    and produces structured layout tokens and JSON.
    """

    def __init__(self, model_dir: str = r"c:\PLANORA\server\models\planora_t5", fallback_model: str = "google/flan-t5-small"):
        self.model_dir = model_dir
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        if os.path.exists(os.path.join(model_dir, "config.json")):
            load_path = model_dir
            print(f"[*] Loading fine-tuned Planora model from: {load_path}")
        else:
            load_path = fallback_model
            print(f"[*] Fine-tuned model not found in {model_dir}. Loading base model: {load_path}")

        self.tokenizer = AutoTokenizer.from_pretrained(load_path)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(load_path)
        self.model.to(self.device)
        self.model.eval()

    def generate_raw_tokens(self, prompt: str, max_new_tokens: int = 384, num_beams: int = 2) -> str:
        """Runs T5 model generation to produce controlled layout tokens."""
        inputs = self.tokenizer(prompt, return_tensors="pt", max_length=128, truncation=True)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                num_beams=num_beams,
                early_stopping=True,
                no_repeat_ngram_size=0
            )

        decoded = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
        return decoded

    def generate_plan(self, prompt: str) -> Dict[str, Any]:
        """
        End-to-end inference: Natural language prompt -> T5 tokens -> parsed JSON layout.
        """
        raw_tokens = self.generate_raw_tokens(prompt)
        layout = tokens_to_layout(raw_tokens)

        return {
            "prompt": prompt,
            "raw_tokens": raw_tokens,
            "layout": layout
        }


def run_cli_inference():
    parser = argparse.ArgumentParser(description="PLANORA T5 Inference")
    parser.add_argument(
        "--prompt",
        type=str,
        default="I need a 30x40 ft house with 2 bedrooms, 2 bathrooms, 1 kitchen, 1 living room, 1 dining room and parking.",
        help="Natural language prompt"
    )
    parser.add_argument("--model-dir", type=str, default=r"c:\PLANORA\server\models\planora_t5")
    args = parser.parse_args()

    engine = PlanoraInferenceEngine(model_dir=args.model_dir)
    print(f"\n[PROMPT]: {args.prompt}")
    res = engine.generate_plan(args.prompt)
    print(f"\n[GENERATED TOKENS]:\n{res['raw_tokens']}")
    print(f"\n[PARSED LAYOUT]:")
    print(f"Plot: {res['layout']['plot']}")
    print(f"Total Rooms: {len(res['layout']['rooms'])}")
    for r in res['layout']['rooms']:
        print(f"  - {r['name']} ({r['type']}): pos=({r['x']}, {r['y']}) dim=({r['width']}x{r['height']})")
    print(f"Total Doors: {len(res['layout']['doors'])}")
    print(f"Total Windows: {len(res['layout']['windows'])}")


if __name__ == "__main__":
    run_cli_inference()
