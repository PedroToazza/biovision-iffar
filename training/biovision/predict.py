import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from biovision import config
from biovision.dataset import build_eval_transform
from biovision.train import BioVisionLightning


def load_class_names():
    with open(config.CLASS_INDEX_PATH, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    return [mapping[str(i)] for i in range(len(mapping))]


def find_best_checkpoint():
    ckpt_dir = config.CHECKPOINTS_DIR / "fase3_ft_deep"
    candidates = list(ckpt_dir.glob("best-*.ckpt"))
    if not candidates:
        raise FileNotFoundError(f"Nenhum checkpoint encontrado em {ckpt_dir}")
    return str(sorted(candidates)[-1])


def load_model(checkpoint_path: str = None):
    if checkpoint_path is None:
        checkpoint_path = find_best_checkpoint()

    print(f"[INFO] Carregando modelo: {checkpoint_path}")
    model = BioVisionLightning.load_from_checkpoint(checkpoint_path)
    model.eval()
    model.freeze()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    return model, device


def preprocess_image(image_path: str):
    image = np.array(Image.open(image_path).convert("RGB"))
    transform = build_eval_transform()
    tensor = transform(image=image)["image"]
    return tensor.unsqueeze(0)


@torch.no_grad()
def predict(image_path: str, model=None, device=None, class_names=None, top_k: int = 5):
    if model is None:
        model, device = load_model()
    if class_names is None:
        class_names = load_class_names()

    tensor = preprocess_image(image_path).to(device)
    logits = model(tensor)
    probs = torch.softmax(logits, dim=1).cpu().numpy()[0]

    top_indices = np.argsort(-probs)[:top_k]
    results = [
        {
            "rank": i + 1,
            "class": class_names[idx],
            "confidence": float(probs[idx]),
        }
        for i, idx in enumerate(top_indices)
    ]

    return results


def main():
    if len(sys.argv) < 2:
        print("Uso: python -m biovision.predict <caminho_imagem> [checkpoint_opcional]")
        sys.exit(1)

    image_path = sys.argv[1]
    checkpoint = sys.argv[2] if len(sys.argv) > 2 else None

    if not Path(image_path).exists():
        print(f"ERRO: imagem não encontrada: {image_path}")
        sys.exit(1)

    model, device = load_model(checkpoint)
    class_names = load_class_names()

    results = predict(image_path, model=model, device=device, class_names=class_names)

    print("\n" + "=" * 60)
    print(f"Imagem: {image_path}")
    print("=" * 60)
    for r in results:
        bar_len = int(r["confidence"] * 40)
        bar = "█" * bar_len + "░" * (40 - bar_len)
        print(f"  {r['rank']}. {r['class']:<30} {r['confidence']*100:6.2f}%  {bar}")


if __name__ == "__main__":
    main()