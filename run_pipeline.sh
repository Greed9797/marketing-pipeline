#!/bin/bash

# Pipeline de Automação de Conteúdo — Empreendedorismo + Ecommerce
# Executa os 4 agentes em sequência com pausa para revisão entre cada um.

PIPELINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pasta de saída com data: busca_DD_MM_YYYY
DATA_PASTA=$(date +"%d_%m_%Y")
OUTPUT_DIR="$PIPELINE_DIR/outputs/busca_$DATA_PASTA"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ask_continue() {
  echo ""
  echo -e "${YELLOW}Deseja continuar para o próximo agente? (s/n)${NC}"
  read -r resposta
  if [[ "$resposta" != "s" && "$resposta" != "S" ]]; then
    echo "Pipeline pausado. Retome quando quiser."
    exit 0
  fi
}

# Cria a pasta do ciclo de hoje
mkdir -p "$OUTPUT_DIR"

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  PIPELINE DE MARKETING — EMPREENDEDORISMO  ${NC}"
echo -e "${CYAN}  Ciclo: busca_$DATA_PASTA                  ${NC}"
echo -e "${CYAN}  Pasta: outputs/busca_$DATA_PASTA          ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ──────────────────────────────────────────
# AGENTE 1: RESEARCHER
# ──────────────────────────────────────────
echo -e "${GREEN}[1/4] Iniciando Researcher...${NC}"
echo "Output: $OUTPUT_DIR/topics.json"
echo ""
claude --model claude-sonnet-4-6 \
  "$(cat "$PIPELINE_DIR/agents/researcher.md")

Salve o resultado em: $OUTPUT_DIR/topics.json"

echo ""
echo -e "${GREEN}Output salvo em: outputs/busca_$DATA_PASTA/topics.json${NC}"
ask_continue

# ──────────────────────────────────────────
# AGENTE 2: IDEATOR
# ──────────────────────────────────────────
echo ""
echo -e "${GREEN}[2/4] Iniciando Ideator...${NC}"
echo "Output: $OUTPUT_DIR/angles.json"
echo ""
claude --model claude-sonnet-4-6 \
  "$(cat "$PIPELINE_DIR/agents/ideator.md")

Conteúdo atual de topics.json:
$(cat "$OUTPUT_DIR/topics.json")

Salve o resultado em: $OUTPUT_DIR/angles.json"

echo ""
echo -e "${GREEN}Output salvo em: outputs/busca_$DATA_PASTA/angles.json${NC}"
ask_continue

# ──────────────────────────────────────────
# AGENTE 3: SCRIPTER
# ──────────────────────────────────────────
echo ""
echo -e "${GREEN}[3/4] Iniciando Scripter...${NC}"
echo "Output: $OUTPUT_DIR/scripts.json"
echo ""
claude --model claude-sonnet-4-6 \
  "$(cat "$PIPELINE_DIR/agents/scripter.md")

Conteúdo atual de angles.json:
$(cat "$OUTPUT_DIR/angles.json")

Salve o resultado em: $OUTPUT_DIR/scripts.json"

echo ""
echo -e "${GREEN}Output salvo em: outputs/busca_$DATA_PASTA/scripts.json${NC}"
ask_continue

# ──────────────────────────────────────────
# AGENTE 4: ANALYST  (opcional — rodar às segundas)
# ──────────────────────────────────────────
echo ""
echo -e "${GREEN}[4/4] Iniciando Analyst...${NC}"
echo "Output: $OUTPUT_DIR/relatorio_semana_$DATA_PASTA.md"
echo ""
claude --model claude-sonnet-4-6 \
  "$(cat "$PIPELINE_DIR/agents/analyst.md")

Salve o relatório em: $OUTPUT_DIR/relatorio_semana_$DATA_PASTA.md"

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  PIPELINE CONCLUÍDO!                       ${NC}"
echo -e "${CYAN}  Arquivos em: outputs/busca_$DATA_PASTA/   ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
