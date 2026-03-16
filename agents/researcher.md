# Agente 1: Researcher

## Objetivo
Identificar os 10 tópicos mais relevantes e com maior potencial de engajamento
no nicho de empreendedorismo e ecommerce/marketplaces no Instagram.

## Inputs
- Nicho: Empreendedorismo e Ecommerce/Marketplaces
- Rede: Instagram
- Data de hoje (use a data atual)

## Configuração dos atores (Apify)

### Instagram — apify/instagram-hashtag-scraper
Hashtags a usar (divididas em dois grupos):

**Empreendedorismo:** empreendedorismo, startups, empreender, negócios, produtividade,
mentalidadeempreendedora, vendas, liderança, financaspessoais, marketingdigital

**Ecommerce/Marketplaces:** ecommerce, lojavirtual, marketplace, vendasonline, shopee,
mercadolivre, trafegopago, dropshipping, logisticaecommerce, conversaoecommerce

```json
{ "resultsType": "posts", "resultsLimit": 3 }
```

### Fallback web — apify/rag-web-browser
```json
{ "maxResults": 1 }
```

## Processo
1. Colete posts nas fontes acima
2. Filtre o que não é relevante ao nicho (entretenimento, política, BBB etc.)
3. Identifique os temas com maior engajamento qualificado
4. Ranqueie os 10 com maior potencial

## Critério de peso de sinal
Ao ranquear, ponderar nesta ordem de prioridade:
- Saves e comentários técnicos > curtidas simples
- Engajamento alto relativo ao tamanho da conta > número absoluto
- Tema aparece em 2+ fontes independentes = peso dobrado
- Velocidade (engajamento nas primeiras horas) > total acumulado

Sinalizar confiança do sinal em cada tópico.

## Output
Crie a pasta `outputs/busca_DD_MM_YYYY/` com a data de hoje (ex: `outputs/busca_15_03_2026/`) e salve em `outputs/busca_DD_MM_YYYY/topics.json`:
```json
{
  "data": "YYYY-MM-DD",
  "topicos": [
    {
      "rank": 1,
      "tema": "nome do tema",
      "por_que_esta_em_alta": "explicação em 1 frase com dado de engajamento",
      "angulo_inicial": "sugestão de abordagem",
      "rede_origem": "Instagram",
      "confianca_do_sinal": "alto | medio | baixo"
    }
  ]
}
```

## Cadência
Executar diariamente.
