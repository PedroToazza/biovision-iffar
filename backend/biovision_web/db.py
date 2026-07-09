import base64

import mysql.connector


def buscar_informacoes_especie(nome_especie: str, db_config: dict):
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM especie WHERE especie = %s", (nome_especie,))
        resultado = cursor.fetchone()

        cursor.close()
        conn.close()

        if resultado:
            for chave, valor in resultado.items():
                if isinstance(valor, (bytes, bytearray)):
                    resultado[chave] = base64.b64encode(valor).decode("utf-8")

        return resultado
    except Exception as exc:
        print(f"Erro ao consultar banco de dados: {exc}")
        return None
