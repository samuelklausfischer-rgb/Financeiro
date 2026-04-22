import json
import re
from pathlib import Path

BASE = Path(r"C:\Users\OPERACIONAL\Desktop\AUTOMAÇÃO\automação analise\prn-reporting")
WF_OUT = BASE / "src" / "n8n" / "workflows" / "WF-PRN-MAIN-v4.json"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def strip_commonjs_exports(js: str) -> str:
    js = re.sub(
        r"if\s*\(typeof module !== 'undefined' && module\.exports\)\s*\{\s*module\.exports\s*=\s*\{[^}]*\};\s*\}",
        "",
        js,
        flags=re.MULTILINE,
    )
    js = re.sub(r"module\.exports\s*=\s*\{[^}]*\};?", "", js, flags=re.MULTILINE)
    return js.strip() + "\n"


form_html = read(BASE / "src" / "templates" / "form.html")
normalizer_js = strip_commonjs_exports(read(BASE / "src" / "n8n" / "lib" / "normalizer.js"))
calculator_js = strip_commonjs_exports(read(BASE / "src" / "n8n" / "lib" / "calculator.js"))
report_builder_js = strip_commonjs_exports(read(BASE / "src" / "n8n" / "lib" / "report-builder.js"))


serve_form_code = (
    "const html = " + json.dumps(form_html, ensure_ascii=False) + ";\n"
    "return [{ json: { html } }];"
)


initialize_code = r"""
const item = $input.first() || {};
const binary = item.binary || {};
const errors = [];

if (!binary.daily_file) {
  errors.push('Planilha Diária não enviada (campo daily_file).');
}
if (!binary.historical_file) {
  errors.push('Dados históricos não enviados (campo historical_file).');
}

const crypto = require('crypto');
const requestId = crypto.randomUUID
  ? crypto.randomUUID()
  : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const rawRef = String(item.json?.reference_date || item.json?.referenceDate || '').trim();
const isISODate = /^\d{4}-\d{2}-\d{2}$/.test(rawRef);
const referenceDateUsed = isISODate ? rawRef : new Date().toISOString().slice(0, 10);

if (errors.length > 0) {
  return [{
    json: {
      valid: false,
      requestId,
      errorCode: 'VALIDATION_ERROR',
      error: 'Falha na validação do upload.',
      details: { errors },
    },
  }];
}

let historicalSheets = [];
try {
  const buf = await this.helpers.getBinaryDataBuffer(0, 'historical_file');
  const jsonString = buf.toString('utf-8');
  historicalSheets = JSON.parse(jsonString);
  if (!Array.isArray(historicalSheets)) historicalSheets = [];
} catch (e) {
  errors.push('Falha ao ler JSON histórico: ' + (e.message || String(e)));
  historicalSheets = [];
}

if (historicalSheets.length === 0) {
  errors.push('Dados históricos vazios ou com formato inválido após leitura.');
}

if (errors.length > 0) {
  return [{
    json: {
      valid: false,
      requestId,
      errorCode: 'VALIDATION_ERROR',
      error: 'Falha na validação do upload.',
      details: { errors },
    },
  }];
}

const historyFilename = item.json?.historical_filename || `historico-${historicalSheets.length}-fontes`;

return [{
  json: {
    kind: 'context',
    valid: true,
    requestId,
    referenceDateUsed,
    dailyFilename: binary.daily_file?.fileName || 'daily.xlsx',
    historyFilename,
    historical_sheets: historicalSheets,
  },
  binary: { daily_file: binary.daily_file },
}];
""".strip()


parse_contas_code = r"""
const inputItems = $input.all();
const warnings = [];
const blockingErrors = [];

if (inputItems.some((it) => it.json?.error)) {
  blockingErrors.push('Falha ao extrair a aba Contas. Verifique se a aba existe e está legível.');
}

const rows = inputItems
  .map((it) => (Array.isArray(it.json?.row) ? it.json.row : null))
  .filter((r) => Array.isArray(r));

if (rows.length === 0) {
  blockingErrors.push('Aba Contas sem linhas utilizáveis.');
  return [{ json: { kind: 'contas', contas: [], warnings, blockingErrors } }];
}

const t = (v) => (v == null ? '' : String(v).trim());
const tu = (v) => t(v).toUpperCase();

const toNumber = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v).trim();
  s = s.replace(/\s+/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const toDate = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date (base 1899-12-30)
    const wholeDays = Math.floor(v);
    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + wholeDays * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (Object.prototype.toString.call(v) === '[object Date]' && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const asNum = Number(s);
    if (Number.isFinite(asNum) && asNum > 20000 && asNum < 90000) {
      const wholeDays = Math.floor(asNum);
      const excelEpoch = Date.UTC(1899, 11, 30);
      const d = new Date(excelEpoch + wholeDays * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }

  const isoLike = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoLike) {
    const yyyy = isoLike[1];
    const mm = isoLike[2].padStart(2, '0');
    const dd = isoLike[3].padStart(2, '0');
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`;
  }

  return null;
};

let headerIndex = -1;
for (let i = 0; i < Math.min(rows.length, 30); i++) {
  const c = rows[i].slice(0, 7).map(tu);
  const hasVenc = c.some((x) => x.includes('VENC'));
  const hasFav = c.some((x) => x.includes('FAVOREC') || x.includes('FORNECEDOR') || x.includes('DESCRI'));
  const hasVal = c.some((x) => x === 'VALOR' || x.includes('VALOR'));
  if (hasVenc && hasFav && hasVal) {
    headerIndex = i;
    break;
  }
}

const header = headerIndex >= 0 ? rows[headerIndex].slice(0, 7).map(tu) : [];

const idx = {
  venc: 0,
  fav: 1,
  dep: 2,
  cat: 3,
  val: 4,
  parcela: 5,
  obs: 6,
};

if (header.length) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (h.includes('VENC')) idx.venc = i;
    if (h.includes('FAVOREC') || h.includes('FORNECEDOR') || h.includes('DESCRI')) idx.fav = i;
    if (h.includes('DEPART') || h.includes('SETOR')) idx.dep = i;
    if (h.includes('CATEG')) idx.cat = i;
    if (h.includes('VALOR')) idx.val = i;
    if (h.includes('PARCEL')) idx.parcela = i;
    if (h.includes('OBS')) idx.obs = i;
  }
}

const start = headerIndex >= 0 ? headerIndex + 1 : 2;
const contas = [];

for (let i = start; i < rows.length; i++) {
  const r = rows[i];
  const firstBlock = r.slice(0, 7);
  const joined = firstBlock.map(tu).join(' ');

  if (joined.includes('CAMBORIU') || joined.includes('PALHOCA')) continue;
  if (firstBlock.every((x) => t(x) === '')) continue;

  const favorecido = t(firstBlock[idx.fav]);
  const favorecidoU = favorecido.toUpperCase();
  const categoria = t(firstBlock[idx.cat]);
  const valor = toNumber(firstBlock[idx.val]);

  if (!favorecido && !categoria && (valor == null || valor === 0)) continue;
  if (!favorecido) continue;
  if (/^(TOTAL|SALDO|DESPESA|DESPESAS|TRANSFERENCIA|TRANSFERÊNCIA|APLICA)/.test(favorecidoU)) continue;
  if (favorecidoU === 'N/D') continue;
  if (valor == null) {
    warnings.push(`Linha ${i + 1} ignorada na aba Contas: valor inválido.`);
    continue;
  }

  contas.push({
    entity: 'prn_matriz',
    vencimento: toDate(firstBlock[idx.venc]),
    favorecido: favorecido || 'N/D',
    departamento: t(firstBlock[idx.dep]) || null,
    categoria: categoria || 'Sem categoria',
    valor,
    parcela: t(firstBlock[idx.parcela]) || null,
    observacao: t(firstBlock[idx.obs]) || null,
    contaCorrente: null,
  });
}

if (contas.length === 0) {
  warnings.push('Nenhuma despesa válida encontrada na aba Contas (bloco PRN MATRIZ).');
}

return [{ json: { kind: 'contas', contas, warnings, blockingErrors } }];
""".strip()


parse_recebido_code = r"""
const inputItems = $input.all();
const warnings = [];
const blockingErrors = [];

if (inputItems.some((it) => it.json?.error)) {
  blockingErrors.push('Falha ao extrair a aba Recebido. Verifique se a aba existe e está legível.');
}

const rows = inputItems
  .map((it) => (Array.isArray(it.json?.row) ? it.json.row : null))
  .filter((r) => Array.isArray(r));

if (rows.length === 0) {
  blockingErrors.push('Aba Recebido sem linhas utilizáveis.');
  return [{ json: { kind: 'recebido', recebido: [], warnings, blockingErrors } }];
}

const t = (v) => (v == null ? '' : String(v).trim());
const tu = (v) => t(v).toUpperCase();

const toNumber = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v).trim().replace(/\s+/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const toDate = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const wholeDays = Math.floor(v);
    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + wholeDays * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (Object.prototype.toString.call(v) === '[object Date]' && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const asNum = Number(s);
    if (Number.isFinite(asNum) && asNum > 20000 && asNum < 90000) {
      const wholeDays = Math.floor(asNum);
      const excelEpoch = Date.UTC(1899, 11, 30);
      const d = new Date(excelEpoch + wholeDays * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  const isoLike = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoLike) {
    const yyyy = isoLike[1];
    const mm = isoLike[2].padStart(2, '0');
    const dd = isoLike[3].padStart(2, '0');
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`;
  }

  return null;
};

let headerIndex = -1;
for (let i = 0; i < Math.min(rows.length, 40); i++) {
  const c = rows[i].map(tu);
  const hasEmpresa = c.some((x) => x.includes('EMPRESA'));
  const hasValor = c.some((x) => x.includes('VALOR'));
  if (hasEmpresa && hasValor) {
    headerIndex = i;
    break;
  }
}

const header = headerIndex >= 0 ? rows[headerIndex].map(tu) : [];
const findCol = (aliases, fallback) => {
  if (!header.length) return fallback;
  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (aliases.some((a) => h.includes(a))) return i;
  }
  return fallback;
};

const idxData = findCol(['DATA'], 0);
const idxDescricao = findCol(['DESCRI', 'HISTOR', 'CLIENTE', 'FAVOREC', 'FORNECEDOR'], 2);
const idxEmpresa = findCol(['EMPRESA'], 5);
const idxConta = findCol(['CONTA'], 4);
const idxValor = findCol(['VALOR'], 6);
const idxCategoria = findCol(['CATEG'], 3);
const idxConciliado = findCol(['CONCIL', 'STATUS'], 7);

const start = headerIndex >= 0 ? headerIndex + 1 : 2;
const recebido = [];

for (let i = start; i < rows.length; i++) {
  const r = rows[i];
  if (r.every((v) => t(v) === '')) continue;

  const empresa = t(r[idxEmpresa]);
  const empresaU = empresa.toUpperCase();
  const isPrn = /PRN|DIAGNOST/.test(empresaU);
  if (!isPrn) continue;

  const valor = toNumber(r[idxValor]);
  if (valor == null) {
    warnings.push(`Linha ${i + 1} ignorada na aba Recebido: valor inválido.`);
    continue;
  }

  recebido.push({
    entity: 'prn_matriz',
    data: toDate(r[idxData]),
    descricao: t(r[idxDescricao]) || 'N/D',
    contaCorrente: t(r[idxConta]) || 'Não informado',
    valor,
    categoria: t(r[idxCategoria]) || null,
    conciliado: t(r[idxConciliado]) || null,
    empresa,
    isPrn: true,
  });
}

if (recebido.length <= 2) {
  warnings.push('Poucas linhas de recebimento PRN encontradas. A aba Recebido pode estar filtrada.');
}

return [{ json: { kind: 'recebido', recebido, warnings, blockingErrors } }];
""".strip()


parse_resumo_code = r"""
const inputItems = $input.all();
const warnings = [];
const blockingErrors = [];

if (inputItems.some((it) => it.json?.error)) {
  warnings.push('Falha ao extrair a aba Resumo. O relatório seguirá sem conferência completa.');
}

const rows = inputItems
  .map((it) => (Array.isArray(it.json?.row) ? it.json.row : null))
  .filter((r) => Array.isArray(r));

const t = (v) => (v == null ? '' : String(v).trim());
const tu = (v) => t(v).toUpperCase();
const toNumber = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v).trim().replace(/\s+/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const resumo = {
  prn_matriz: { despesas: 0, saldos: 0, aplicacoes: 0 },
  prn_locacao: { despesas: 0, saldos: 0, aplicacoes: 0 },
  prn_holding: { despesas: 0, saldos: 0, aplicacoes: 0 },
};

if (rows.length === 0) {
  warnings.push('Aba Resumo vazia ou não legível.');
  return [{ json: { kind: 'resumo', resumo, warnings, blockingErrors } }];
}

let headerIdx = -1;
for (let i = 0; i < Math.min(rows.length, 25); i++) {
  const line = rows[i].map(tu);
  if (line.some((x) => x.includes('DESPESA')) && line.some((x) => x.includes('SALDO'))) {
    headerIdx = i;
    break;
  }
}

let idxDesp = -1;
let idxSaldo = -1;
let idxAplic = -1;
if (headerIdx >= 0) {
  const h = rows[headerIdx].map(tu);
  for (let i = 0; i < h.length; i++) {
    if (idxDesp < 0 && h[i].includes('DESPESA')) idxDesp = i;
    if (idxSaldo < 0 && h[i].includes('SALDO')) idxSaldo = i;
    if (idxAplic < 0 && (h[i].includes('APLIC') || h[i].includes('INVEST'))) idxAplic = i;
  }
}

const findEntityKey = (lineU) => {
  if (lineU.includes('PRN MATRIZ')) return 'prn_matriz';
  if (lineU.includes('PRN LOCA') || lineU.includes('LOCACAO')) return 'prn_locacao';
  if (lineU.includes('PRN HOLD')) return 'prn_holding';
  return null;
};

for (let r = 0; r < rows.length; r++) {
  const row = rows[r];
  const lineU = row.map(tu).join(' ');
  const key = findEntityKey(lineU);
  if (!key) continue;

  const nums = row.map(toNumber).filter((n) => n != null);
  const despesas = idxDesp >= 0 ? toNumber(row[idxDesp]) : nums[0] ?? 0;
  const saldos = idxSaldo >= 0 ? toNumber(row[idxSaldo]) : nums[1] ?? 0;
  const aplicacoes = idxAplic >= 0 ? toNumber(row[idxAplic]) : nums[2] ?? 0;

  resumo[key] = {
    despesas: despesas ?? 0,
    saldos: saldos ?? 0,
    aplicacoes: aplicacoes ?? 0,
  };
}

return [{ json: { kind: 'resumo', resumo, warnings, blockingErrors } }];
""".strip()


parse_history_code = r"""
const warnings = [];
const blockingErrors = [];

const item = $input.first();
const context = item.json || {};
const historicalSheets = context.historical_sheets || [];

if (!Array.isArray(historicalSheets) || historicalSheets.length === 0) {
  blockingErrors.push('Dados históricos ausentes ou vazios após validação.');
  return [{ json: { kind: 'history', history: { rows: [], summary: { totalRecords: 0, periodStart: null, periodEnd: null, totalPago: 0, totalAtrasado: 0 } }, warnings, blockingErrors } }];
}

const normalize = (v) => String(v || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const t = (v) => (v == null ? '' : String(v).trim());

const toNumber = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v).trim().replace(/\s+/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const toDate = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const wholeDays = Math.floor(v);
    const d = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (Object.prototype.toString.call(v) === '[object Date]' && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const asNum = Number(s);
    if (Number.isFinite(asNum) && asNum > 20000 && asNum < 90000) {
      const wholeDays = Math.floor(asNum);
      const d = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const isoLike = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoLike) {
    const yyyy = isoLike[1]; const mm = isoLike[2].padStart(2, '0'); const dd = isoLike[3].padStart(2, '0');
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

const sanitizeDate = (dateValue, fieldLabel, rowNumber) => {
  if (!dateValue) return null;
  const y = Number(String(dateValue).slice(0, 4));
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    warnings.push(`Data de ${fieldLabel} fora do intervalo: ${dateValue} (linha ${rowNumber}).`);
    return null;
  }
  return dateValue;
};

function detectOmieProfile(headerCells) {
  const h = headerCells.map(normalize);
  const situacaoIdx = h.findIndex((v) => v.includes('situac'));
  const fornecedorIdx = h.findIndex((v) => v.includes('fornecedor') && v.includes('fantasia'));
  const previsaoIdx = h.findIndex((v) => v.includes('previs') && v.includes('pag'));
  const ultimoIdx = h.findIndex((v) => v.includes('ultimo') && v.includes('pag'));
  const valorLiqIdx = h.findIndex((v) => v.includes('valor') && v.includes('liquido'));
  const categoriaIdx = h.findIndex((v) => v === 'categoria' || v.includes('categoria'));
  const contaIdx = h.findIndex((v) => v.includes('conta corrente'));
  const vencimentoIdx = h.findIndex((v) => v === 'vencimento' || (v.includes('venciment') && !v.includes('pag')));

  const found = [situacaoIdx, fornecedorIdx, valorLiqIdx, contaIdx].filter((i) => i >= 0).length;
  if (found < 3) return null;

  return { situacaoIdx, fornecedorIdx, previsaoIdx, ultimoIdx, valorLiqIdx, categoriaIdx, contaIdx, vencimentoIdx };
}

function detectTitulosPagosProfile(headerCells) {
  const h = headerCells.map(normalize);
  const fornecedorIdx = h.findIndex((v) => v === 'fornecedor');
  const emissaoIdx = h.findIndex((v) => v.includes('emiss'));
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

  return { fornecedorIdx, emissaoIdx, vencimentoIdx, valorParcelaIdx, dataBaixaIdx, valorPagoIdx, categoriaIdx, contaCorrenteIdx, mascaraIdx };
}

const allParsed = [];
let periodStart = null;
let periodEnd = null;

for (const sheetEntry of historicalSheets) {
  const sourceFile = sheetEntry.sourceFile || 'unknown';
  const sheetName = sheetEntry.sheetName || 'unknown';
  const rows = sheetEntry.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    warnings.push(`Fonte "${sourceFile}" aba "${sheetName}": sem dados.`);
    continue;
  }

  let profile = null;
  let dataStartIdx = -1;

  for (let checkRow = 0; checkRow < Math.min(rows.length, 5); checkRow++) {
    const cells = rows[checkRow];
    if (!Array.isArray(cells)) continue;

    const omie = detectOmieProfile(cells);
    if (omie) {
      profile = { type: 'omie', mapping: omie };
      dataStartIdx = checkRow + 1;
      break;
    }

    const tp = detectTitulosPagosProfile(cells);
    if (tp) {
      profile = { type: 'titulos_pagos', mapping: tp };
      dataStartIdx = checkRow + 1;
      break;
    }
  }

  if (!profile) {
    warnings.push(`Fonte "${sourceFile}" aba "${sheetName}": formato não reconhecido.`);
    continue;
  }

  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    if (row.every((v) => t(v) === '')) continue;

    let rec = {};

    if (profile.type === 'omie') {
      const m = profile.mapping;
      const situacao = m.situacaoIdx >= 0 ? t(row[m.situacaoIdx]) : '';
      const fornecedor = m.fornecedorIdx >= 0 ? t(row[m.fornecedorIdx]) : '';
      const previsao = m.previsaoIdx >= 0 ? sanitizeDate(toDate(row[m.previsaoIdx]), 'previsão', i + 1) : null;
      const ultimoPagamento = m.ultimoIdx >= 0 ? sanitizeDate(toDate(row[m.ultimoIdx]), 'último pagamento', i + 1) : null;
      const valorLiquido = m.valorLiqIdx >= 0 ? toNumber(row[m.valorLiqIdx]) : null;
      const categoria = m.categoriaIdx >= 0 ? t(row[m.categoriaIdx]) : '';
      const contaCorrente = m.contaIdx >= 0 ? t(row[m.contaIdx]) : '';
      const vencimento = m.vencimentoIdx >= 0 ? sanitizeDate(toDate(row[m.vencimentoIdx]), 'vencimento', i + 1) : null;

      if (!situacao && valorLiquido == null) continue;
      if (valorLiquido == null) {
        warnings.push(`Linha ${i + 1} (${sourceFile}/${sheetName}) com valor líquido inválido.`);
        continue;
      }

      rec = { situacao, fornecedor, previsao, ultimoPagamento, valorLiquido, categoria, contaCorrente, vencimento, sourceFile, sourceLayout: 'omie' };
    }

    if (profile.type === 'titulos_pagos') {
      const m = profile.mapping;
      const fornecedor = m.fornecedorIdx >= 0 ? t(row[m.fornecedorIdx]) : '';
      const vencimento = m.vencimentoIdx >= 0 ? sanitizeDate(toDate(row[m.vencimentoIdx]), 'vencimento', i + 1) : null;
      const ultimoPagamento = m.dataBaixaIdx >= 0 ? sanitizeDate(toDate(row[m.dataBaixaIdx]), 'data baixa', i + 1) : null;
      const valorLiquido = m.valorParcelaIdx >= 0 ? toNumber(row[m.valorParcelaIdx]) : null;
      const valorPago = m.valorPagoIdx >= 0 ? toNumber(row[m.valorPagoIdx]) : null;
      const categoria = m.categoriaIdx >= 0 ? t(row[m.categoriaIdx]) : '';
      const contaCorrente = m.contaCorrenteIdx >= 0 ? t(row[m.contaCorrenteIdx]) : '';

      if (valorLiquido == null) continue;

      let situacao = 'pendente';
      if (ultimoPagamento) {
        situacao = 'pago';
      } else if (vencimento && vencimento < new Date().toISOString().slice(0, 10)) {
        situacao = 'atrasado';
      }

      rec = { situacao, fornecedor, previsao: null, ultimoPagamento, valorLiquido, categoria, contaCorrente, vencimento, sourceFile, sourceLayout: 'titulos_pagos', valorPago };
    }

    if (rec.vencimento) {
      if (!periodStart || rec.vencimento < periodStart) periodStart = rec.vencimento;
      if (!periodEnd || rec.vencimento > periodEnd) periodEnd = rec.vencimento;
    }

    allParsed.push(rec);
  }
}

if (allParsed.length === 0) {
  warnings.push('Nenhuma linha histórica válida encontrada em nenhuma fonte.');
}

let totalPago = 0;
let totalAtrasado = 0;
for (const r of allParsed) {
  const s = (r.situacao || '').toUpperCase();
  if (s.includes('PAGO')) totalPago += r.valorLiquido;
  if (s.includes('ATRAS')) totalAtrasado += r.valorLiquido;
}

return [{
  json: {
    kind: 'history',
    history: {
      rows: allParsed,
      summary: {
        totalRecords: allParsed.length,
        periodStart,
        periodEnd,
        totalPago: Math.round(totalPago * 100) / 100,
        totalAtrasado: Math.round(totalAtrasado * 100) / 100,
      },
    },
    warnings,
    blockingErrors,
  },
}];
""".strip()



assemble_code = r"""
const all = $input.all();

const context = all.find((i) => i.json?.kind === 'context')?.json || {};
const contasBlock = all.find((i) => i.json?.kind === 'contas')?.json;
const recebidoBlock = all.find((i) => i.json?.kind === 'recebido')?.json;
const resumoBlock = all.find((i) => i.json?.kind === 'resumo')?.json;
const historyBlock = all.find((i) => i.json?.kind === 'history')?.json;

const dailyWarnings = [];
const historyWarnings = [];
const blockingErrors = [];

if (Array.isArray(contasBlock?.warnings)) dailyWarnings.push(...contasBlock.warnings);
if (Array.isArray(recebidoBlock?.warnings)) dailyWarnings.push(...recebidoBlock.warnings);
if (Array.isArray(resumoBlock?.warnings)) dailyWarnings.push(...resumoBlock.warnings);
if (Array.isArray(historyBlock?.warnings)) historyWarnings.push(...historyBlock.warnings);

for (const b of [contasBlock, recebidoBlock, resumoBlock, historyBlock]) {
  if (!b) continue;
  if (Array.isArray(b.blockingErrors)) blockingErrors.push(...b.blockingErrors);
}

const warnings = [...dailyWarnings, ...historyWarnings];

if (!contasBlock) blockingErrors.push('Bloco Contas ausente após extração.');
if (!recebidoBlock) blockingErrors.push('Bloco Recebido ausente após extração.');
if (!historyBlock) blockingErrors.push('Bloco Histórico ausente após extração.');

const rawData = {
  daily: {
    contas: contasBlock?.contas || [],
    recebido: recebidoBlock?.recebido || [],
    resumo: resumoBlock?.resumo || {
      prn_matriz: { despesas: 0, saldos: 0, aplicacoes: 0 },
      prn_locacao: { despesas: 0, saldos: 0, aplicacoes: 0 },
      prn_holding: { despesas: 0, saldos: 0, aplicacoes: 0 },
    },
    warnings: dailyWarnings.map((w) => ({ severity: 'low', source: 'daily', message: String(w) })),
  },
  history: {
    rows: historyBlock?.history?.rows || [],
    summary: historyBlock?.history?.summary || { totalRecords: 0, periodStart: null, periodEnd: null, totalPago: 0, totalAtrasado: 0 },
    warnings: historyWarnings.map((w) => ({ severity: 'low', source: 'history', message: String(w) })),
  },
};

return [{
  json: {
    context,
    rawData,
    warnings,
    blockingErrors,
  },
}];
""".strip()


schema_validation_code = r"""
const item = $input.first().json;
const errors = Array.isArray(item.blockingErrors) ? [...item.blockingErrors] : [];
const warnings = Array.isArray(item.warnings) ? [...item.warnings] : [];

const raw = item.rawData || {};

if (!raw.daily) errors.push('Objeto daily ausente.');
if (!raw.history) errors.push('Objeto history ausente.');
if (!Array.isArray(raw.daily?.contas)) errors.push('daily.contas inválido.');
if (!Array.isArray(raw.daily?.recebido)) errors.push('daily.recebido inválido.');
if (!raw.daily?.resumo || typeof raw.daily.resumo !== 'object') errors.push('daily.resumo inválido.');
if (!Array.isArray(raw.history?.rows)) errors.push('history.rows inválido.');

if ((raw.daily?.contas || []).length === 0) {
  warnings.push('Nenhuma despesa válida encontrada para PRN MATRIZ na diária.');
}

if ((raw.history?.rows || []).length === 0) {
  warnings.push('Histórico sem linhas válidas na aba financas.');
}

if (errors.length > 0) {
  return [{
    json: {
      schemaValid: false,
      requestId: item.context?.requestId || '',
      errorCode: 'SCHEMA_VALIDATION_ERROR',
      error: 'Falha na validação estrutural das planilhas.',
      details: {
        errors,
        warnings,
      },
    },
  }];
}

return [{
  json: {
    schemaValid: true,
    context: item.context,
    rawData: raw,
    warnings,
  },
}];
""".strip()


normalize_calculate_code = (
    normalizer_js
    + "\n"
    + calculator_js
    + "\n"
    + r"""
const item = $input.first().json;

try {
  const normalizedData = normalizeData(item.rawData);
  const financials = calculateFinancials(normalizedData);

  const warnings = [];
  if (Array.isArray(item.warnings)) warnings.push(...item.warnings);
  if (Array.isArray(financials?.warnings)) warnings.push(...financials.warnings);

  return [{
    json: {
      processingValid: true,
      context: item.context,
      normalizedData,
      financials,
      warnings,
    },
  }];
} catch (error) {
  return [{
    json: {
      processingValid: false,
      requestId: item.context?.requestId || '',
      errorCode: 'PROCESSING_ERROR',
      error: error.message || 'Erro no cálculo financeiro.',
      details: { stage: 'normalize-calculate' },
    },
  }];
}
""".strip()
)


build_report_code = (
    report_builder_js
    + "\n"
    + r"""
const item = $input.first().json;

try {
  const context = item.context || {};
  const requestInfo = {
    requestId: context.requestId || '',
    referenceDateUsed: context.referenceDateUsed || new Date().toISOString().slice(0, 10),
    dailyFilename: context.dailyFilename || 'daily.xlsx',
    historyFilename: context.historyFilename || 'history.xlsx',
    dailySheetsFound: ['Contas', 'Recebido', 'Resumo'],
    historySheetsFound: ['financas'],
  };

  const reportModel = buildReportModel(requestInfo, item.normalizedData, item.financials);

  return [{
    json: {
      requestId: context.requestId || '',
      reportModel,
    },
  }];
} catch (error) {
  return [{
    json: {
      requestId: item.context?.requestId || '',
      errorCode: 'REPORT_BUILD_ERROR',
      error: error.message || 'Erro ao montar o relatório.',
      details: { stage: 'build-report-model' },
    },
  }];
}
""".strip()
)


render_report_code = r"""
const item = $input.first().json || {};

const asArray = (v) => (Array.isArray(v) ? v : []);
const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round((toNumber(v) + Number.EPSILON) * 100) / 100;

const buildGroupBySum = (rows, keyField, valueField) => {
  const acc = {};
  for (const row of rows) {
    const key = String(row?.[keyField] || 'Indefinido').trim() || 'Indefinido';
    const value = round2(toNumber(row?.[valueField]));
    if (!acc[key]) {
      acc[key] = { key, total: 0, count: 0 };
    }
    acc[key].total = round2(acc[key].total + value);
    acc[key].count += 1;
  }
  return Object.values(acc).sort((a, b) => b.total - a.total);
};

const buildGroupInfo = (groupObj, rows) => {
  const safeRows = asArray(rows);
  return {
    totalNomes: Number.isFinite(Number(groupObj?.totalNomes))
      ? Number(groupObj.totalNomes)
      : safeRows.length,
    totalValorDia: Number.isFinite(Number(groupObj?.totalValorDia))
      ? round2(groupObj.totalValorDia)
      : round2(safeRows.reduce((acc, r) => acc + toNumber(r?.valorDia), 0)),
    totalHistorico: Number.isFinite(Number(groupObj?.totalHistorico))
      ? round2(groupObj.totalHistorico)
      : round2(safeRows.reduce((acc, r) => acc + toNumber(r?.totalHistorico), 0)),
  };
};

const reportModel = item.reportModel;

if (!reportModel) {
  return [{
    json: {
      ok: false,
      schemaVersion: 1,
      error: {
        code: item.errorCode || 'REPORT_MODEL_MISSING',
        message: item.error || 'Modelo de relatório ausente.',
        details: item.details || null,
      },
      meta: {
        requestId: item.requestId || '',
        generatedAt: new Date().toISOString(),
        httpStatus: 500,
      },
    },
  }];
}

const rm = asObject(reportModel);
const summary = asObject(rm.summary);
const history = asObject(rm.history);
const cross = asObject(rm.crossAnalysis);
const groups = asObject(cross.groups);
const expenses = asArray(rm.expenses);
const receipts = asArray(rm.receipts);
const crossRows = asArray(cross.rows);

const groupedByCategory = buildGroupBySum(expenses, 'categoria', 'valor').map((it) => ({
  categoria: it.key,
  total: round2(it.total),
  count: it.count,
}));

const groupedByAccount = buildGroupBySum(receipts, 'contaCorrente', 'valor').map((it) => ({
  contaCorrente: it.key,
  total: round2(it.total),
  count: it.count,
}));

const topDespesas = asArray(rm.topDespesas).length > 0
  ? asArray(rm.topDespesas)
  : [...expenses]
      .sort((a, b) => toNumber(b?.valor) - toNumber(a?.valor))
      .slice(0, 10);

const despesasPorCategoria = asArray(rm.despesasPorCategoria).length > 0
  ? asArray(rm.despesasPorCategoria)
  : groupedByCategory;

const recebidosPorConta = asArray(rm.recebidosPorConta).length > 0
  ? asArray(rm.recebidosPorConta)
  : groupedByAccount;

const groupRows = {
  comHistorico: asArray(groups.comHistorico?.rows),
  semHistorico: asArray(groups.semHistorico?.rows),
  exatoTodosMeses: asArray(groups.exatoTodosMeses?.rows),
  diferenteEntreMeses: asArray(groups.diferenteEntreMeses?.rows),
  alertaAnaliseManual: asArray(groups.alertaAnaliseManual?.rows),
};

const groupMetrics = {
  comHistorico: buildGroupInfo(groups.comHistorico, groupRows.comHistorico),
  semHistorico: buildGroupInfo(groups.semHistorico, groupRows.semHistorico),
  exatoTodosMeses: buildGroupInfo(groups.exatoTodosMeses, groupRows.exatoTodosMeses),
  diferenteEntreMeses: buildGroupInfo(groups.diferenteEntreMeses, groupRows.diferenteEntreMeses),
  alertaAnaliseManual: buildGroupInfo(groups.alertaAnaliseManual, groupRows.alertaAnaliseManual),
};

const requestId = String(rm.requestId || item.requestId || '');

return [{
  json: {
    ok: true,
    schemaVersion: Number(rm.schemaVersion || 1),
    type: 'prn_dashboard_payload',
    status: String(rm.status || 'success'),
    requestId,
    referenceDateUsed: rm.referenceDateUsed || null,
    generatedAt: new Date().toISOString(),
    request: asObject(rm.request),
    summary,
    dashboard: {
      cards: {
        totalDespesas: round2(summary.totalDespesas),
        totalRecebido: round2(summary.totalRecebido),
        saldoBancario: round2(summary.saldoBancario),
        saldoAplicacoes: round2(summary.saldoAplicacoes),
        transferenciaNecessaria: round2(summary.transferenciaNecessaria),
      },
      crossAnalysis: {
        months: asArray(cross.months),
        totals: {
          totalNomesDia: Number(cross.totalNomesDia || crossRows.length),
          totalValorDia: round2(cross.totalValorDia),
          totalHistoricoCruzado: round2(cross.totalHistoricoCruzado),
        },
        config: asObject(cross.config),
        groups: groupMetrics,
      },
      alerts: {
        manualAnalysisCount: groupMetrics.alertaAnaliseManual.totalNomes,
        warningCount: asArray(rm.warnings).length,
        errorCount: asArray(rm.errors).length,
      },
    },
    data: {
      entities: asArray(rm.entities),
      expenses,
      receipts,
      balances: asArray(rm.balances),
      topDespesas,
      despesasPorCategoria,
      recebidosPorConta,
      history,
      crossAnalysis: {
        months: asArray(cross.months),
        rows: crossRows,
        groups: {
          comHistorico: groupRows.comHistorico,
          semHistorico: groupRows.semHistorico,
          exatoTodosMeses: groupRows.exatoTodosMeses,
          diferenteEntreMeses: groupRows.diferenteEntreMeses,
          alertaAnaliseManual: groupRows.alertaAnaliseManual,
        },
      },
    },
    warnings: asArray(rm.warnings),
    errors: asArray(rm.errors),
    meta: {
      requestId,
      httpStatus: 200,
    },
  },
}];
""".strip()


render_error_code = r"""
const item = $input.first().json || {};

return [{
  json: {
    ok: false,
    schemaVersion: 1,
    error: {
      code: item.errorCode || 'UNKNOWN_ERROR',
      message: item.error || 'Erro inesperado no processamento.',
      details: item.details || null,
    },
    meta: {
      requestId: item.requestId || '',
      generatedAt: new Date().toISOString(),
      httpStatus: 400,
    },
  },
}];
""".strip()


workflow = {
    "name": "PRN Financial Report v4 (Cloud Robust)",
    "nodes": [
        {
            "parameters": {
                "httpMethod": "GET",
                "path": "prn/app",
                "responseMode": "responseNode",
                "options": {},
            },
            "id": "node-webhook-get-v4",
            "name": "Webhook GET",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [180, 180],
            "webhookId": "wh-prn-app-v4",
        },
        {
            "parameters": {"jsCode": serve_form_code},
            "id": "node-code-serve-form-v4",
            "name": "Code: Serve Form",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [430, 180],
        },
        {
            "parameters": {
                "respondWith": "text",
                "responseBody": "={{ $json.html }}",
                "options": {
                    "responseCode": 200,
                    "responseHeaders": {
                        "entries": [
                            {"name": "Content-Type", "value": "text/html; charset=utf-8"}
                        ]
                    }
                },
            },
            "id": "node-respond-form-v4",
            "name": "Respond Form",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [680, 180],
        },
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "prn/report",
                "responseMode": "responseNode",
                "options": {},
            },
            "id": "node-webhook-post-v4",
            "name": "Webhook POST",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [180, 560],
            "webhookId": "wh-prn-report-v4",
        },
        {
            "parameters": {"jsCode": initialize_code},
            "id": "node-code-init-v4",
            "name": "Code: Initialize Request",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [430, 560],
        },
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                    "conditions": [
                        {
                            "id": "cond-required-v4",
                            "leftValue": "={{ $json.valid }}",
                            "rightValue": True,
                            "operator": {"type": "boolean", "operation": "true"},
                        }
                    ],
                    "combinator": "and",
                }
            },
            "id": "node-if-required-v4",
            "name": "IF: Required Files Present",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": [680, 560],
        },
        {
            "parameters": {
                "operation": "xlsx",
                "binaryPropertyName": "daily_file",
                "options": {
                    "sheetName": "Contas",
                    "headerRow": False,
                    "includeEmptyCells": True,
                },
            },
            "id": "node-extract-contas-v4",
            "name": "Extract Daily Contas",
            "type": "n8n-nodes-base.extractFromFile",
            "typeVersion": 1.1,
            "position": [960, 360],
            "continueOnFail": True,
        },
        {
            "parameters": {"jsCode": parse_contas_code},
            "id": "node-parse-contas-v4",
            "name": "Code: Parse Contas",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1190, 360],
        },
        {
            "parameters": {
                "operation": "xlsx",
                "binaryPropertyName": "daily_file",
                "options": {
                    "sheetName": "Recebido",
                    "headerRow": False,
                    "includeEmptyCells": True,
                },
            },
            "id": "node-extract-recebido-v4",
            "name": "Extract Daily Recebido",
            "type": "n8n-nodes-base.extractFromFile",
            "typeVersion": 1.1,
            "position": [960, 500],
            "continueOnFail": True,
        },
        {
            "parameters": {"jsCode": parse_recebido_code},
            "id": "node-parse-recebido-v4",
            "name": "Code: Parse Recebido",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1190, 500],
        },
        {
            "parameters": {
                "operation": "xlsx",
                "binaryPropertyName": "daily_file",
                "options": {
                    "sheetName": "Resumo",
                    "headerRow": False,
                    "includeEmptyCells": True,
                },
            },
            "id": "node-extract-resumo-v4",
            "name": "Extract Daily Resumo",
            "type": "n8n-nodes-base.extractFromFile",
            "typeVersion": 1.1,
            "position": [960, 640],
            "continueOnFail": True,
        },
        {
            "parameters": {"jsCode": parse_resumo_code},
            "id": "node-parse-resumo-v4",
            "name": "Code: Parse Resumo",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1190, 640],
        },
        {
            "parameters": {"jsCode": parse_history_code},
            "id": "node-parse-history-v4",
            "name": "Code: Parse History",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [960, 780],
        },
        {
            "parameters": {
                "mode": "append",
                "numberInputs": 5,
            },
            "id": "node-merge-parsed-v4",
            "name": "Merge Parsed Streams",
            "type": "n8n-nodes-base.merge",
            "typeVersion": 3,
            "position": [1450, 580],
        },
        {
            "parameters": {"jsCode": assemble_code},
            "id": "node-assemble-raw-v4",
            "name": "Code: Assemble Raw Payload",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1700, 580],
        },
        {
            "parameters": {"jsCode": schema_validation_code},
            "id": "node-schema-validation-v4",
            "name": "Code: Schema Validation",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1950, 580],
        },
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                    "conditions": [
                        {
                            "id": "cond-schema-v4",
                            "leftValue": "={{ $json.schemaValid }}",
                            "rightValue": True,
                            "operator": {"type": "boolean", "operation": "true"},
                        }
                    ],
                    "combinator": "and",
                }
            },
            "id": "node-if-schema-v4",
            "name": "IF: Schema Valid",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": [2200, 580],
        },
        {
            "parameters": {"jsCode": normalize_calculate_code},
            "id": "node-normalize-calc-v4",
            "name": "Code: Normalize + Calculate",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [2450, 500],
        },
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                    "conditions": [
                        {
                            "id": "cond-processing-v4",
                            "leftValue": "={{ $json.processingValid }}",
                            "rightValue": True,
                            "operator": {"type": "boolean", "operation": "true"},
                        }
                    ],
                    "combinator": "and",
                }
            },
            "id": "node-if-processing-v4",
            "name": "IF: Processing Valid",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": [2700, 500],
        },
        {
            "parameters": {"jsCode": build_report_code},
            "id": "node-build-report-v4",
            "name": "Code: Build Report Model",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [2950, 420],
        },
        {
            "parameters": {"jsCode": render_report_code},
            "id": "node-render-report-v4",
            "name": "Code: Render Report",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [3200, 420],
        },
        {
            "parameters": {
                "respondWith": "text",
                "responseBody": "={{ JSON.stringify($json) }}",
                "options": {
                    "responseCode": "={{ $json.meta && $json.meta.httpStatus ? $json.meta.httpStatus : 200 }}",
                    "responseHeaders": {
                        "entries": [
                            {"name": "Content-Type", "value": "application/json; charset=utf-8"}
                        ]
                    }
                },
            },
            "id": "node-respond-report-v4",
            "name": "Respond Report",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [3450, 420],
        },
        {
            "parameters": {"jsCode": render_error_code},
            "id": "node-render-error-v4",
            "name": "Code: Render Error",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [2950, 760],
        },
        {
            "parameters": {
                "respondWith": "text",
                "responseBody": "={{ JSON.stringify($json) }}",
                "options": {
                    "responseCode": "={{ $json.meta && $json.meta.httpStatus ? $json.meta.httpStatus : 400 }}",
                    "responseHeaders": {
                        "entries": [
                            {"name": "Content-Type", "value": "application/json; charset=utf-8"}
                        ]
                    }
                },
            },
            "id": "node-respond-error-v4",
            "name": "Respond Error",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1,
            "position": [3200, 760],
        },
    ],
    "connections": {
        "Webhook GET": {
            "main": [[{"node": "Code: Serve Form", "type": "main", "index": 0}]]
        },
        "Code: Serve Form": {
            "main": [[{"node": "Respond Form", "type": "main", "index": 0}]]
        },
        "Webhook POST": {
            "main": [[{"node": "Code: Initialize Request", "type": "main", "index": 0}]]
        },
        "Code: Initialize Request": {
            "main": [[{"node": "IF: Required Files Present", "type": "main", "index": 0}]]
        },
        "IF: Required Files Present": {
            "main": [
                [
                    {"node": "Extract Daily Contas", "type": "main", "index": 0},
                    {"node": "Extract Daily Recebido", "type": "main", "index": 0},
                    {"node": "Extract Daily Resumo", "type": "main", "index": 0},
                    {"node": "Code: Parse History", "type": "main", "index": 0},
                    {"node": "Merge Parsed Streams", "type": "main", "index": 4}
                ],
                [
                    {"node": "Code: Render Error", "type": "main", "index": 0}
                ]
            ]
        },
        "Extract Daily Contas": {
            "main": [[{"node": "Code: Parse Contas", "type": "main", "index": 0}]]
        },
        "Code: Parse Contas": {
            "main": [[{"node": "Merge Parsed Streams", "type": "main", "index": 0}]]
        },
        "Extract Daily Recebido": {
            "main": [[{"node": "Code: Parse Recebido", "type": "main", "index": 0}]]
        },
        "Code: Parse Recebido": {
            "main": [[{"node": "Merge Parsed Streams", "type": "main", "index": 1}]]
        },
        "Extract Daily Resumo": {
            "main": [[{"node": "Code: Parse Resumo", "type": "main", "index": 0}]]
        },
        "Code: Parse Resumo": {
            "main": [[{"node": "Merge Parsed Streams", "type": "main", "index": 2}]]
        },
        "Code: Parse History": {
            "main": [[{"node": "Merge Parsed Streams", "type": "main", "index": 3}]]
        },
        "Merge Parsed Streams": {
            "main": [[{"node": "Code: Assemble Raw Payload", "type": "main", "index": 0}]]
        },
        "Code: Assemble Raw Payload": {
            "main": [[{"node": "Code: Schema Validation", "type": "main", "index": 0}]]
        },
        "Code: Schema Validation": {
            "main": [[{"node": "IF: Schema Valid", "type": "main", "index": 0}]]
        },
        "IF: Schema Valid": {
            "main": [
                [
                    {"node": "Code: Normalize + Calculate", "type": "main", "index": 0}
                ],
                [
                    {"node": "Code: Render Error", "type": "main", "index": 0}
                ]
            ]
        },
        "Code: Normalize + Calculate": {
            "main": [[{"node": "IF: Processing Valid", "type": "main", "index": 0}]]
        },
        "IF: Processing Valid": {
            "main": [
                [
                    {"node": "Code: Build Report Model", "type": "main", "index": 0}
                ],
                [
                    {"node": "Code: Render Error", "type": "main", "index": 0}
                ]
            ]
        },
        "Code: Build Report Model": {
            "main": [[{"node": "Code: Render Report", "type": "main", "index": 0}]]
        },
        "Code: Render Report": {
            "main": [[{"node": "Respond Report", "type": "main", "index": 0}]]
        },
        "Code: Render Error": {
            "main": [[{"node": "Respond Error", "type": "main", "index": 0}]]
        },
    },
    "active": False,
    "settings": {
        "executionOrder": "v1"
    },
    "versionId": "4.0.0",
    "meta": {
        "instanceId": "prn-reporting-v4"
    },
    "pinData": {},
}


WF_OUT.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Generated {WF_OUT}")
print(f"Size: {WF_OUT.stat().st_size} bytes")
print(f"Nodes: {len(workflow['nodes'])}")
