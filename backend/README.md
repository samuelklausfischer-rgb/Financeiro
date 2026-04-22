# PRN Financial Report - n8n Automation

## Visao Geral

Automacao financeira para PRN (PRN MATRIZ, PRN LOCAÇÃO, PRN HOLDING) rodando dentro do n8n.
O usuario (ou frontend externo) envia 1 planilha diaria e 1 planilha historica consolidada e recebe um payload JSON estruturado para montar dashboard.

## Arquitetura

```
Usuario -> GET /prn/app (formulario HTML legado)
       -> POST /prn/report (planilhas + processamento)
       <- Payload JSON estruturado
```

## Estrutura do Projeto

```
prn-reporting/
  spec/
    contracts.json      # Contratos de entrada/saida
    aliases.json         # Mapas de normalizacao
    warnings.json        # Taxonomia de warnings/erros
  src/
    templates/
      form.html          # Template do formulario de upload
      error.js           # Funcao de renderizacao de erros
    n8n/
      lib/
        parser-daily.js      # Parser da planilha diaria
        parser-history.js    # Parser da planilha historica
        normalizer.js        # Normalizacao de dados
        calculator.js        # Motor financeiro
        report-builder.js    # Montagem do modelo do relatorio
        html-renderer.js     # Renderizacao HTML do relatorio
      workflows/
        WF-PRN-MAIN-v4.json  # Workflow principal importavel no n8n (robusto para Cloud + extrator XLSX)
  fixtures/
    valid/
    invalid/
```

## Como Importar no n8n

1. Abra seu n8n
2. Va em **Workflows** > **Import from File**
3. Selecione `src/n8n/workflows/WF-PRN-MAIN-v4.json`
4. O workflow sera importado com `active: false`
5. Abra o workflow e verifique os nodes
6. Ative o workflow

## Endpoints

| Metodo | Path         | Funcao                              |
|--------|-------------|-------------------------------------|
| GET    | /prn/app    | Formulario de upload                |
| POST   | /prn/report | Processamento + payload JSON para dashboard |

## Observacao n8n Cloud

- O formulario HTML da versao `v3` envia upload por **submit nativo** (sem `fetch`).
- A URL de envio esta fixa em: `https://prndiag1.app.n8n.cloud/webhook/prn/report`
- O endpoint de processamento retorna `application/json` para consumo por frontend externo.

## Observacao versao v4

- A versao `v4` remove a leitura via `require('xlsx')` no Code node.
- A leitura de planilhas usa node nativo `Extract From File` (operacao `xlsx`).
- Abas configuradas: `Contas`, `Recebido`, `Resumo`, `financas`.

## Entrada

| Campo           | Tipo   | Obrigatorio | Descricao                     |
|-----------------|--------|-------------|-------------------------------|
| daily_file      | xlsx   | Sim         | Planilha diaria               |
| historical_file | xlsx   | Sim         | Planilha historica PRN (pode ser consolidada a partir de múltiplos arquivos) |
| reference_date  | date   | Nao         | Data de referencia (YYYY-MM-DD)|

## Abas Esperadas

### Planilha Diaria
- **Contas**: Despesas (bloco PRN MATRIZ detectado por marcador textual)
- **Recebido**: Recebimentos (filtrado por entidade PRN)
- **Resumo**: Valores consolidados (usado para cross-check, nao como fonte principal)

### Planilha Historica
- **financas**: Dados do OMIE (3 linhas de cabecalho + dados)

### Consolidacao de Historicos
- Quando houver mais de uma planilha historica, o frontend pode consolidar varias abas `financas` em um unico workbook antes do envio ao webhook.
- O contrato do n8n permanece com um unico `historical_file`, mas esse arquivo pode representar a uniao de varios historicos de origem.

## Modulos de Lógica

### parser-daily.js
- Detecta bloco PRN MATRIZ por texto, nao por celula fixa
- Mapeia colunas por keywords no cabecalho
- Para em blocos de outras empresas (Camboriú, Palhoça)
- Cross-check com Resumo

### parser-history.js
- Pula 3 linhas de cabecalho
- Mapeia 8 colunas por índice fixo
- Detecta datas anomalias (ano fora do range esperado)
- Trata numeros no formato brasileiro

### normalizer.js
- Normaliza entidades, contas, categorias e status
- ~200+ variantes de aliases cobertos
- Filtra recebimentos apenas PRN
- Gera warnings para aliases desconhecidos

### calculator.js
- Calcula totais, saldos, top despesas
- Agrupa por categoria e conta corrente
- Analisa historico (pago, atrasado, fornecedores)
- Alerta sobre receita inferior a despesas

### report-builder.js
- Monta modelo final do relatorio
- Determina status (success/warning/error)
- Deduplica warnings

### html-renderer.js
- HTML 100% inline, sem CDN
- Responsivo, print-friendly
- Tabelas ordenáveis no cliente
- Formato BRL, datas DD/MM/YYYY

## Criterios do Relatorio / Payload

- Resumo financeiro (5 cards)
- Entidades PRN (MATRIZ, LOCACAO, HOLDING)
- Tabela de despesas
- Tabela de recebidos
- Top 10 despesas
- Despesas por categoria
- Recebidos por conta
- Historico PRN
- Warnings e alertas

## Formato de resposta (v4 atual)

Resposta de sucesso (`HTTP 200`):

```json
{
  "ok": true,
  "schemaVersion": 1,
  "type": "prn_dashboard_payload",
  "status": "success|warning|error",
  "requestId": "uuid",
  "referenceDateUsed": "YYYY-MM-DD",
  "generatedAt": "ISO_DATETIME",
  "request": { "...": "metadados de arquivos" },
  "summary": { "...": "cards financeiros" },
  "dashboard": { "...": "blocos otimizados para cards/tabelas" },
  "data": { "...": "listas completas para drill-down" },
  "warnings": [],
  "errors": [],
  "meta": { "requestId": "uuid", "httpStatus": 200 }
}
```

Resposta de erro (`HTTP 4xx/5xx`):

```json
{
  "ok": false,
  "schemaVersion": 1,
  "error": {
    "code": "VALIDATION_ERROR|PROCESSING_ERROR|...",
    "message": "mensagem amigavel",
    "details": { "...": "contexto" }
  },
  "meta": {
    "requestId": "uuid",
    "generatedAt": "ISO_DATETIME",
    "httpStatus": 400
  }
}
```

## Proximos Passos (Fora da V1)

- [ ] Google Drive para armazenamento dos arquivos
- [ ] Supabase para metadados, auditoria e replay
- [ ] Autenticacao na pagina
- [ ] Historico de execucoes para o usuario
- [ ] Exportacao PDF
- [ ] Multiempresa (Camboriú, Palhoça)
- [ ] Dashboard operacional
