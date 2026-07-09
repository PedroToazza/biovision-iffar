import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
from sklearn.metrics import classification_report, confusion_matrix
from tqdm import tqdm

from biovision import config
from biovision.dataset import build_dataloaders
from biovision.train import BioVisionLightning


def load_best_model(checkpoint_path: str):
    print(f"Carregando modelo de: {checkpoint_path}")
    model = BioVisionLightning.load_from_checkpoint(checkpoint_path)
    model.eval()
    model.freeze()
    return model


@torch.no_grad()
def run_inference(model, loader, device):
    model = model.to(device)
    all_preds = []
    all_labels = []
    all_probs = []

    for images, labels in tqdm(loader, desc="Inferência"):
        images = images.to(device)
        logits = model(images)
        probs = torch.softmax(logits, dim=1)
        preds = probs.argmax(dim=1)

        all_preds.append(preds.cpu().numpy())
        all_labels.append(labels.numpy())
        all_probs.append(probs.cpu().numpy())

    return (
        np.concatenate(all_preds),
        np.concatenate(all_labels),
        np.concatenate(all_probs),
    )


def compute_metrics(preds, labels, probs, classes):
    top1_acc = (preds == labels).mean()

    top_k = min(5, len(classes))
    topk_preds = np.argsort(-probs, axis=1)[:, :top_k]
    topk_acc = np.any(topk_preds == labels[:, None], axis=1).mean()

    print("\n" + "=" * 70)
    print("MÉTRICAS GLOBAIS")
    print("=" * 70)
    print(f"  Top-1 Accuracy: {top1_acc*100:.2f}%")
    print(f"  Top-{top_k} Accuracy: {topk_acc*100:.2f}%")

    report = classification_report(
        labels,
        preds,
        labels=list(range(len(classes))),
        target_names=classes,
        output_dict=True,
        zero_division=0,
    )

    per_class_acc = {
        name: report[name]["recall"]
        for name in classes
    }

    sorted_worst = sorted(per_class_acc.items(), key=lambda x: x[1])
    sorted_best = sorted(per_class_acc.items(), key=lambda x: -x[1])

    print("\n  10 PIORES CLASSES:")
    for name, acc in sorted_worst[:10]:
        print(f"    {name:30s} {acc*100:6.2f}%")

    print("\n  10 MELHORES CLASSES:")
    for name, acc in sorted_best[:10]:
        print(f"    {name:30s} {acc*100:6.2f}%")

    return {
        "top1_acc": float(top1_acc),
        "top5_acc": float(topk_acc),
        "per_class": per_class_acc,
        "report": report,
    }


def save_confusion_matrix(preds, labels, classes, output_path, max_classes=30):
    if len(classes) > max_classes:
        print(f"\n[INFO] Muitas classes ({len(classes)}). Matriz de confusão só das {max_classes} piores.")
        unique, counts = np.unique(labels, return_counts=True)
        class_accs = []
        for i, cls_name in enumerate(classes):
            mask = labels == i
            if mask.sum() > 0:
                acc = (preds[mask] == i).mean()
                class_accs.append((i, cls_name, acc))
        class_accs.sort(key=lambda x: x[2])
        selected_idxs = [x[0] for x in class_accs[:max_classes]]
        selected_names = [x[1] for x in class_accs[:max_classes]]

        mask = np.isin(labels, selected_idxs)
        filtered_labels = labels[mask]
        filtered_preds = preds[mask]

        label_map = {old: new for new, old in enumerate(selected_idxs)}
        filtered_labels = np.array([label_map.get(l, -1) for l in filtered_labels])
        filtered_preds = np.array([label_map.get(p, -1) for p in filtered_preds])

        valid = (filtered_labels >= 0) & (filtered_preds >= 0)
        cm = confusion_matrix(filtered_labels[valid], filtered_preds[valid])
        names_to_plot = selected_names
    else:
        cm = confusion_matrix(labels, preds)
        names_to_plot = classes

    plt.figure(figsize=(16, 14))
    sns.heatmap(
        cm,
        annot=False,
        fmt="d",
        cmap="Blues",
        xticklabels=names_to_plot,
        yticklabels=names_to_plot,
        cbar=True,
    )
    plt.title("Matriz de Confusão")
    plt.xlabel("Predito")
    plt.ylabel("Real")
    plt.xticks(rotation=90)
    plt.yticks(rotation=0)
    plt.tight_layout()
    plt.savefig(output_path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"\n[INFO] Matriz de confusão salva em: {output_path}")


def main(checkpoint_path: str = None):
    if checkpoint_path is None:
        ckpt_dir = config.CHECKPOINTS_DIR / "fase3_ft_deep"
        candidates = list(ckpt_dir.glob("best-*.ckpt"))
        if not candidates:
            raise FileNotFoundError(f"Nenhum checkpoint encontrado em {ckpt_dir}")
        checkpoint_path = str(sorted(candidates)[-1])

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    model = load_best_model(checkpoint_path)

    _, _, test_loader, classes = build_dataloaders()
    print(f"Classes: {len(classes)}")
    print(f"Imagens de teste: {len(test_loader.dataset)}")

    preds, labels, probs = run_inference(model, test_loader, device)

    metrics = compute_metrics(preds, labels, probs, classes)

    output_dir = config.LOGS_DIR / "evaluation"
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(output_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "top1_acc": metrics["top1_acc"],
                "top5_acc": metrics["top5_acc"],
                "per_class": metrics["per_class"],
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"\n[INFO] Métricas salvas em: {output_dir / 'metrics.json'}")

    save_confusion_matrix(
        preds, labels, classes,
        output_path=output_dir / "confusion_matrix.png",
    )


if __name__ == "__main__":
    import sys
    ckpt = sys.argv[1] if len(sys.argv) > 1 else None
    main(ckpt)
