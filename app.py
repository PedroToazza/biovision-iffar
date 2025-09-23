import os
import json
import numpy as np
from flask import Flask, render_template, request, jsonify
from keras.models import load_model
from PIL import Image
import io
import base64
import mysql.connector  # 👈 para conectar ao MySQL

# --- CONFIGURAÇÕES ---
base_dir = os.path.dirname(os.path.abspath(__file__))
caminho_modelo = os.path.join(base_dir, "modelo_01.keras")
caminho_classes_json = os.path.join(base_dir, "class_index_corrigido.json")

# Inicializar Flask
app = Flask(__name__)


db_config = {
    "host": "localhost",
    "user": "root",
    "password": "Jvt16pht",
    "database": "biovision_especie"
}


def buscar_informacoes_especie(nome_especie):
    """Busca todas as informações da espécie no MySQL"""
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = "SELECT * FROM especie WHERE especie = %s"
        cursor.execute(query, (nome_especie,))
        resultado = cursor.fetchone()

        cursor.close()
        conn.close()

        if resultado:
            # Converter colunas BLOB em base64 (para exibir imagens no JSON/HTML)
            for chave, valor in resultado.items():
                if isinstance(valor, (bytes, bytearray)):
                    resultado[chave] = base64.b64encode(valor).decode("utf-8")

        return resultado
    except Exception as e:
        print(f"Erro no MySQL: {e}")
        return None

def carregar_nomes_classes(caminho_json):
    try:
        with open(caminho_json, "r", encoding="utf-8") as f:
            idx_to_class = json.load(f)
            return [idx_to_class[str(i)] for i in range(len(idx_to_class))]
    except FileNotFoundError:
        return None

# Carregar modelo treinado
try:
    modelo = load_model(caminho_modelo)
    print("✅ Modelo carregado com sucesso!")
except Exception as e:
    print(f"Erro ao carregar o modelo: {e}")
    modelo = None

# Carregar nomes das classes
class_names = carregar_nomes_classes(caminho_classes_json)
if class_names is None:
    print("❌ Arquivo de classes não encontrado.")
    exit()

def carregar_e_preparar_imagem(imagem_bytes):
    """Prepara a imagem para classificação"""
    img = Image.open(io.BytesIO(imagem_bytes)).convert("RGB")
    img_redimensionada = img.resize((224, 224))
    img_array = np.array(img_redimensionada)
    img_array = np.expand_dims(img_array, axis=0).astype("float32")
    return img_array

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/classificar", methods=["POST"])
def classificar():
    if "imagem" not in request.files:
        return jsonify({"erro": "Imagem não enviada"}), 400

    arquivo_imagem = request.files["imagem"]
    if arquivo_imagem.filename == "":
        return jsonify({"erro": "Nenhuma imagem selecionada"}), 400

    # Preparar imagem
    imagem_bytes = arquivo_imagem.read()
    img_array = carregar_e_preparar_imagem(imagem_bytes)

    # Fazer predição
    if modelo is None:
        return jsonify({"erro": "Modelo não carregado"}), 500

    predicao = modelo.predict(img_array)
    classe_predita_idx = np.argmax(predicao)
    confianca = float(np.max(predicao) * 100)
    keyword = class_names[classe_predita_idx]

    # Buscar infos no banco
    dados_mysql = buscar_informacoes_especie(keyword)

    if not dados_mysql:
        return jsonify({
            "keyword": keyword,
            "confidence": confianca,
            "dados_taxon": None,
            "erro": "Espécie não encontrada no banco de dados"
        })

    return jsonify({
        "keyword": keyword,
        "confidence": confianca,
        "dados_taxon": dados_mysql
    })

# 🔹 Rota para o service worker
@app.route("/service-worker.js")
def service_worker():
    return app.send_static_file("service-worker.js")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
