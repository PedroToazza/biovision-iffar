import os
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    return int(value)


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    return float(value)


PROJECT_ROOT = Path(__file__).parent.parent
RUN_NAME = os.getenv("BIOVISION_RUN_NAME", "biovision_resume_safe")

DATA_DIR = Path(os.getenv("BIOVISION_DATA_DIR", "/mnt/d/Mostra_IFFar"))
TRAIN_DIR = DATA_DIR / "train"
VAL_DIR   = DATA_DIR / "val"
TEST_DIR  = DATA_DIR / "test"

CHECKPOINTS_DIR = PROJECT_ROOT / "checkpoints" / RUN_NAME
LOGS_DIR = PROJECT_ROOT / "logs" / RUN_NAME
CLASS_INDEX_PATH = PROJECT_ROOT / "shared" / "class_index.json"

CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
CLASS_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)


# Alternativas: "convnextv2_tiny.fcmae_ft_in22k_in1k_384",
# "eva02_small_patch14_336.mim_in22k_ft_in22k_in1k"
BACKBONE = "tf_efficientnetv2_m.in21k_ft_in1k"

IMG_SIZE = _env_int("BIOVISION_IMG_SIZE", 384)
BATCH_SIZE = _env_int("BIOVISION_BATCH_SIZE", 16)
GRAD_ACCUM_STEPS = _env_int("BIOVISION_GRAD_ACCUM_STEPS", 4)
NUM_WORKERS = _env_int("BIOVISION_NUM_WORKERS", 4)
PREFETCH_FACTOR = _env_int("BIOVISION_PREFETCH_FACTOR", 2)
PIN_MEMORY = _env_bool("BIOVISION_PIN_MEMORY", True)
DATALOADER_CONTEXT = os.getenv("BIOVISION_DATALOADER_CONTEXT", "fork" if os.name == "posix" else "")
IGNORE_EMPTY_CLASSES = _env_bool("BIOVISION_IGNORE_EMPTY_CLASSES", False)
START_PHASE = _env_int("BIOVISION_START_PHASE", 1)
RESUME_CHECKPOINT = os.getenv("BIOVISION_RESUME_CHECKPOINT", "")

EPOCHS_HEAD = _env_int("BIOVISION_EPOCHS_HEAD", 1)
LR_HEAD = _env_float("BIOVISION_LR_HEAD", 1e-3)

EPOCHS_FT_LIGHT = _env_int("BIOVISION_EPOCHS_FT_LIGHT", 3)
LR_FT_LIGHT = _env_float("BIOVISION_LR_FT_LIGHT", 5e-5)
UNFREEZE_LIGHT = _env_int("BIOVISION_UNFREEZE_LIGHT", 80)

EPOCHS_FT_DEEP = _env_int("BIOVISION_EPOCHS_FT_DEEP", 20)
LR_FT_DEEP = _env_float("BIOVISION_LR_FT_DEEP", 5e-6)
UNFREEZE_DEEP = _env_int("BIOVISION_UNFREEZE_DEEP", 150)

WARMUP_RATIO = _env_float("BIOVISION_WARMUP_RATIO", 0.1)
WARMUP_STEPS_CAP = _env_int("BIOVISION_WARMUP_STEPS_CAP", 3000)
EARLY_STOP_PATIENCE = _env_int("BIOVISION_EARLY_STOP_PATIENCE", 5)
EARLY_STOP_MIN_DELTA = _env_float("BIOVISION_EARLY_STOP_MIN_DELTA", 0.001)

LABEL_SMOOTHING = 0.1
DROPOUT_RATE = 0.4
WEIGHT_DECAY = 1e-4

USE_MIXED_PRECISION = True

AUG_PROB = 0.5
AUG_ROTATE_LIMIT = 20
AUG_COLOR_JITTER = 0.2

# Valores padrão do ImageNet — não alterar
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

SEED = 1337


def print_config():
    print("=" * 70)
    print("BIOVISION - CONFIGURAÇÃO DE TREINO")
    print("=" * 70)
    print(f"  Run:                {RUN_NAME}")
    print(f"  Backbone:           {BACKBONE}")
    print(f"  Resolução:          {IMG_SIZE}x{IMG_SIZE}")
    print(f"  Batch size:         {BATCH_SIZE} (efetivo: {BATCH_SIZE * GRAD_ACCUM_STEPS})")
    print(f"  Mixed precision:    {USE_MIXED_PRECISION}")
    print(f"  Workers:            {NUM_WORKERS} (prefetch={PREFETCH_FACTOR}, pin_memory={PIN_MEMORY})")
    if DATALOADER_CONTEXT:
        print(f"  DataLoader ctx:     {DATALOADER_CONTEXT}")
    print(f"  Ignorar vazias:     {IGNORE_EMPTY_CLASSES}")
    print(f"  Start phase:        {START_PHASE}")
    if RESUME_CHECKPOINT:
        print(f"  Resume checkpoint:  {RESUME_CHECKPOINT}")
    print(f"  Warmup:             {WARMUP_RATIO:.1%}, cap={WARMUP_STEPS_CAP} optimizer steps")
    print(f"  Early stopping:     val_acc, patience={EARLY_STOP_PATIENCE}, min_delta={EARLY_STOP_MIN_DELTA}")
    print()
    print(f"  Fase 1 (head):      {EPOCHS_HEAD} epochs, LR={LR_HEAD}")
    print(f"  Fase 2 (FT light):  {EPOCHS_FT_LIGHT} epochs, LR={LR_FT_LIGHT}, {UNFREEZE_LIGHT} camadas")
    print(f"  Fase 3 (FT deep):   {EPOCHS_FT_DEEP} epochs, LR={LR_FT_DEEP}, {UNFREEZE_DEEP} camadas")
    print()
    total_epochs = EPOCHS_HEAD + EPOCHS_FT_LIGHT + EPOCHS_FT_DEEP
    print(f"  Total de epochs:    {total_epochs}")
    print()
    print(f"  Dataset:            {DATA_DIR}")
    print(f"  Checkpoints:        {CHECKPOINTS_DIR}")
    print(f"  Logs:               {LOGS_DIR}")
    print("=" * 70)


if __name__ == "__main__":
    print_config()
