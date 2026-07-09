from typing import Optional

import timm
import torch
import torch.nn as nn

from biovision import config


class BioVisionModel(nn.Module):
    def __init__(self, num_classes: int, backbone_name: Optional[str] = None, pretrained: bool = True):
        super().__init__()

        backbone_name = backbone_name or config.BACKBONE

        self.backbone = timm.create_model(
            backbone_name,
            pretrained=pretrained,
            num_classes=0,
            global_pool="avg",
        )

        feature_dim = self.backbone.num_features

        self.head = nn.Sequential(
            nn.Linear(feature_dim, 1024),
            nn.BatchNorm1d(1024),
            nn.ReLU(inplace=True),
            nn.Dropout(config.DROPOUT_RATE),
            nn.Linear(1024, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(config.DROPOUT_RATE * 0.75),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        features = self.backbone(x)
        logits = self.head(features)
        return logits

    def freeze_backbone(self):
        for param in self.backbone.parameters():
            param.requires_grad = False
        self.freeze_backbone_norm_layers()

    def unfreeze_backbone(self, num_layers: Optional[int] = None):
        if num_layers is None:
            for param in self.backbone.parameters():
                param.requires_grad = True
        else:
            all_params = list(self.backbone.parameters())
            for param in all_params:
                param.requires_grad = False
            if num_layers > 0:
                for param in all_params[-num_layers:]:
                    param.requires_grad = True

        self.freeze_backbone_norm_layers()

    def freeze_backbone_norm_layers(self):
        for module in self.backbone.modules():
            if isinstance(module, (nn.BatchNorm1d, nn.BatchNorm2d)):
                module.eval()
                for param in module.parameters():
                    param.requires_grad = False

    def count_trainable_params(self):
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        total = sum(p.numel() for p in self.parameters())
        return trainable, total


def build_model(num_classes: int) -> BioVisionModel:
    model = BioVisionModel(num_classes=num_classes)
    model.freeze_backbone()
    return model


if __name__ == "__main__":
    print(f"Construindo modelo: {config.BACKBONE}")
    model = build_model(num_classes=885)

    trainable, total = model.count_trainable_params()
    print(f"  Parâmetros totais:     {total:,}")
    print(f"  Parâmetros treináveis: {trainable:,}")
    print(f"  Congelados:            {total - trainable:,}")

    dummy = torch.randn(2, 3, config.IMG_SIZE, config.IMG_SIZE)
    out = model(dummy)
    print(f"\n  Input shape:  {list(dummy.shape)}")
    print(f"  Output shape: {list(out.shape)}")
