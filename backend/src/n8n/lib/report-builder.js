/**
 * report-builder.js
 *
 * Monta o modelo final do relatório financeiro PRN a partir dos dados
 * normalizados e dos cálculos financeiros produzidos pelos módulos anteriores.
 *
 * Este módulo é consumido pelo html-renderer.js para gerar a página HTML final.
 *
 * Contrato de entrada:
 *   requestInfo: {
 *     requestId:            string  — identificador único da requisição (UUID)
 *     referenceDateUsed:    string  — data de referência no formato "YYYY-MM-DD"
 *     dailyFilename:        string  — nome do arquivo Excel diário processado
 *     historyFilename:      string  — nome do arquivo Excel histórico processado
 *     dailySheetsFound:    string[] — nomes das abas encontradas no arquivo diário
 *     historySheetsFound:  string[] — nomes das abas encontradas no arquivo histórico
 *   }
 *
 *   normalizedData: {
 *     entities: [ ... ],   — lista de entidades normalizadas (PRN MATRIZ, PRN LOCAÇÃO, etc.)
 *     expenses: [ ... ],   — lista de despesas normalizadas
 *     receipts: [ ... ],   — lista de recebidos normalizados
 *     balances: [ ... ],   — lista de saldos normalizados
 *     warnings: [ ... ]    — avisos produzidos durante a normalização
 *   }
 *
 *   financials: {
 *     totalDespesas:           number — soma de todas as despesas
 *     totalRecebido:           number — soma de todos os recebidos
 *     saldoBancario:           number — saldo total em contas bancárias
 *     saldoAplicacoes:         number — saldo total em aplicações financeiras
 *     transferenciaNecessaria: number — valor necessário de transferência entre contas
 *     historyAnalysis: {       object — análise consolidada do histórico
 *       totalRecords:    number
 *       totalPago:        number
 *       totalAtrasado:    number
 *       period:           { start: string, end: string }
 *       topCategorias:    [ { categoria: string, total: number, count: number } ]
 *       topFornecedores:  [ { fornecedor: string, total: number, count: number } ]
 *       distribuicaoContas:[ { conta: string, total: number, percentual: number } ]
 *     }
 *     warnings: [ ... ]    — avisos produzidos durante os cálculos financeiros
 *   }
 *
 * Retorno:
 *   Objeto completo do relatório seguindo o schemaVersion 1.
 */

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Normaliza um valor numérico para dois decimais.
 * Se o valor for null, undefined ou NaN, retorna 0.
 *
 * @param {*} value — valor a normalizar
 * @returns {number} valor numérico com duas casas decimais
 */
function _normalizeNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? parseFloat(num.toFixed(2)) : 0;
}

/**
 * Mescla duas listas de warnings em uma única lista, deduplicando por
 * combinação de "code" + "message" (case-insensitive).
 * Cada warning deve ter a estrutura: { code, severity, message, [context] }
 *
 * @param {Array} listA — primeira lista de warnings
 * @param {Array} listB — segunda lista de warnings
 * @returns {Array} lista mesclada sem duplicatas
 */
function _mergeWarnings(listA, listB) {
  const a = Array.isArray(listA) ? listA : [];
  const b = Array.isArray(listB) ? listB : [];

  const seen = new Set();
  const merged = [];

  for (const w of [...a, ...b]) {
    if (!w || !w.message) continue;
    const key = `${String(w.code || '').toLowerCase()}|${String(w.message).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      code: String(w.code || 'UNKNOWN'),
      severity: String(w.severity || 'info').toLowerCase(),
      message: String(w.message),
      context: w.context || undefined,
      source: w.source || undefined,
    });
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------

/**
 * Monta o modelo completo do relatório financeiro PRN.
 *
 * @param {object} requestInfo   — metadados da requisição
 * @param {object} normalizedData — dados normalizados pelo módulo normalizer
 * @param {object} financials     — cálculos financeiros pelo módulo financial-calculator
 * @returns {object} modelo do relatório (schemaVersion 1)
 */
function buildReportModel(requestInfo, normalizedData, financials) {
  const info = requestInfo || {};
  const norm = normalizedData || {};
  const fin = financials || {};

  // -- Normaliza os campos obrigatórios do requestInfo --
  const requestId = String(info.requestId || 'unknown');
  const referenceDateUsed = String(info.referenceDateUsed || '');
  const dailyFilename = String(info.dailyFilename || 'N/A');
  const historyFilename = String(info.historyFilename || 'N/A');
  const dailySheetsFound = Array.isArray(info.dailySheetsFound)
    ? [...info.dailySheetsFound]
    : [];
  const historySheetsFound = Array.isArray(info.historySheetsFound)
    ? [...info.historySheetsFound]
    : [];

  // -- Extrai os arrays de dados normalizados (garante que sejam arrays) --
  const entities = Array.isArray(norm.entities) ? [...norm.entities] : [];
  const expenses = Array.isArray(norm.expenses) ? [...norm.expenses] : [];
  const receipts = Array.isArray(norm.receipts) ? [...norm.receipts] : [];
  const balances = Array.isArray(norm.balances) ? [...norm.balances] : [];

  // -- Extrai os valores financeiros calculados --
  // Compatível com ambas estruturas:
  // 1) fin.summary.totalDespesas
  // 2) fin.totalDespesas (legado)
  const finSummary = fin.summary || {};
  const totalDespesas = _normalizeNumber(
    finSummary.totalDespesas !== undefined ? finSummary.totalDespesas : fin.totalDespesas
  );
  const totalRecebido = _normalizeNumber(
    finSummary.totalRecebido !== undefined ? finSummary.totalRecebido : fin.totalRecebido
  );
  const saldoBancario = _normalizeNumber(
    finSummary.saldoBancario !== undefined ? finSummary.saldoBancario : fin.saldoBancario
  );
  const transferenciaNecessaria = _normalizeNumber(
    finSummary.transferenciaNecessaria !== undefined
      ? finSummary.transferenciaNecessaria
      : fin.transferenciaNecessaria
  );

  // -- Extrai a análise de histórico --
  const history = fin.historyAnalysis || {};

  // -- Extrai agregacoes calculadas para facilitar consumo em dashboards --
  const topDespesas = Array.isArray(fin.topDespesas) ? [...fin.topDespesas] : [];
  const despesasPorCategoria = Array.isArray(fin.despesasPorCategoria) ? [...fin.despesasPorCategoria] : [];
  const recebidosPorConta = Array.isArray(fin.recebidosPorConta) ? [...fin.recebidosPorConta] : [];

  // -- Extrai o cruzamento diária x histórico (foco inicial do usuário) --
  const crossAnalysis = fin.crossAnalysis || {
    months: [],
    rows: [],
    config: {
      divergenceThresholdPct: 25,
      minMonthsForExactAnalysis: 2,
      divergenceBase: 'media_historica_mensal_com_pagamento',
    },
    totalNomesDia: 0,
    totalValorDia: 0,
    totalHistoricoCruzado: 0,
    groups: {
      comHistorico: { totalNomes: 0, totalValorDia: 0, totalHistorico: 0, rows: [] },
      semHistorico: { totalNomes: 0, totalValorDia: 0, totalHistorico: 0, rows: [] },
      exatoTodosMeses: { totalNomes: 0, totalValorDia: 0, totalHistorico: 0, rows: [] },
      diferenteEntreMeses: { totalNomes: 0, totalValorDia: 0, totalHistorico: 0, rows: [] },
      alertaAnaliseManual: { totalNomes: 0, totalValorDia: 0, totalHistorico: 0, rows: [] },
    },
  };

  // -- Mescla warnings de ambas as fontes --
  const warnings = _mergeWarnings(norm.warnings, fin.warnings);

  // -- Coleta erros (se houver campo errors em qualquer fonte) --
  const errors = [];
  const normErrors = Array.isArray(norm.errors) ? norm.errors : [];
  const finErrors = Array.isArray(fin.errors) ? fin.errors : [];
  for (const e of [...normErrors, ...finErrors]) {
    if (e && e.message) {
      errors.push({
        code: String(e.code || 'UNKNOWN'),
        severity: String(e.severity || 'high').toLowerCase(),
        message: String(e.message),
        context: e.context || undefined,
        source: e.source || undefined,
      });
    }
  }

  // -- Determina o status do relatório --
  let status = 'success';
  if (errors.length > 0) {
    status = 'error';
  } else if (warnings.length > 0) {
    status = 'warning';
  }

  // -- Monta o objeto final --
  const reportModel = {
    schemaVersion: 1,
    status,
    requestId,
    referenceDateUsed,
    request: {
      scope: 'prn',
      dailyFilename,
      historyFilename,
      dailySheetsFound,
      historySheetsFound,
    },
    summary: {
      totalDespesas,
      totalRecebido,
      saldoBancario,
      transferenciaNecessaria,
    },
    entities,
    expenses,
    receipts,
    balances,
    topDespesas,
    despesasPorCategoria,
    recebidosPorConta,
    history,
    crossAnalysis,
    warnings,
    errors,
  };

  return reportModel;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = { buildReportModel };
