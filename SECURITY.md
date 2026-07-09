# Seguranca

## Segredos

Este repositorio nao deve conter:

- senhas de banco;
- tokens;
- arquivos `.env`;
- dumps SQL;
- modelos treinados;
- datasets;
- checkpoints.

Use `.env.example` como modelo e mantenha o `.env` apenas localmente.

## Senha exposta anteriormente

Uma credencial de banco estava hardcoded no `app.py`. O codigo atual removeu a credencial do arquivo, mas isso nao invalida a senha que ja foi publicada em commits antigos.

Antes de subir ou tornar o repositorio confiavel:

1. troque a senha no MySQL;
2. atualize apenas o `.env` local/servidor;
3. reescreva ou limpe o historico do Git remoto se o repositorio ficar publico;
4. force push apenas depois de alinhar com quem usa o repositorio.

## Artefatos grandes

Modelos e dumps devem ir para armazenamento de artefatos, nao para o historico Git comum.
