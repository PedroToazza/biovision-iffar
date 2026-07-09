import lightning as L
import torch
import torch.nn as nn
from lightning.pytorch.callbacks import (
    EarlyStopping,
    LearningRateMonitor,
    ModelCheckpoint,
)
from lightning.pytorch.loggers import TensorBoardLogger
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR
from torchmetrics.classification import MulticlassAccuracy

from biovision import config
from biovision.dataset import build_dataloaders, save_class_index
from biovision.model import build_model


class BioVisionLightning(L.LightningModule):
    def __init__(self, num_classes: int, learning_rate: float, total_steps: int):
        super().__init__()
        self.save_hyperparameters()

        self.model = build_model(num_classes=num_classes)
        self.loss_fn = nn.CrossEntropyLoss(label_smoothing=config.LABEL_SMOOTHING)

        self.train_acc = MulticlassAccuracy(num_classes=num_classes, top_k=1)
        self.val_acc = MulticlassAccuracy(num_classes=num_classes, top_k=1)
        self.val_acc_top5 = MulticlassAccuracy(num_classes=num_classes, top_k=min(5, num_classes))
        self.test_acc = MulticlassAccuracy(num_classes=num_classes, top_k=1)
        self.test_acc_top5 = MulticlassAccuracy(num_classes=num_classes, top_k=min(5, num_classes))

        self.learning_rate = learning_rate
        self.total_steps = total_steps

    def forward(self, x):
        return self.model(x)

    def on_train_epoch_start(self):
        self.model.freeze_backbone_norm_layers()

    def training_step(self, batch, batch_idx):
        images, labels = batch
        logits = self(images)
        loss = self.loss_fn(logits, labels)

        self.train_acc(logits, labels)
        self.log("train_loss", loss, prog_bar=True, on_step=False, on_epoch=True)
        self.log("train_acc", self.train_acc, prog_bar=True, on_step=False, on_epoch=True)

        return loss

    def validation_step(self, batch, batch_idx):
        images, labels = batch
        logits = self(images)
        loss = self.loss_fn(logits, labels)

        self.val_acc(logits, labels)
        self.val_acc_top5(logits, labels)
        self.log("val_loss", loss, prog_bar=True, on_epoch=True)
        self.log("val_acc", self.val_acc, prog_bar=True, on_epoch=True)
        self.log("val_acc_top5", self.val_acc_top5, prog_bar=False, on_epoch=True)

        return loss

    def test_step(self, batch, batch_idx):
        images, labels = batch
        logits = self(images)
        loss = self.loss_fn(logits, labels)

        self.test_acc(logits, labels)
        self.test_acc_top5(logits, labels)
        self.log("test_loss", loss, on_epoch=True)
        self.log("test_acc", self.test_acc, on_epoch=True)
        self.log("test_acc_top5", self.test_acc_top5, on_epoch=True)

        return loss

    def configure_optimizers(self):
        optimizer = AdamW(
            filter(lambda p: p.requires_grad, self.parameters()),
            lr=self.learning_rate,
            weight_decay=config.WEIGHT_DECAY,
        )

        warmup_steps = max(int(self.total_steps * config.WARMUP_RATIO), 1)
        warmup_steps = min(warmup_steps, config.WARMUP_STEPS_CAP)
        decay_steps = max(self.total_steps - warmup_steps, 1)

        warmup = LinearLR(optimizer, start_factor=0.01, total_iters=warmup_steps)
        decay = CosineAnnealingLR(optimizer, T_max=decay_steps, eta_min=self.learning_rate * 0.01)

        scheduler = SequentialLR(
            optimizer,
            schedulers=[warmup, decay],
            milestones=[warmup_steps],
        )

        return {
            "optimizer": optimizer,
            "lr_scheduler": {"scheduler": scheduler, "interval": "step"},
        }


def make_trainer(phase_name: str, max_epochs: int):
    logger = TensorBoardLogger(
        save_dir=str(config.LOGS_DIR),
        name=phase_name,
    )

    checkpoint = ModelCheckpoint(
        dirpath=str(config.CHECKPOINTS_DIR / phase_name),
        filename="best-{epoch:02d}-{val_acc:.4f}",
        monitor="val_acc",
        mode="max",
        save_top_k=1,
        save_last=True,
    )

    early_stop = EarlyStopping(
        monitor="val_acc",
        patience=config.EARLY_STOP_PATIENCE,
        min_delta=config.EARLY_STOP_MIN_DELTA,
        mode="max",
        verbose=True,
    )

    lr_monitor = LearningRateMonitor(logging_interval="step")
    use_gpu = torch.cuda.is_available()
    accelerator = "gpu" if use_gpu else "cpu"
    precision = "16-mixed" if use_gpu and config.USE_MIXED_PRECISION else "32"

    return L.Trainer(
        max_epochs=max_epochs,
        accelerator=accelerator,
        devices=1,
        precision=precision,
        accumulate_grad_batches=config.GRAD_ACCUM_STEPS,
        logger=logger,
        callbacks=[checkpoint, early_stop, lr_monitor],
        log_every_n_steps=20,
        deterministic=False,
        benchmark=True,
        gradient_clip_val=1.0,
    )


def ensure_checkpoint(path: str, phase_name: str) -> str:
    if not path:
        raise RuntimeError(f"Nenhum checkpoint foi salvo na fase {phase_name}.")
    return path


def ensure_resume_checkpoint() -> str:
    if not config.RESUME_CHECKPOINT:
        raise RuntimeError(
            "BIOVISION_RESUME_CHECKPOINT é obrigatório quando BIOVISION_START_PHASE > 1."
        )
    return config.RESUME_CHECKPOINT


def main():
    torch.set_float32_matmul_precision("high")
    L.seed_everything(config.SEED)
    config.print_config()

    print("\n[1/4] Carregando datasets...")
    train_loader, val_loader, test_loader, classes = build_dataloaders()
    num_classes = len(classes)
    save_class_index(classes)

    print(f"  Classes: {num_classes}")
    print(f"  Batches de treino: {len(train_loader)}")
    print(f"  Batches de validação: {len(val_loader)}")

    steps_per_epoch = max((len(train_loader) + config.GRAD_ACCUM_STEPS - 1) // config.GRAD_ACCUM_STEPS, 1)

    if config.START_PHASE <= 1:
        # ============================================================
        # FASE 1 — Treinar só a cabeça
        # ============================================================
        print("\n" + "=" * 70)
        print("FASE 1 — Treinando a cabeça (backbone congelado)")
        print("=" * 70)

        lit_model = BioVisionLightning(
            num_classes=num_classes,
            learning_rate=config.LR_HEAD,
            total_steps=steps_per_epoch * config.EPOCHS_HEAD,
        )

        trainable, total = lit_model.model.count_trainable_params()
        print(f"  Parâmetros treináveis: {trainable:,} / {total:,}")

        trainer_1 = make_trainer("fase1_head", config.EPOCHS_HEAD)
        trainer_1.fit(lit_model, train_loader, val_loader)

        best_path_1 = ensure_checkpoint(trainer_1.checkpoint_callback.best_model_path, "fase1_head")
        print(f"  Melhor checkpoint: {best_path_1}")
    else:
        best_path_1 = ensure_resume_checkpoint()
        print(f"\n[SKIP] Fase 1 pulada. Checkpoint base: {best_path_1}")

    # ============================================================
    # FASE 2 — Fine-tuning leve
    # ============================================================
    if config.START_PHASE <= 2:
        print("\n" + "=" * 70)
        print(f"FASE 2 — Fine-tuning leve ({config.UNFREEZE_LIGHT} camadas)")
        print("=" * 70)

        lit_model = BioVisionLightning.load_from_checkpoint(best_path_1)
        lit_model.model.unfreeze_backbone(num_layers=config.UNFREEZE_LIGHT)
        lit_model.learning_rate = config.LR_FT_LIGHT
        lit_model.total_steps = steps_per_epoch * config.EPOCHS_FT_LIGHT

        trainable, total = lit_model.model.count_trainable_params()
        print(f"  Parâmetros treináveis: {trainable:,} / {total:,}")

        trainer_2 = make_trainer("fase2_ft_light", config.EPOCHS_FT_LIGHT)
        trainer_2.fit(lit_model, train_loader, val_loader)

        best_path_2 = ensure_checkpoint(trainer_2.checkpoint_callback.best_model_path, "fase2_ft_light")
        print(f"  Melhor checkpoint: {best_path_2}")
    else:
        best_path_2 = ensure_resume_checkpoint()
        print(f"\n[SKIP] Fase 2 pulada. Checkpoint base: {best_path_2}")

    # ============================================================
    # FASE 3 — Fine-tuning profundo
    # ============================================================
    print("\n" + "=" * 70)
    print(f"FASE 3 — Fine-tuning profundo ({config.UNFREEZE_DEEP} camadas)")
    print("=" * 70)

    lit_model = BioVisionLightning.load_from_checkpoint(best_path_2)
    lit_model.model.unfreeze_backbone(num_layers=config.UNFREEZE_DEEP)
    lit_model.learning_rate = config.LR_FT_DEEP
    lit_model.total_steps = steps_per_epoch * config.EPOCHS_FT_DEEP

    trainable, total = lit_model.model.count_trainable_params()
    print(f"  Parâmetros treináveis: {trainable:,} / {total:,}")

    trainer_3 = make_trainer("fase3_ft_deep", config.EPOCHS_FT_DEEP)
    trainer_3.fit(lit_model, train_loader, val_loader)

    best_path_3 = ensure_checkpoint(trainer_3.checkpoint_callback.best_model_path, "fase3_ft_deep")
    print(f"  Melhor checkpoint final: {best_path_3}")

    # ============================================================
    # AVALIAÇÃO FINAL NO TEST SET
    # ============================================================
    print("\n" + "=" * 70)
    print("AVALIAÇÃO NO CONJUNTO DE TESTE")
    print("=" * 70)

    best_model = BioVisionLightning.load_from_checkpoint(best_path_3)
    trainer_3.test(best_model, test_loader)

    print(f"\n[OK] Treino concluído.")
    print(f"Modelo final: {best_path_3}")


if __name__ == "__main__":
    main()
