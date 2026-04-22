/**
 * parser-daily.js
 *
 * Module for parsing the daily financial spreadsheet used in the n8n reporting workflow.
 *
 * Expected input format (workbookData):
 *   {
 *     "Contas":  [[row1col1, row1col2, ...], [row2col1, ...], ...],
 *     "Recebido": [[...], ...],
 *     "Resumo":  [[...], ...]
 *   }
 *
 * Sheets may be absent (will generate warnings).
 * Each cell may be: string, number, Date object, or null (from merged cells).
 *
 * Exports:
 *   parseDailyWorkbook(workbookData) -> { contas, recebido, resumo, warnings }
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a value that might be a Date, number, or string into a string.
 * Dates become ISO date strings (YYYY-MM-DD).
 * Everything else is coerced via String().
 * Returns null for null / undefined.
 */
function toString(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

/**
 * Coerce a value to a finite number.
 * Accepts strings like "1.234,56" (Brazilian format), plain numbers, etc.
 * Returns null when the value cannot be parsed.
 */
function toNumber(val) {
  if (typeof val === 'number') return isFinite(val) ? val : null;
  if (val == null) return null;

  let raw = String(val).trim();
  if (raw === '') return null;

  // Handle Brazilian number format: "1.234.567,89"  ->  "1234567.89"
  // We only apply this when the string contains a comma as the LAST separator.
  if (raw.includes(',') && !raw.includes('.')) {
    raw = raw.replace(',', '.');
  } else if (raw.includes(',') && raw.includes('.')) {
    // "1.234.567,89" pattern — dots are thousand separators, comma is decimal.
    raw = raw.replace(/\./g, '').replace(',', '.');
  }

  const num = Number(raw);
  return isFinite(num) ? num : null;
}

/**
 * Return a lower-cased, trimmed string or null.
 */
function toLower(val) {
  const s = toString(val);
  return s ? s.toLowerCase() : null;
}

/**
 * Check whether a cell value (after lower-casing) contains the given substring.
 */
function cellContains(val, substr) {
  const s = toLower(val);
  return s ? s.includes(substr) : false;
}

// ---------------------------------------------------------------------------
// Sheet: Contas  (expenses)
// ---------------------------------------------------------------------------

/**
 * Locate the PRN MATRIZ block inside the "Contas" sheet.
 *
 * Strategy:
 *   1. Scan every cell in the first ~20 rows for a cell whose text contains
 *      "prn matriz" (case-insensitive). This is the company header.
 *   2. Once found, the 7 columns starting at that column index form the block.
 *   3. Walk further rows until we hit another company header or end of data,
 *      collecting data rows.
 *
 * Expected column layout (relative to block start col):
 *   0: Vencimento (date)
 *   1: Favorecido  (string)
 *   2: Departamento (string)
 *   3: Categoria   (string)
 *   4: Valor       (number)
 *   5: Parcela     (string, e.g. "3/12")
 *   6: Observação  (string)
 *
 * Returns { rows, warnings }
 */
function parseContas(sheet) {
  const warnings = [];
  const rows = [];

  if (!sheet || sheet.length === 0) {
    warnings.push('Sheet "Contas" is missing or empty');
    return { rows, warnings };
  }

  const maxScanRows = 20;

  // ---- Step 1: Find the "PRN MATRIZ" header cell ----
  let headerRow = -1;
  let blockStartCol = -1;

  for (let r = 0; r < Math.min(sheet.length, maxScanRows); r++) {
    const row = sheet[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (cellContains(row[c], 'prn matriz')) {
        headerRow = r;
        blockStartCol = c;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) {
    warnings.push('Could not locate "PRN MATRIZ" header in sheet "Contas"');
    return { rows, warnings };
  }

  // ---- Step 2: Identify column headers (Vencimento, Favorecido, etc.) ----
  //
  // The header row for column names is typically 1-2 rows BELOW the
  // "PRN MATRIZ" merged header. We scan the next few rows for a row that
  // contains at least some of the expected column names.
  const expectedHeaders = ['vencimento', 'favorecido', 'departamento', 'categoria', 'valor', 'parcela', 'observa'];
  let colHeaderRow = -1;

  for (let r = headerRow + 1; r <= headerRow + 4 && r < sheet.length; r++) {
    const row = sheet[r];
    if (!row) continue;

    let matchCount = 0;
    for (let c = blockStartCol; c < blockStartCol + 7 && c < row.length; c++) {
      if (cellContains(row[c], 'vencimento')) matchCount++;
      if (cellContains(row[c], 'favorecido')) matchCount++;
      if (cellContains(row[c], 'departamento')) matchCount++;
      if (cellContains(row[c], 'categoria')) matchCount++;
      if (cellContains(row[c], 'valor')) matchCount++;
    }

    // At least 2 header keywords found -> this is the column header row
    if (matchCount >= 2) {
      colHeaderRow = r;
      break;
    }
  }

  if (colHeaderRow < 0) {
    // Fallback: assume data starts 2 rows below the company header
    colHeaderRow = headerRow + 2;
    warnings.push('Could not find column headers in "Contas" — assuming data starts 2 rows below "PRN MATRIZ" header');
  }

  // ---- Step 3: Build a mapping from expected field -> absolute column index ----
  //
  // We inspect the column header row to figure out which column holds which
  // field. This handles columns that may be in different order.
  const fieldMap = {};
  const fieldKeywords = {
    vencimento: ['vencimento', 'venc', 'data venc'],
    favorecido: ['favorecido', 'fornecedor', 'credor', 'benefici'],
    departamento: ['departamento', 'depto', 'dept'],
    categoria: ['categoria', 'cat'],
    valor: ['valor', 'vlr', 'valor r$'],
    parcela: ['parcela', 'parc'],
    observacao: ['observa', 'obs', 'hist', 'descri']
  };

  // By default, assume the standard left-to-right order starting at blockStartCol
  const defaultOrder = ['vencimento', 'favorecido', 'departamento', 'categoria', 'valor', 'parcela', 'observacao'];

  // Try to detect by scanning the header row
  let detectedAny = false;
  const headerRowData = sheet[colHeaderRow] || [];

  for (let c = blockStartCol; c < blockStartCol + 7 && c < headerRowData.length; c++) {
    const cellVal = toLower(headerRowData[c]);
    if (!cellVal) continue;

    for (const [field, keywords] of Object.entries(fieldKeywords)) {
      if (fieldMap[field] !== undefined) continue; // already mapped
      if (keywords.some(kw => cellVal.includes(kw))) {
        fieldMap[field] = c;
        detectedAny = true;
        break;
      }
    }
  }

  // If detection found fewer than 3 fields, fall back to positional defaults
  if (!detectedAny || Object.keys(fieldMap).length < 3) {
    for (let i = 0; i < defaultOrder.length; i++) {
      if (fieldMap[defaultOrder[i]] === undefined) {
        fieldMap[defaultOrder[i]] = blockStartCol + i;
      }
    }
  }

  // ---- Step 4: Extract data rows ----
  //
  // Data rows start immediately after the column header row.
  // We stop when:
  //   - We encounter another company header (e.g. "CAMBORIU", "PALHOCA")
  //   - A row has no meaningful data at all
  //   - We reach the end of the sheet
  //
  // Subtotal / total rows are detected by keywords like "total", "subtotal",
  // or by the "favorecido" cell being empty while "valor" is present
  // (or by a numeric value in the "valor" column that looks like a sum).

  const companyBlockMarkers = ['camboriu', 'palhoca', 'medimagem', 'prn locacao', 'prn holding'];
  const subtotalKeywords = ['total', 'subtotal', 'saldo', 'sub total'];

  for (let r = colHeaderRow + 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (!row) continue;

    // Check if this row starts a new company block (look across the whole row)
    let isCompanyHeader = false;
    for (let c = 0; c < row.length; c++) {
      const cell = toLower(row[c]);
      if (cell && companyBlockMarkers.some(m => cell.includes(m))) {
        isCompanyHeader = true;
        break;
      }
    }
    if (isCompanyHeader) break; // stop — we've left the PRN MATRIZ block

    // Extract raw cell values using the field map
    const raw = {};
    for (const [field, colIdx] of Object.entries(fieldMap)) {
      raw[field] = colIdx < row.length ? row[colIdx] : null;
    }

    // Determine the "favorecido" text for subtotal detection
    const favorecidoText = toLower(raw.favorecido);

    // Skip rows that are clearly subtotal / total rows
    if (favorecidoText && subtotalKeywords.some(kw => favorecidoText.includes(kw))) {
      continue;
    }

    // Build the record
    const vencimento = toString(raw.vencimento);
    const favorecido = toString(raw.favorecido);
    const departamento = toString(raw.departamento);
    const categoria = toString(raw.categoria);
    const valor = toNumber(raw.valor);
    const parcela = toString(raw.parcela);
    const observacao = toString(raw.observacao);

    // Skip entirely empty rows (no meaningful data in any field)
    const hasAnyData = [vencimento, favorecido, departamento, categoria, parcela, observacao]
      .some(v => v !== null) || valor !== null;
    if (!hasAnyData) continue;

    // Warn about rows where valor is missing but there is other data
    if (valor === null && (favorecido || categoria)) {
      warnings.push(
        `Contas row ${r + 1}: has data (favorecido="${favorecido}") but no parseable valor`
      );
    }

    rows.push({
      _row: r + 1, // 1-based row number for traceability
      vencimento,
      favorecido,
      departamento,
      categoria,
      valor,
      parcela,
      observacao
    });
  }

  if (rows.length === 0) {
    warnings.push('No expense rows extracted from "Contas" for PRN MATRIZ');
  }

  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// Sheet: Recebido  (receipts)
// ---------------------------------------------------------------------------

/**
 * Parse the "Recebido" sheet.
 *
 * Expected columns (detected by header keywords, NOT fixed positions):
 *   - Data / Date           -> data
 *   - Identificador / Doc   -> identificador
 *   - Descrição / Desc      -> descricao
 *   - Empresa               -> empresa
 *   - Conta Corrente        -> contaCorrente
 *   - Valor                 -> valor
 *   - Conciliação / Status  -> conciliacao
 *
 * All rows are returned. Rows whose "empresa" field matches PRN-related names
 * are flagged with isPRN = true.
 *
 * Returns { rows, warnings }
 */
function parseRecebido(sheet) {
  const warnings = [];
  const rows = [];

  if (!sheet || sheet.length === 0) {
    warnings.push('Sheet "Recebido" is missing or empty');
    return { rows, warnings };
  }

  // ---- Locate the header row ----
  const headerKeywords = {
    data: ['data', 'date', 'dt'],
    identificador: ['identificador', 'id', 'doc', 'documento', 'número', 'numero'],
    descricao: ['descri', 'hist', 'desc'],
    empresa: ['empresa'],
    contaCorrente: ['conta corrente', 'conta', 'banco'],
    valor: ['valor', 'vlr'],
    conciliacao: ['concili', 'status', 'situação', 'situacao']
  };

  let headerRowIdx = -1;
  const colMap = {};

  // Scan the first 15 rows for a row that looks like a header
  for (let r = 0; r < Math.min(sheet.length, 15); r++) {
    const row = sheet[r];
    if (!row) continue;

    let found = 0;
    for (let c = 0; c < row.length; c++) {
      const cell = toLower(row[c]);
      if (!cell) continue;

      for (const [field, keywords] of Object.entries(headerKeywords)) {
        if (colMap[field] !== undefined) continue; // already mapped in this row
        if (keywords.some(kw => cell.includes(kw))) {
          colMap[field] = c;
          found++;
          break;
        }
      }
    }

    if (found >= 3) {
      headerRowIdx = r;
      break;
    }
    // Reset mapping for next row attempt
    if (found < 3) {
      for (const key of Object.keys(colMap)) delete colMap[key];
    }
  }

  if (headerRowIdx < 0) {
    warnings.push('Could not find header row in sheet "Recebido"');
    return { rows, warnings };
  }

  // ---- PRN-related company name fragments ----
  const prnFragments = ['prn', 'medimagem', 'matriz', 'camboriu', 'palhoca', 'locação', 'locação', 'holding'];

  // ---- Extract data rows ----
  for (let r = headerRowIdx + 1; r < sheet.length; r++) {
    const row = sheet[r];
    if (!row) continue;

    const data = toString(colMap.data !== undefined && colMap.data < row.length ? row[colMap.data] : null);
    const identificador = toString(colMap.identificador !== undefined && colMap.identificador < row.length ? row[colMap.identificador] : null);
    const descricao = toString(colMap.descricao !== undefined && colMap.descricao < row.length ? row[colMap.descricao] : null);
    const empresa = toString(colMap.empresa !== undefined && colMap.empresa < row.length ? row[colMap.empresa] : null);
    const contaCorrente = toString(colMap.contaCorrente !== undefined && colMap.contaCorrente < row.length ? row[colMap.contaCorrente] : null);
    const valor = toNumber(colMap.valor !== undefined && colMap.valor < row.length ? row[colMap.valor] : null);
    const conciliacao = toString(colMap.conciliacao !== undefined && colMap.conciliacao < row.length ? row[colMap.conciliacao] : null);

    // Skip empty rows
    const hasAnyData = [data, identificador, descricao, empresa, contaCorrente, conciliacao]
      .some(v => v !== null) || valor !== null;
    if (!hasAnyData) continue;

    // Determine if this receipt is PRN-related
    const empresaLower = toLower(empresa);
    const isPRN = empresaLower ? prnFragments.some(f => empresaLower.includes(f)) : false;

    rows.push({
      _row: r + 1,
      data,
      identificador,
      descricao,
      empresa,
      contaCorrente,
      valor,
      conciliacao,
      isPRN
    });
  }

  if (rows.length === 0) {
    warnings.push('No receipt rows extracted from "Recebido"');
  }

  // Warn about potential filtered data (if the sheet seems sparse —
  // many consecutive empty rows in the middle could indicate hidden rows)
  const totalRows = sheet.length - headerRowIdx - 1;
  const filledRows = rows.length;
  if (totalRows > 0 && filledRows / totalRows < 0.3 && filledRows > 5) {
    warnings.push(
      `Recebido: only ${filledRows} of ${totalRows} rows have data — ` +
      'this may indicate filtered/hidden rows in the source spreadsheet'
    );
  }

  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// Sheet: Resumo  (summary — cross-check only)
// ---------------------------------------------------------------------------

/**
 * Parse the "Resumo" sheet for entity-level consolidated values.
 *
 * The Resumo sheet is FRAGILE — it often uses fixed cell references.
 * We try to detect entity names and associated financial metrics by scanning
 * for known entity strings and then reading nearby cells.
 *
 * Entities we care about:
 *   - PRN MATRIZ
 *   - MEDIMAGEM CAMBORIU
 *   - MEDIMAGEM PALHOCA
 *   - PRN LOCAÇÃO
 *   - PRN HOLDING
 *
 * Metrics (detected by column headers or nearby labels):
 *   - Despesas  (expenses)
 *   - Saldos    (balances)
 *   - Aplicações (investments)
 *
 * Returns { entities: { [entityName]: { despesas, saldos, aplicacoes } }, warnings }
 */
function parseResumo(sheet) {
  const warnings = [];
  const entities = {};

  if (!sheet || sheet.length === 0) {
    warnings.push('Sheet "Resumo" is missing or empty — cross-checking will be skipped');
    return { entities, warnings };
  }

  // Known entity names (normalised to lower-case for matching)
  const knownEntities = [
    'prn matriz',
    'medimagem camboriu',
    'medimagem palhoca',
    'prn locação',
    'prn holding'
  ];

  // Known metric labels
  const metricKeywords = {
    despesas: ['despesa', 'total despesa'],
    saldos: ['saldo'],
    aplicacoes: ['aplicação', 'aplicacao', 'aplic']
  };

  // ---- Strategy: scan every cell for entity names ----
  // When found, look at cells to the right for numeric values, and look at
  // rows above for metric labels that could tell us what those numbers mean.

  for (let r = 0; r < sheet.length; r++) {
    const row = sheet[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = toLower(row[c]);
      if (!cell) continue;

      // Check if this cell matches a known entity
      let matchedEntity = null;
      for (const entity of knownEntities) {
        if (cell.includes(entity)) {
          matchedEntity = entity;
          break;
        }
      }

      if (!matchedEntity) continue;

      // Use the display-form entity name (first-letter upper-case)
      const displayEntity = toUpperTitle(toString(row[c])) || matchedEntity.toUpperCase();

      // Collect numeric values to the right of the entity cell (next ~6 columns)
      const nearbyValues = [];
      for (let nc = c + 1; nc <= c + 6 && nc < row.length; nc++) {
        const num = toNumber(row[nc]);
        if (num !== null) {
          nearbyValues.push({ col: nc, value: num });
        }
      }

      // Now try to associate these values with metric labels.
      // Look at the rows ABOVE the entity row (typically 0-3 rows up) for
      // labels that are in the same column as each numeric value.
      const metrics = {};

      for (const nv of nearbyValues) {
        let matchedMetric = null;

        // Scan up to 4 rows above for a label in the same column
        for (let ur = Math.max(0, r - 4); ur < r; ur++) {
          const upRow = sheet[ur];
          if (!upRow || nv.col >= upRow.length) continue;
          const upCell = toLower(upRow[nv.col]);
          if (!upCell) continue;

          for (const [metric, keywords] of Object.entries(metricKeywords)) {
            if (keywords.some(kw => upCell.includes(kw))) {
              matchedMetric = metric;
              break;
            }
          }
          if (matchedMetric) break;
        }

        // If no label matched above, also check the header row at r-1 or r-2
        // in a broader search (some layouts have labels above and values below)
        if (!matchedMetric) {
          // As a heuristic, the first numeric is often despesas, second is saldos, etc.
          const idx = nearbyValues.indexOf(nv);
          const fallbackOrder = ['despesas', 'saldos', 'aplicacoes'];
          if (idx < fallbackOrder.length) {
            matchedMetric = fallbackOrder[idx];
          }
        }

        if (matchedMetric && metrics[matchedMetric] === undefined) {
          metrics[matchedMetric] = nv.value;
        }
      }

      entities[displayEntity] = metrics;
    }
  }

  if (Object.keys(entities).length === 0) {
    warnings.push('Could not extract any entity data from "Resumo" — cross-checking will be limited');
  }

  return { entities, warnings };
}

/**
 * Convert a string to title case for display purposes.
 * E.g. "prn matriz" -> "Prn Matriz"
 */
function toUpperTitle(str) {
  if (!str) return null;
  return str.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ---------------------------------------------------------------------------
// Cross-checking: Contas totals vs Resumo
// ---------------------------------------------------------------------------

/**
 * Compare the sum of PRN MATRIZ expenses from "Contas" with the "Despesas"
 * value from "Resumo". Generate warnings if they diverge significantly.
 *
 * We allow a tolerance of 0.01 (R$ 0.01) to account for rounding.
 */
function crossCheck(contasRows, resumoEntities, warnings) {
  // Sum all valor fields from contas
  let contasTotal = 0;
  let hasValues = false;
  for (const row of contasRows) {
    if (row.valor !== null) {
      contasTotal += row.valor;
      hasValues = true;
    }
  }

  if (!hasValues) return;

  // Find the PRN MATRIZ entity in resumo
  const prnResumo = resumoEntities['Prn Matriz'] || resumoEntities['PRN MATRIZ'] || resumoEntities['PRN MATRIZ'];
  if (!prnResumo || prnResumo.despesas === undefined) {
    warnings.push(
      'Cross-check skipped: could not find "Despesas" for PRN MATRIZ in Resumo sheet'
    );
    return;
  }

  const resumoDespesas = prnResumo.despesas;
  const diff = Math.abs(contasTotal - resumoDespesas);

  if (diff > 0.01) {
    warnings.push(
      `Cross-check mismatch (PRN MATRIZ despesas): Contas sum = ${contasTotal.toFixed(2)}, ` +
      `Resumo = ${resumoDespesas.toFixed(2)}, diff = ${diff.toFixed(2)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Parse the daily financial workbook.
 *
 * @param {Object} workbookData - Object with sheet names as keys, each value
 *   being a 2D array (rows x columns) of cell values.
 * @returns {{ contas: Array, recebido: Array, resumo: Object, warnings: Array }}
 */
function parseDailyWorkbook(workbookData) {
  const warnings = [];

  // ---- Parse each sheet ----
  const contasResult = parseContas(workbookData['Contas'] || null);
  const recebidoResult = parseRecebido(workbookData['Recebido'] || null);
  const resumoResult = parseResumo(workbookData['Resumo'] || null);

  // Collect warnings from all parsers
  warnings.push(...contasResult.warnings);
  warnings.push(...recebidoResult.warnings);
  warnings.push(...resumoResult.warnings);

  // ---- Cross-check Contas vs Resumo ----
  crossCheck(contasResult.rows, resumoResult.entities, warnings);

  // ---- Check for missing sheets ----
  const expectedSheets = ['Contas', 'Recebido', 'Resumo'];
  for (const sheetName of expectedSheets) {
    if (!workbookData[sheetName]) {
      warnings.push(`Sheet "${sheetName}" is not present in the workbook`);
    }
  }

  return {
    contas: contasResult.rows,
    recebido: recebidoResult.rows,
    resumo: resumoResult.entities,
    warnings
  };
}

// ---------------------------------------------------------------------------
// Export (works in both CommonJS and ES module environments)
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDailyWorkbook };
}
