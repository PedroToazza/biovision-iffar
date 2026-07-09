import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
from tensorflow.keras.models import load_model


class ModelService:
    def __init__(self, model_path: Path, class_index_path: Path):
        self.model_path = Path(model_path)
        self.class_index_path = Path(class_index_path)
        self.model = None
        self.class_names = []

    def load(self) -> None:
        self.class_names = self._load_class_names()
        try:
            self.model = load_model(self.model_path)
            print("Modelo carregado com sucesso.")
        except Exception as exc:
            print(f"Erro ao carregar o modelo em {self.model_path}: {exc}")
            self.model = None

    def predict(self, image_bytes: bytes) -> tuple[str, float]:
        if self.model is None:
            raise RuntimeError("Modelo não carregado.")

        img_array = self._prepare_image(image_bytes)
        predicao = self.model.predict(img_array)
        classe_predita_idx = int(np.argmax(predicao))
        confianca = float(np.max(predicao) * 100)
        return self.class_names[classe_predita_idx], confianca

    def _load_class_names(self) -> list[str]:
        with self.class_index_path.open("r", encoding="utf-8") as f:
            idx_to_class = json.load(f)
        return [idx_to_class[str(i)] for i in range(len(idx_to_class))]

    @staticmethod
    def _prepare_image(image_bytes: bytes):
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_redimensionada = img.resize((224, 224))
        img_array = np.array(img_redimensionada)
        return np.expand_dims(img_array, axis=0).astype("float32")
