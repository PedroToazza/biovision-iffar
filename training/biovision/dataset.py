import json
from pathlib import Path

import albumentations as A
import numpy as np
import torch
from albumentations.pytorch import ToTensorV2
from PIL import Image
from torch.utils.data import DataLoader, Dataset

from biovision import config


class EspeciesDataset(Dataset):
    def __init__(self, root_dir: Path, transform=None):
        self.root_dir = Path(root_dir)
        self.transform = transform

        if not self.root_dir.exists():
            raise FileNotFoundError(f"Diretório do dataset não encontrado: {self.root_dir}")
        if not self.root_dir.is_dir():
            raise NotADirectoryError(f"Caminho do dataset não é um diretório: {self.root_dir}")

        class_dirs = sorted([d for d in self.root_dir.iterdir() if d.is_dir()], key=lambda d: d.name)
        if not class_dirs:
            raise ValueError(f"Nenhuma classe encontrada em: {self.root_dir}")

        valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        samples_by_class = {}
        empty_classes = []
        for class_dir in class_dirs:
            class_samples = []
            for img_path in class_dir.iterdir():
                if img_path.suffix.lower() in valid_exts:
                    class_samples.append(str(img_path))
            if class_samples or not config.IGNORE_EMPTY_CLASSES:
                samples_by_class[class_dir.name] = class_samples
            else:
                empty_classes.append(class_dir.name)

        self.classes = sorted(samples_by_class)
        if empty_classes:
            print(f"[WARN] Ignorando {len(empty_classes)} classe(s) vazia(s) em {self.root_dir}: {empty_classes[:5]}")
        elif not config.IGNORE_EMPTY_CLASSES:
            empty_included = [name for name, samples in samples_by_class.items() if not samples]
            if empty_included:
                print(f"[WARN] Mantendo {len(empty_included)} classe(s) vazia(s) em {self.root_dir}: {empty_included[:5]}")
        if not self.classes:
            raise ValueError(f"Nenhuma imagem válida encontrada em: {self.root_dir}")

        self.class_to_idx = {name: i for i, name in enumerate(self.classes)}
        self.samples = []
        for class_name in self.classes:
            class_idx = self.class_to_idx[class_name]
            for img_path in samples_by_class[class_name]:
                self.samples.append((img_path, class_idx))

        if not self.samples:
            raise ValueError(f"Nenhuma imagem válida encontrada em: {self.root_dir}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        for offset in range(len(self.samples)):
            sample_idx = (idx + offset) % len(self.samples)
            img_path, label = self.samples[sample_idx]

            try:
                with Image.open(img_path) as image_file:
                    image = np.array(image_file.convert("RGB"))
                break
            except Exception:
                continue
        else:
            raise RuntimeError(f"Nenhuma imagem legível encontrada em: {self.root_dir}")

        if self.transform:
            image = self.transform(image=image)["image"]

        return image, label


def build_train_transform():
    return A.Compose([
        A.Resize(config.IMG_SIZE + 32, config.IMG_SIZE + 32),
        A.RandomResizedCrop(
            size=(config.IMG_SIZE, config.IMG_SIZE),
            scale=(0.7, 1.0),
            ratio=(0.85, 1.15),
        ),
        A.HorizontalFlip(p=0.5),
        A.Affine(
            translate_percent={"x": (-0.1, 0.1), "y": (-0.1, 0.1)},
            scale=(0.85, 1.15),
            rotate=(-config.AUG_ROTATE_LIMIT, config.AUG_ROTATE_LIMIT),
            p=0.7,
        ),
        A.OneOf([
            A.GaussianBlur(blur_limit=(3, 5)),
            A.MotionBlur(blur_limit=5),
            A.GaussNoise(std_range=(0.02, 0.1)),
        ], p=0.3),
        A.ColorJitter(
            brightness=config.AUG_COLOR_JITTER,
            contrast=config.AUG_COLOR_JITTER,
            saturation=config.AUG_COLOR_JITTER,
            hue=0.05,
            p=0.5,
        ),
        A.CoarseDropout(
            num_holes_range=(1, 6),
            hole_height_range=(8, int(config.IMG_SIZE * 0.12)),
            hole_width_range=(8, int(config.IMG_SIZE * 0.12)),
            p=0.3,
        ),
        A.Normalize(mean=config.IMAGENET_MEAN, std=config.IMAGENET_STD),
        ToTensorV2(),
    ])


def build_eval_transform():
    return A.Compose([
        A.Resize(config.IMG_SIZE, config.IMG_SIZE),
        A.Normalize(mean=config.IMAGENET_MEAN, std=config.IMAGENET_STD),
        ToTensorV2(),
    ])


def build_datasets():
    train_ds = EspeciesDataset(config.TRAIN_DIR, transform=build_train_transform())
    val_ds = EspeciesDataset(config.VAL_DIR, transform=build_eval_transform())
    test_ds = EspeciesDataset(config.TEST_DIR, transform=build_eval_transform())

    assert train_ds.classes == val_ds.classes == test_ds.classes, \
        "As classes em train/val/test não batem!"

    return train_ds, val_ds, test_ds


def _loader_kwargs(*, shuffle: bool, drop_last: bool = False):
    kwargs = {
        "batch_size": config.BATCH_SIZE,
        "shuffle": shuffle,
        "num_workers": config.NUM_WORKERS,
        "pin_memory": config.PIN_MEMORY,
        "drop_last": drop_last,
    }

    if config.NUM_WORKERS > 0:
        kwargs["persistent_workers"] = True
        kwargs["prefetch_factor"] = config.PREFETCH_FACTOR
        if config.DATALOADER_CONTEXT:
            kwargs["multiprocessing_context"] = config.DATALOADER_CONTEXT

    return kwargs


def build_dataloaders():
    train_ds, val_ds, test_ds = build_datasets()

    train_loader = DataLoader(
        train_ds,
        **_loader_kwargs(shuffle=True, drop_last=True),
    )

    val_loader = DataLoader(
        val_ds,
        **_loader_kwargs(shuffle=False),
    )

    test_loader = DataLoader(
        test_ds,
        **_loader_kwargs(shuffle=False),
    )

    return train_loader, val_loader, test_loader, train_ds.classes


def save_class_index(classes):
    mapping = {i: name for i, name in enumerate(classes)}
    with open(config.CLASS_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"[INFO] class_index salvo em: {config.CLASS_INDEX_PATH}")


def inspect_dataset():
    train_ds, val_ds, test_ds = build_datasets()

    print("=" * 70)
    print("DATASET BIOVISION")
    print("=" * 70)
    print(f"  Classes:     {len(train_ds.classes)}")
    print(f"  Treino:      {len(train_ds):,} imagens")
    print(f"  Validação:   {len(val_ds):,} imagens")
    print(f"  Teste:       {len(test_ds):,} imagens")
    print(f"  Total:       {len(train_ds) + len(val_ds) + len(test_ds):,} imagens")
    print()
    print(f"  Primeiras 5 classes: {train_ds.classes[:5]}")
    print(f"  Últimas 5 classes:   {train_ds.classes[-5:]}")
    print("=" * 70)

    img, label = train_ds[0]
    print(f"\n  Shape de uma imagem: {img.shape}")
    print(f"  Tipo:                {img.dtype}")
    print(f"  Range:               [{img.min():.3f}, {img.max():.3f}]")
    print(f"  Label:               {label} ({train_ds.classes[label]})")


if __name__ == "__main__":
    inspect_dataset()
