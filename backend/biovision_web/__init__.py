from flask import Flask

from .config import load_config
from .model_service import ModelService
from .routes import register_routes


def create_app():
    config = load_config()

    app = Flask(
        __name__,
        static_url_path="/static_biovision",
        static_folder=str(config.static_dir),
        template_folder=str(config.templates_dir),
    )
    app.config.update(config.to_flask_config())

    app.model_service = ModelService(config.model_path, config.class_index_path)
    app.model_service.load()

    register_routes(app)
    return app
