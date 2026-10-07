"""
PLANORA T5 Fine-Tuning Pipeline
Phase 2 implementation for training T5 / FLAN-T5 on structured floor-plan layout generation.
"""

import os
import sys
import time
import argparse
import json
from pathlib import Path

# Add project root to path
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import torch
from torch.utils.data import DataLoader
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, get_linear_schedule_with_warmup

from training.dataset_loader import (
    load_planora_data,
    split_dataset,
    PlanoraDataset
)


def train_model(
    model_name: str = "google/flan-t5-small",
    output_dir: str = r"c:\PLANORA\server\models\planora_t5",
    epochs: int = 10,
    batch_size: int = 4,
    learning_rate: float = 5e-4,
    max_source_length: int = 128,
    max_target_length: int = 384,
    seed: int = 42
):
    print("=" * 65)
    print("PLANORA T5 MODEL FINE-TUNING PIPELINE")
    print(f"Base Model:      {model_name}")
    print(f"Output Directory:{output_dir}")
    print(f"Epochs:          {epochs}")
    print(f"Batch Size:      {batch_size}")
    print(f"Learning Rate:   {learning_rate}")
    print("=" * 65)

    os.makedirs(output_dir, exist_ok=True)

    # 1. Device configuration
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Training on device: {device}")

    # 2. Tokenizer and Model Loading
    print(f"[*] Loading tokenizer: {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    print(f"[*] Loading base model: {model_name}...")
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    model.to(device)

    # 3. Dataset Loading & Splitting
    print("[*] Loading and augmenting Planora dataset...")
    pairs, raw_meta = load_planora_data(augment=True)
    print(f"[*] Total augmented training pairs: {len(pairs)}")

    train_pairs, val_pairs, test_pairs = split_dataset(pairs, train_ratio=0.8, val_ratio=0.1, seed=seed)
    print(f"[*] Split sizes -> Train: {len(train_pairs)}, Val: {len(val_pairs)}, Test: {len(test_pairs)}")

    # Save test pairs for evaluation in Phase 9
    test_file = os.path.join(output_dir, "test_samples.json")
    with open(test_file, "w", encoding="utf-8") as tf:
        json.dump(test_pairs, tf, indent=2)

    train_dataset = PlanoraDataset(train_pairs, tokenizer, max_source_length, max_target_length)
    val_dataset = PlanoraDataset(val_pairs, tokenizer, max_source_length, max_target_length)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    # 4. Optimizer and Scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    total_steps = len(train_loader) * epochs
    warmup_steps = int(total_steps * 0.1)
    scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=warmup_steps, num_training_steps=total_steps)

    best_val_loss = float("inf")
    history = []

    print("\n[*] Starting training loop...")
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        model.train()
        total_train_loss = 0.0

        for step, batch in enumerate(train_loader):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            optimizer.zero_grad()
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )

            loss = outputs.loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()

            total_train_loss += loss.item()

        avg_train_loss = total_train_loss / max(1, len(train_loader))

        # Validation loop
        model.eval()
        total_val_loss = 0.0
        with torch.no_grad():
            for batch in val_loader:
                input_ids = batch["input_ids"].to(device)
                attention_mask = batch["attention_mask"].to(device)
                labels = batch["labels"].to(device)

                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels
                )
                total_val_loss += outputs.loss.item()

        avg_val_loss = total_val_loss / max(1, len(val_loader))
        epoch_time = time.time() - epoch_start

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"Train Loss: {avg_train_loss:.4f} | "
            f"Val Loss: {avg_val_loss:.4f} | "
            f"Time: {epoch_time:.1f}s"
        )

        history.append({
            "epoch": epoch,
            "train_loss": avg_train_loss,
            "val_loss": avg_val_loss,
            "time_seconds": epoch_time
        })

        # Save checkpoint if best val loss
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            print(f"  -> Best model achieved (Val Loss: {best_val_loss:.4f}). Saving to {output_dir}...")
            model.save_pretrained(output_dir)
            tokenizer.save_pretrained(output_dir)

    total_time = time.time() - start_time
    print(f"\n[*] Training complete in {total_time:.1f} seconds! Best Val Loss: {best_val_loss:.4f}")

    # Save training configuration & metrics
    config_info = {
        "model_name": model_name,
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": learning_rate,
        "best_val_loss": best_val_loss,
        "total_training_time": total_time,
        "history": history
    }
    with open(os.path.join(output_dir, "training_history.json"), "w", encoding="utf-8") as hf:
        json.dump(config_info, hf, indent=2)

    print(f"[*] Model and tokenizer artifacts saved to: {output_dir}")
    return output_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Planora T5 Model")
    parser.add_argument("--model-name", type=str, default="google/flan-t5-small")
    parser.add_argument("--output-dir", type=str, default=r"c:\PLANORA\server\models\planora_t5")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--lr", type=float, default=5e-4)

    args = parser.parse_args()

    train_model(
        model_name=args.model_name,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr
    )
