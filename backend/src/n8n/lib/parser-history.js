/**
 * parser-history.js
 *
 * Parses the historical financial spreadsheet ("financas" sheet) from OMIE.
 *
 * Expected workbook structure (object with sheet names as keys):
 *   {
 *     "financas": [
 *       [row0_header],   // row 1 — main header (merged cells, labels)
 *       [row1_header],   // row 2 — sub-header
 *       [row2_header],   // row 3 — sub-header
 *       [row3_data],     // row 4 — first data row
 *       ...
 *     ]
 *   }
 *
 * Column map (0-indexed, based on real sample inspection):
 *   0  – Situação          (payment status: Pago, Atrasado, Pago Parcialmente, …)
 *   3  – Fornecedor        (vendor / payee name)
 *   4  – Previsão          (forecast date, may be datetime string)
 *   5  – Último Pagamento  (last payment date, datetime string)
 *   7  – Valor Líquido     (net value, numeric or numeric string)
 *  10  – Categoria          (expense / revenue category)
 *  14  – Conta Corrente     (bank account)
 *  16  – Vencimento         (due date, datetime string)
 *
 * Returned parsed row shape:
 *   {
 *     situacao:        string,
 *     fornecedor:      string,
 *     previsao:        "YYYY-MM-DD" | null,
 *     ultimoPagamento: "YYYY-MM-DD" | null,
 *     valorLiquido:    number,
 *     categoria:       string,
 *     contaCorrente:   string,
 *     vencimento:      "YYYY-MM-DD" | null
 *   }
 *
 * Return value:
 *   { rows: ParsedRow[], summary: Summary, warnings: string[] }
 */

"use strict";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of header rows at the top of the sheet that must be skipped. */
const HEADER_ROW_COUNT = 3;

/** Column indices (0-based) for each field in the raw spreadsheet rows. */
const COL = Object.freeze({
  SITUACAO:         0,
  FORNECEDOR:       3,
  PREVISAO:         4,
  ULTIMO_PAGAMENTO: 5,
  VALOR_LIQUIDO:    7,
  CATEGORIA:       10,
  CONTA_CORRENTE:  14,
  VENCIMENTO:      16,
});

/**
 * If any parsed date's year falls outside this window we emit a warning.
 * The sample data spans 2026-01 through 2026-03, so a 5-year window is generous.
 */
const EXPECTED_YEAR_MIN = 2020;
const EXPECTED_YEAR_MAX = 2035;

/** Date regex that matches "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" (ISO-ish). */
const ISO_DATE_RE = /^\s*(\d{4})-(\d{2})-(\d{2})(?:\s+\d{2}:\d{2}(?::\d{2})?)?\s*$/;

/**
 * Serial number epoch for Excel / LibreOffice date handling.
 * Both treat 1900-01-01 as serial day 1 (with the intentional Lotus 1-2-3
 * leap-year bug where 1900-02-29 is considered valid, making day 60 = 1900-02-29
 * and day 61 = 1900-03-01).
 */
const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30 00:00 UTC
const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to parse a value that may be a Date object, an Excel serial number,
 * or an ISO-like string into "YYYY-MM-DD".
 *
 * @param {*} raw
 * @returns {{ iso: string | null, warning: string | null }}
 */
function parseDateValue(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { iso: null, warning: null };
  }

  // 1. Native Date object (already decoded by the spreadsheet reader).
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) {
      return { iso: null, warning: `Invalid Date object: ${raw}` };
    }
    const iso = formatDate(raw);
    return validateDateRange(iso);
  }

  // 2. Excel / LibreOffice serial number (integer or float).
  if (typeof raw === "number" && isFinite(raw) && raw > 0) {
    const date = new Date(EXCEL_EPOCH.getTime() + raw * MS_PER_DAY);
    if (isNaN(date.getTime())) {
      return { iso: null, warning: `Invalid serial number date: ${raw}` };
    }
    const iso = formatDate(date);
    return validateDateRange(iso);
  }

  // 3. String — try ISO "YYYY-MM-DD [HH:mm:ss]" pattern.
  if (typeof raw === "string") {
    const str = raw.trim();
    if (str === "") {
      return { iso: null, warning: null };
    }

    const match = str.match(ISO_DATE_RE);
    if (match) {
      const [, yearStr, monthStr, dayStr] = match;
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;   // 0-based
      const day = Number(dayStr);

      const date = new Date(Date.UTC(year, month, day));
      if (isNaN(date.getTime())) {
        return { iso: null, warning: `Unparseable date string: "${str}"` };
      }

      const iso = `${yearStr}-${monthStr}-${dayStr}`;
      return validateDateRange(iso);
    }

    // Fallback: let the JS engine try (handles "MM/DD/YYYY", "DD/MM/YYYY", etc.).
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) {
      const iso = formatDate(fallback);
      return validateDateRange(iso);
    }

    return { iso: null, warning: `Unparseable date string: "${str}"` };
  }

  return { iso: null, warning: `Unsupported date type: ${typeof raw}` };
}

/**
 * Format a Date object to "YYYY-MM-DD".
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Check whether a date string is within a reasonable year range.
 * @param {string} iso
 * @returns {{ iso: string | null, warning: string | null }}
 */
function validateDateRange(iso) {
  const year = Number(iso.slice(0, 4));

  if (year < EXPECTED_YEAR_MIN || year > EXPECTED_YEAR_MAX) {
    const warning =
      `Date "${iso}" is far outside the expected range ` +
      `(${EXPECTED_YEAR_MIN}–${EXPECTED_YEAR_MAX}). Possible data error.`;
    return { iso, warning };
  }

  return { iso, warning: null };
}

/**
 * Safely convert a raw value to a number.
 *
 * Handles numeric strings, native numbers, and strings with common
 * formatting characters (dot-thousands, comma-decimal, currency symbols).
 *
 * @param {*} raw
 * @returns {{ value: number, warning: string | null }}
 */
function parseNumericValue(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { value: 0, warning: null };
  }

  if (typeof raw === "number") {
    if (!isFinite(raw)) {
      return { value: 0, warning: `Non-finite numeric value: ${raw}` };
    }
    return { value: raw, warning: null };
  }

  if (typeof raw === "string") {
    // Strip currency symbols, whitespace, and parentheses.
    let cleaned = raw
      .trim()
      .replace(/[R$\s€£¥"()]/g, "");

    if (cleaned === "") {
      return { value: 0, warning: null };
    }

    // Normalise European-style "1.234,56" → "1234.56".
    if (cleaned.includes(",") && !cleaned.includes(".")) {
      cleaned = cleaned.replace(",", ".");
    } else if (cleaned.includes(".") && cleaned.includes(",")) {
      // "1.234,56" → remove dot-thousands separator, then comma→dot.
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }

    const num = Number(cleaned);
    if (!isFinite(num)) {
      return { value: 0, warning: `Invalid numeric string: "${raw}"` };
    }
    return { value: num, warning: null };
  }

  // Date objects from spreadsheet cells that were mistakenly read as dates.
  if (raw instanceof Date) {
    return { value: 0, warning: `Date object where number expected: ${raw}` };
  }

  return { value: 0, warning: `Unsupported numeric type (${typeof raw}): ${raw}` };
}

/**
 * Return a trimmed string, or empty string if the value is nullish.
 * @param {*} raw
 * @returns {string}
 */
function parseStringValue(raw) {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number") return String(raw);
  if (raw instanceof Date) return String(raw);
  return String(raw).trim();
}

/**
 * Check whether a row is completely empty (all cells null / undefined / "").
 * @param {Array} row
 * @returns {boolean}
 */
function isRowEmpty(row) {
  if (!Array.isArray(row) || row.length === 0) return true;
  return row.every(
    (cell) => cell === null || cell === undefined || cell === ""
  );
}

// ---------------------------------------------------------------------------
// Layout detection helpers
// ---------------------------------------------------------------------------

const normalize = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function detectOmieProfile(headerCells) {
  const h = headerCells.map(normalize);
  const situacaoIdx = h.findIndex((v) => v.includes('situac'));
  const fornecedorIdx = h.findIndex((v) => v.includes('fornecedor') && v.includes('fantasia'));
  const previsaoIdx = h.findIndex((v) => v.includes('previs') && v.includes('pag'));
  const ultimoIdx = h.findIndex((v) => v.includes('ultimo') && v.includes('pag'));
  const valorLiqIdx = h.findIndex((v) => v.includes('valor') && v.includes('liquido'));
  const categoriaIdx = h.findIndex((v) => v === 'categoria' || v.includes('categoria'));
  const contaIdx = h.findIndex((v) => v.includes('conta corrente'));
  const vencimentoIdx = h.findIndex(
    (v) => v === 'vencimento' || (v.includes('venciment') && !v.includes('pag')),
  );
  const found = [situacaoIdx, fornecedorIdx, valorLiqIdx, contaIdx].filter((i) => i >= 0).length;
  if (found < 3) return null;
  return {
    situacaoIdx,
    fornecedorIdx,
    previsaoIdx,
    ultimoIdx,
    valorLiqIdx,
    categoriaIdx,
    contaIdx,
    vencimentoIdx,
  };
}

function detectTitulosPagosProfile(headerCells) {
  const h = headerCells.map(normalize);
  const fornecedorIdx = h.findIndex((v) => v === 'fornecedor');
  const vencimentoIdx = h.findIndex((v) => v === 'vencimento' || v.includes('venciment'));
  const valorParcelaIdx = h.findIndex((v) => v.includes('valor') && v.includes('parcela'));
  const dataBaixaIdx = h.findIndex((v) => v.includes('data') && v.includes('baixa'));
  const valorPagoIdx = h.findIndex((v) => v.includes('valor') && v.includes('pago'));
  const contaFinIdx = h.findIndex((v) => v.includes('conta') && v.includes('financeira'));
  const contaCorrenteIdx = h.findIndex((v) => v.includes('conta corrente'));
  const mascaraIdx = h.findIndex((v) => v.includes('mascara') || v.includes('mask'));
  const categoriaIdx = contaFinIdx >= 0 ? contaFinIdx : mascaraIdx;
  const found = [fornecedorIdx, vencimentoIdx, valorParcelaIdx].filter((i) => i >= 0).length;
  if (found < 2) return null;
  return {
    fornecedorIdx,
    vencimentoIdx,
    valorParcelaIdx,
    dataBaixaIdx,
    valorPagoIdx,
    categoriaIdx,
    contaCorrenteIdx,
    mascaraIdx,
  };
}

// ---------------------------------------------------------------------------
// Main parser (multi-sheet, multi-profile)
// ---------------------------------------------------------------------------

/**
 * Parse the historical financial workbook and extract structured records.
 *
 * Supports multiple layout profiles:
 *   - OMIE "financas" export (24 or 25 columns)
 *   - "Títulos Pagos" export (15 columns, e.g. Palhoça)
 *
 * @param {Object} workbookData — `{ "sheetName": [[row], [row], …], … }`
 * @returns {{
 *   rows: Array<{
 *     situacao: string,
 *     fornecedor: string,
 *     previsao: string | null,
 *     ultimoPagamento: string | null,
 *     valorLiquido: number,
 *     categoria: string,
 *     contaCorrente: string,
 *     vencimento: string | null,
 *     sourceFile: string,
 *     sourceLayout: string,
 *   }>,
 *   summary: { totalRecords, periodStart, periodEnd, totalPago, totalAtrasado },
 *   warnings: string[],
 * }}
 */
function parseHistoryWorkbook(workbookData) {
  const parsedRows = [];
  const warnings = [];

  let totalPago = 0;
  let totalAtrasado = 0;
  let periodStart = null;
  let periodEnd = null;

  const sheetNames = workbookData ? Object.keys(workbookData) : [];

  for (const sheetName of sheetNames) {
    if (sheetName === '_meta') continue;
    const sheet = workbookData[sheetName];
    if (!Array.isArray(sheet) || sheet.length === 0) continue;

    let profile = null;
    let headerRowIdx = -1;
    let dataStartIdx = -1;

    for (let checkRow = 0; checkRow < Math.min(sheet.length, 5); checkRow++) {
      const cells = sheet[checkRow];
      if (!Array.isArray(cells)) continue;

      const omie = detectOmieProfile(cells);
      if (omie) {
        profile = { type: 'omie', mapping: omie };
        headerRowIdx = checkRow;
        dataStartIdx = checkRow + 1;
        break;
      }

      const tp = detectTitulosPagosProfile(cells);
      if (tp) {
        profile = { type: 'titulos_pagos', mapping: tp };
        headerRowIdx = checkRow;
        dataStartIdx = checkRow + 1;
        break;
      }
    }

    if (!profile) {
      warnings.push(`Sheet "${sheetName}": could not detect history layout profile.`);
      continue;
    }

    for (let i = dataStartIdx; i < sheet.length; i++) {
      const raw = sheet[i];
      if (isRowEmpty(raw)) continue;

      const rowNum = i + 1;

      if (profile.type === 'omie') {
        const m = profile.mapping;
        const situacao = m.situacaoIdx >= 0 ? parseStringValue(raw[m.situacaoIdx]) : '';
        const fornecedor = m.fornecedorIdx >= 0 ? parseStringValue(raw[m.fornecedorIdx]) : '';

        const { iso: previsao, warning: wPrevisao } =
          m.previsaoIdx >= 0 ? parseDateValue(raw[m.previsaoIdx]) : { iso: null, warning: null };
        if (wPrevisao) warnings.push(`Row ${rowNum} – Previsão: ${wPrevisao}`);

        const { iso: ultimoPagamento, warning: wUltimo } =
          m.ultimoIdx >= 0 ? parseDateValue(raw[m.ultimoIdx]) : { iso: null, warning: null };
        if (wUltimo) warnings.push(`Row ${rowNum} – Último Pagamento: ${wUltimo}`);

        const { value: valorLiquido, warning: wValor } =
          m.valorLiqIdx >= 0 ? parseNumericValue(raw[m.valorLiqIdx]) : { value: 0, warning: null };
        if (wValor) warnings.push(`Row ${rowNum} – Valor Líquido: ${wValor}`);

        const categoria = m.categoriaIdx >= 0 ? parseStringValue(raw[m.categoriaIdx]) : '';
        const contaCorrente = m.contaIdx >= 0 ? parseStringValue(raw[m.contaIdx]) : '';

        const { iso: vencimento, warning: wVenc } =
          m.vencimentoIdx >= 0 ? parseDateValue(raw[m.vencimentoIdx]) : { iso: null, warning: null };
        if (wVenc) warnings.push(`Row ${rowNum} – Vencimento: ${wVenc}`);

        if (!situacao && valorLiquido === 0) continue;
        if (valorLiquido === 0 && raw[m.valorLiqIdx] !== '' && raw[m.valorLiqIdx] !== null && raw[m.valorLiqIdx] !== undefined) {
          warnings.push(`Row ${rowNum} – Valor Líquido is 0 but the cell is not empty.`);
        }

        const normalisedSituacao = situacao.toUpperCase();
        if (normalisedSituacao === 'PAGO') totalPago += valorLiquido;
        if (normalisedSituacao === 'ATRASADO') totalAtrasado += valorLiquido;

        const validDates = [previsao, ultimoPagamento, vencimento].filter((d) => d !== null);
        for (const d of validDates) {
          if (periodStart === null || d < periodStart) periodStart = d;
          if (periodEnd === null || d > periodEnd) periodEnd = d;
        }

        parsedRows.push({
          situacao,
          fornecedor,
          previsao,
          ultimoPagamento,
          valorLiquido,
          categoria,
          contaCorrente,
          vencimento,
          sourceFile: sheetName,
          sourceLayout: 'omie',
        });
      }

      if (profile.type === 'titulos_pagos') {
        const m = profile.mapping;
        const fornecedor = m.fornecedorIdx >= 0 ? parseStringValue(raw[m.fornecedorIdx]) : '';

        const { iso: vencimento, warning: wVenc } =
          m.vencimentoIdx >= 0 ? parseDateValue(raw[m.vencimentoIdx]) : { iso: null, warning: null };
        if (wVenc) warnings.push(`Row ${rowNum} – Vencimento: ${wVenc}`);

        const { iso: ultimoPagamento, warning: wUltimo } =
          m.dataBaixaIdx >= 0 ? parseDateValue(raw[m.dataBaixaIdx]) : { iso: null, warning: null };
        if (wUltimo) warnings.push(`Row ${rowNum} – Data Baixa: ${wUltimo}`);

        const { value: valorLiquido, warning: wValor } =
          m.valorParcelaIdx >= 0 ? parseNumericValue(raw[m.valorParcelaIdx]) : { value: 0, warning: null };
        if (wValor) warnings.push(`Row ${rowNum} – Valor Parcela: ${wValor}`);

        const { value: valorPago } =
          m.valorPagoIdx >= 0 ? parseNumericValue(raw[m.valorPagoIdx]) : { value: 0, warning: null };

        const categoria = m.categoriaIdx >= 0 ? parseStringValue(raw[m.categoriaIdx]) : '';
        const contaCorrente = m.contaCorrenteIdx >= 0 ? parseStringValue(raw[m.contaCorrenteIdx]) : '';

        if (valorLiquido === 0) continue;

        let situacao = 'pendente';
        if (ultimoPagamento) {
          situacao = 'pago';
        } else if (vencimento && vencimento < new Date().toISOString().slice(0, 10)) {
          situacao = 'atrasado';
        }

        const normalisedSituacao = situacao.toUpperCase();
        if (normalisedSituacao === 'PAGO') totalPago += valorLiquido;
        if (normalisedSituacao === 'ATRASADO') totalAtrasado += valorLiquido;

        if (vencimento) {
          if (periodStart === null || vencimento < periodStart) periodStart = vencimento;
          if (periodEnd === null || vencimento > periodEnd) periodEnd = vencimento;
        }

        parsedRows.push({
          situacao,
          fornecedor,
          previsao: null,
          ultimoPagamento,
          valorLiquido,
          categoria,
          contaCorrente,
          vencimento,
          sourceFile: sheetName,
          sourceLayout: 'titulos_pagos',
          valorPago,
        });
      }
    }
  }

  if (parsedRows.length === 0) {
    warnings.push('No valid history rows found in any sheet.');
  }

  const summary = {
    totalRecords: parsedRows.length,
    periodStart,
    periodEnd,
    totalPago: Math.round(totalPago * 100) / 100,
    totalAtrasado: Math.round(totalAtrasado * 100) / 100,
  };

  return { rows: parsedRows, summary, warnings };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { parseHistoryWorkbook };
