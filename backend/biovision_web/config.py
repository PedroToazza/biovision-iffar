import os
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv(ROOT_DIR / ".env")


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    return int(value)


@dataclass(frozen=True)
class AppConfig:
    app_host: str
    app_port: int
    app_debug: bool
    model_path: Path
    class_index_path: Path
    templates_dir: Path
    static_dir: Path
    db_host: str
    db_port: int
    db_user: str
    db_password: str
    db_name: str

    def to_flask_config(self) -> dict:
        return {
            "APP_HOST": self.app_host,
            "APP_PORT": self.app_port,
            "APP_DEBUG": self.app_debug,
            "DB_CONFIG": {
                "host": self.db_host,
                "port": self.db_port,
                "user": self.db_user,
                "password": self.db_password,
                "database": self.db_name,
            },
        }


def load_config() -> AppConfig:
    return AppConfig(
        app_host=os.getenv("BIOVISION_APP_HOST", "0.0.0.0"),
        app_port=_env_int("BIOVISION_APP_PORT", 5001),
        app_debug=_env_bool("BIOVISION_DEBUG", False),
        model_path=Path(os.getenv("BIOVISION_MODEL_PATH", ROOT_DIR / "models" / "modelo_01.keras")),
        class_index_path=Path(os.getenv("BIOVISION_CLASS_INDEX_PATH", ROOT_DIR / "backend" / "data" / "class_index_corrigido.json")),
        templates_dir=Path(os.getenv("BIOVISION_TEMPLATES_DIR", ROOT_DIR / "web" / "templates")),
        static_dir=Path(os.getenv("BIOVISION_STATIC_DIR", ROOT_DIR / "web" / "static_biovision")),
        db_host=os.getenv("BIOVISION_DB_HOST", "localhost"),
        db_port=_env_int("BIOVISION_DB_PORT", 3307),
        db_user=os.getenv("BIOVISION_DB_USER", "root"),
        db_password=os.getenv("BIOVISION_DB_PASSWORD", ""),
        db_name=os.getenv("BIOVISION_DB_NAME", "biovision_especie"),
    )
