# BioVision IFFar

Projeto do BioVision para identificar especies a partir de imagens usando IA e exibir informacoes biologicas cadastradas em banco MySQL.

Este repositorio deve guardar o codigo do sistema, a estrutura do site, a configuracao de ambiente e a documentacao. Arquivos pesados ou sensiveis, como senhas, dumps completos do banco, datasets e pesos de modelos treinados, nao devem ser enviados diretamente para o GitHub.

## Estrutura de pastas

```text
biovision-iffar/
|-- app.py
|-- backend/
|   |-- biovision_web/
|   |   |-- __init__.py
|   |   |-- config.py
|   |   |-- db.py
|   |   |-- model_service.py
|   |   `-- routes.py
|   |-- data/
|   |   `-- class_index_corrigido.json
|   `-- wsgi.py
|-- web/
|   |-- templates/
|   `-- static_biovision/
|-- models/
|   `-- README.md
|-- database/
|-- training/
|-- docs/
|-- .env.example
|-- .gitignore
|-- .gitattributes
|-- requirements.txt
|-- SECURITY.md
`-- README.md
```

## O que cada pasta faz

### `backend/`

Contem o backend da aplicacao Flask. E aqui que ficam as rotas, a configuracao do sistema, a conexao com o banco e o codigo que chama o modelo de IA.

Arquivos principais:

- `backend/biovision_web/config.py`: le configuracoes por variaveis de ambiente, como senha do banco, porta da aplicacao e caminho do modelo.
- `backend/biovision_web/db.py`: faz a consulta no MySQL para buscar informacoes da especie identificada.
- `backend/biovision_web/model_service.py`: carrega o modelo de IA e executa a predicao da imagem.
- `backend/biovision_web/routes.py`: define as rotas do site, como `/biovision/`, `/biovision/identificar` e `/biovision/classificar`.
- `backend/data/class_index_corrigido.json`: mapeia o indice retornado pelo modelo para o nome da especie.

Quem mexe em logica de servidor, banco, rotas ou IA deve mexer principalmente em `backend/`.

### `web/`

Contem o site em si: paginas HTML, CSS, JavaScript, imagens, manifest e service worker.

Subpastas:

- `web/templates/`: arquivos HTML renderizados pelo Flask.
- `web/static_biovision/css/`: estilos do site.
- `web/static_biovision/js/`: scripts JavaScript do front-end.
- `web/static_biovision/icons/`: logos, icones e imagens usadas pelo site.
- `web/static_biovision/service-worker.js`: cache/offline/PWA.
- `web/static_biovision/manifest.json`: configuracao PWA do app.

Quem mexe no visual, telas, botoes, layout ou interacao do usuario deve mexer principalmente em `web/`.

### `models/`

Pasta reservada para colocar modelos localmente durante desenvolvimento ou deploy.

Importante: os arquivos reais de modelo nao devem ser enviados para o GitHub. Exemplos de arquivos que ficam fora do Git:

- `.keras`
- `.h5`
- `.ckpt`
- `.pt`
- `.pth`
- `.onnx`
- `.safetensors`

O backend procura o modelo pelo caminho configurado em `BIOVISION_MODEL_PATH`. Exemplo:

```env
BIOVISION_MODEL_PATH=models/modelo_01.keras
```

Se o modelo for muito grande, salve em um local externo seguro, como Google Drive, HD externo, servidor, Hugging Face ou GitHub Releases, e documente o link em `models/README.md`.

### `database/`

Pasta planejada para guardar somente a estrutura do banco, como schemas, migrations e scripts pequenos de criacao de tabelas.

Pode entrar no Git:

- `schema.sql`
- `migrations/`
- scripts sem dados sensiveis
- exemplos anonimizados

Nao deve entrar no Git:

- dump completo do banco com dados reais
- senhas
- credenciais
- dados sensiveis
- arquivos grandes como `dump.sql`

As credenciais do banco devem ficar no arquivo `.env` local, nunca no codigo.

### `training/`

Pasta planejada para os arquivos de treino da IA.

Minha recomendacao: subir para o GitHub o codigo de treino, mas nao subir os pesos treinados, checkpoints, dataset, logs ou ambiente virtual.

Pode entrar no Git:

- scripts de treino, como `train.py`
- codigo do modelo
- codigo do dataset/dataloader
- scripts de avaliacao
- scripts de predicao
- arquivos pequenos de configuracao
- README explicando como treinar

Nao deve entrar no Git:

- `venv/`
- `__pycache__/`
- `checkpoints/`
- `logs/`
- dataset de imagens
- `.ckpt`, `.pt`, `.pth`
- arquivos `.zip` de backup

Uma estrutura boa para o treino seria:

```text
training/
|-- README.md
|-- requirements-training.txt
|-- train.py
|-- evaluate.py
|-- predict.py
|-- biovision/
|   |-- config.py
|   |-- dataset.py
|   |-- model.py
|   `-- train.py
`-- shared/
    `-- class_index.json
```

Assim o grupo consegue reproduzir o treino sem colocar arquivos enormes no repositorio.

### `docs/`

Pasta opcional para documentacao do grupo.

Exemplos:

- explicacao do dataset
- nomes das especies
- decisao de arquitetura
- prints do sistema
- instrucoes para apresentacao
- resultados de treino
- links para modelos salvos fora do Git

### `app.py`

Arquivo de entrada da aplicacao. Ele cria o app Flask e inicia o servidor local.

Uso:

```bash
python app.py
```

### `.env.example`

Arquivo de exemplo com as variaveis de ambiente que cada pessoa precisa configurar localmente.

Cada integrante deve copiar esse arquivo para `.env`:

```bash
cp .env.example .env
```

Depois deve editar o `.env` com as configuracoes reais da propria maquina.

### `.gitignore`

Define o que o Git deve ignorar. Ele protege o projeto contra envio acidental de:

- senhas
- `.env`
- modelos treinados
- datasets
- dumps de banco
- logs
- cache Python
- ambientes virtuais

### `.gitattributes`

Configura tipos de arquivos que, se forem usados no futuro, devem ir pelo Git LFS. Mesmo assim, a preferencia e nao versionar modelos grandes diretamente no repositorio principal.

### `SECURITY.md`

Documento com regras de seguranca do projeto. Deve ser lido antes de qualquer pessoa subir alteracoes envolvendo banco, credenciais, dataset ou modelo.

## Configuracao local

1. Crie o ambiente virtual:

```bash
python -m venv .venv
```

2. Ative o ambiente:

No Linux/WSL:

```bash
source .venv/bin/activate
```

No Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

3. Instale as dependencias:

```bash
pip install -r requirements.txt
```

4. Copie o arquivo de configuracao:

```bash
cp .env.example .env
```

5. Configure o `.env`:

```env
BIOVISION_APP_HOST=0.0.0.0
BIOVISION_APP_PORT=5001
BIOVISION_DEBUG=false

BIOVISION_DB_HOST=localhost
BIOVISION_DB_PORT=3307
BIOVISION_DB_USER=root
BIOVISION_DB_PASSWORD=sua-senha-local
BIOVISION_DB_NAME=biovision_especie

BIOVISION_MODEL_PATH=models/modelo_01.keras
BIOVISION_CLASS_INDEX_PATH=backend/data/class_index_corrigido.json
```

6. Coloque o modelo localmente no caminho configurado.

Exemplo:

```text
models/modelo_01.keras
```

7. Execute:

```bash
python app.py
```

8. Acesse:

```text
http://localhost:5001/biovision/
```

## Banco de dados

O projeto espera um banco MySQL com uma tabela de especies. O backend consulta a tabela usando o nome da especie previsto pela IA.

As credenciais ficam no `.env`:

```env
BIOVISION_DB_HOST=localhost
BIOVISION_DB_PORT=3307
BIOVISION_DB_USER=root
BIOVISION_DB_PASSWORD=sua-senha-local
BIOVISION_DB_NAME=biovision_especie
```

Nunca coloque senha diretamente no codigo. Se for necessario compartilhar o banco com o grupo, compartilhe por um canal seguro e troque a senha se ela ja tiver sido publicada em algum commit antigo.

## Modelo de IA

O site atualmente carrega um modelo no formato Keras, configurado por:

```env
BIOVISION_MODEL_PATH=models/modelo_01.keras
```

Se o grupo quiser usar um modelo PyTorch treinado em `.ckpt`, sera necessario adaptar o `backend/biovision_web/model_service.py`, porque `.ckpt` nao e carregado diretamente pelo TensorFlow/Keras.

Regra pratica:

- Codigo do modelo e do treino: pode ir para o Git.
- Modelo treinado pesado: nao vai direto para o Git.
- Dataset: nao vai para o Git.
- Resultados/metricas pequenas: podem ir para `docs/`.

## O que subir para o GitHub

Subir:

- codigo do backend
- codigo do frontend
- scripts de treino
- configs de exemplo
- documentacao
- schemas pequenos do banco
- imagens pequenas usadas pelo site
- `class_index` se nao tiver dado sensivel

Nao subir:

- `.env`
- senhas
- dumps reais do banco
- dataset de imagens
- modelos treinados grandes
- checkpoints
- logs de treino grandes
- `venv/`
- `__pycache__/`
- arquivos temporarios

## Observacao de seguranca

Se alguma senha ja foi enviada para o GitHub em commits antigos, remover do arquivo atual nao e suficiente. Nesse caso, o correto e:

1. trocar a senha no banco;
2. remover o segredo do historico do Git;
3. garantir que `.env` esta no `.gitignore`;
4. subir apenas o codigo limpo.

## Resumo para o grupo

- Vai mexer no site? Use `web/`.
- Vai mexer nas rotas, banco ou IA do Flask? Use `backend/`.
- Vai mexer no treino da IA? Use `training/`.
- Vai mexer no banco? Documente em `database/`, mas sem dump real e sem senha.
- Vai colocar modelo treinado? Use `models/` localmente, mas nao envie o arquivo pesado para o Git.
- Vai configurar senha/porta/caminho do modelo? Use `.env`, nunca o codigo.
