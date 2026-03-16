# Dashboard — Pipeline de Marketing @leonardo_ames

Interface web para executar os agentes e visualizar os resultados em tempo real.

## Pré-requisitos

- Python 3.8+
- Claude Code CLI instalado e autenticado (`claude` disponível no PATH)

## Instalação

```bash
pip install flask flask-cors
```

## Iniciar

Execute a partir da raiz do projeto `marketing-pipeline/`:

```bash
python frontend/server.py
```

Acesse: **http://localhost:5050**

## Como usar

### Executar o pipeline

1. Na aba **Visão Geral**, clique **▶ Executar** no card do **Researcher**
2. Aguarde o log de execução completar (pode levar alguns minutos)
3. Os tópicos aparecem automaticamente na aba **Tópicos**
4. Repita para **Ideator** → aba Ângulos
5. Repita para **Scripter** → aba Roteiros
6. **Analyst**: execute toda segunda-feira — um modal pedirá as métricas da semana antes de rodar

### Abas

| Aba | Conteúdo |
|-----|----------|
| Visão Geral | Status dos 4 agentes, KPIs, log de execução em tempo real |
| Tópicos | 10 tópicos ranqueados do ciclo atual, com filtros por sinal e rede |
| Ângulos | ~35 ângulos de conteúdo com gancho, rede e formato recomendados |
| Roteiros | Roteiros completos expansíveis (gancho, desenvolvimento, CTA, visual) |

### Ciclos datados

Cada execução do Researcher cria (ou usa) a pasta `outputs/busca_DD_MM_YYYY/`.
O dashboard sempre lê a pasta mais recente automaticamente.

## Estrutura dos arquivos

```
frontend/
├── server.py    ← Backend Flask (porta 5050)
├── index.html   ← Interface principal
├── style.css    ← Estilos
├── app.js       ← Lógica JS
└── README.md    ← Este arquivo
```
