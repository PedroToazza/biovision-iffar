from flask import current_app, jsonify, render_template, request

from .db import buscar_informacoes_especie


def register_routes(app):
    @app.route("/biovision/")
    def index():
        return render_template("index.html")

    @app.route("/biovision/identificar")
    def identificar():
        return render_template("identificar.html")

    @app.route("/biovision/classificar", methods=["POST"])
    def classificar():
        if "imagem" not in request.files:
            return jsonify({"erro": "Imagem não enviada"}), 400

        arquivo_imagem = request.files["imagem"]
        if arquivo_imagem.filename == "":
            return jsonify({"erro": "Nenhuma imagem selecionada"}), 400

        try:
            keyword, confianca = current_app.model_service.predict(arquivo_imagem.read())
        except RuntimeError as exc:
            return jsonify({"erro": str(exc)}), 500

        dados_mysql = buscar_informacoes_especie(keyword, current_app.config["DB_CONFIG"])
        if not dados_mysql:
            return jsonify({
                "keyword": keyword,
                "confidence": confianca,
                "dados_taxon": None,
                "erro": "Espécie não encontrada no banco de dados",
            })

        return jsonify({
            "keyword": keyword,
            "confidence": confianca,
            "dados_taxon": dados_mysql,
        })

    @app.route("/service-worker.js")
    @app.route("/biovision/service-worker.js")
    def service_worker():
        return app.send_static_file("service-worker.js")
