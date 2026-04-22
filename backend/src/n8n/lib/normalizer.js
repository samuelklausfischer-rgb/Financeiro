// =============================================================================
// PRN Reporting - Normalizer Module
// =============================================================================
// Receives raw parsed data from parser-daily.js and parser-history.js and
// normalizes it into a unified, canonical structure for downstream reporting.
//
// Responsibilities:
//   - Normalize entity names (PRN MATRIZ, PRN LOCAÇÃO, PRN HOLDING)
//   - Normalize bank account names (Omie, Unicreds, BB, Bradesco, etc.)
//   - Normalize expense/receipt categories (aluguel, salarios, impostos, etc.)
//   - Normalize payment status strings (pago, atrasado, pendente, etc.)
//   - Filter recebido records to only PRN entities
//   - Generate warnings for unresolvable aliases (severity: "low")
//   - Coerce dates to ISO strings, values to numbers, trim all text
//   - Merge warnings from all parsers plus normalization warnings
// =============================================================================

'use strict';

// =============================================================================
// Alias Maps
// =============================================================================

// Maps every known entity name variant to its canonical code.
// Keys are lower-cased, trimmed for case/accent-insensitive lookup.
const ENTITY_ALIASES = {
  'prn matriz': 'prn_matriz',
  'prn': 'prn_matriz',
  'prn diagnosticos': 'prn_matriz',
  'prn diagnosticos imagem': 'prn_matriz',
  'prn diagnósticos': 'prn_matriz',
  'prn diagnósticos imagem': 'prn_matriz',
  'prn locação': 'prn_locacao',
  'prn locaçao': 'prn_locacao',
  'prn locacao': 'prn_locacao',
  'prn locações': 'prn_locacao',
  'prn locacões': 'prn_locacao',
  'prn holding': 'prn_holding',
  'holding prn': 'prn_holding',
};

// Canonical display labels keyed by canonical entity code.
const ENTITY_LABELS = {
  prn_matriz: 'PRN MATRIZ',
  prn_locacao: 'PRN LOCAÇÃO',
  prn_holding: 'PRN HOLDING',
};

// Maps every known bank account name variant to its canonical code.
const BANK_ALIASES = {
  'omie.cash': 'omie_cash',
  'omie cash': 'omie_cash',
  'omie': 'omie_cash',
  'centrais unicreds itajaí': 'centrais_unicreds_itajai',
  'centrais unicreds itajai': 'centrais_unicreds_itajai',
  'centrais unicreds': 'centrais_unicreds_itajai',
  'unicreds itajaí': 'centrais_unicreds_itajai',
  'unicreds itajai': 'centrais_unicreds_itajai',
  'centrais unicreds ijuí': 'centrais_unicreds_ijui',
  'centrais unicreds ijui': 'centrais_unicreds_ijui',
  'unicreds ijuí': 'centrais_unicreds_ijui',
  'unicreds ijui': 'centrais_unicreds_ijui',
  'banco do brasil': 'banco_do_brasil',
  'bb': 'banco_do_brasil',
  'bradesco': 'bradesco',
  'santander': 'santander',
  'caixa econômica': 'caixa',
  'caixa economica': 'caixa',
  'caixa': 'caixa',
  'itau': 'itau',
  'itú': 'itau',
  'itu': 'itau',
  'sicredi': 'sicredi',
};

// Canonical display labels keyed by canonical bank code.
const BANK_LABELS = {
  omie_cash: 'Omie Cash',
  centrais_unicreds_itajai: 'Centrais Unicreds Itajaí',
  centrais_unicreds_ijui: 'Centrais Unicreds Ijuí',
  banco_do_brasil: 'Banco do Brasil',
  bradesco: 'Bradesco',
  santander: 'Santander',
  caixa: 'Caixa Econômica',
  itau: 'Itaú',
  sicredi: 'Sicredi',
};

// Maps every known category name variant to its canonical key.
// Covers common Brazilian Portuguese variations including typos.
const CATEGORY_ALIASES = {
  // Aluguel
  'aluguel': 'aluguel',
  'alugueis': 'aluguel',
  'aluguéis': 'aluguel',
  'alugáreis': 'aluguel',
  'locacao': 'aluguel',
  'locação': 'aluguel',
  'condominio': 'aluguel',
  'condomínio': 'aluguel',
  // Energia
  'energia': 'energia',
  'energia eletrica': 'energia',
  'energia elétrica': 'energia',
  'luz': 'energia',
  'conta de luz': 'energia',
  'celesc': 'energia',
  // Telefonia / Internet
  'telefonia': 'telefonia',
  'telefone': 'telefonia',
  'telefones': 'telefonia',
  'internet': 'telefonia',
  'celular': 'telefonia',
  'celulares': 'telefonia',
  'vivo': 'telefonia',
  'claro': 'telefonia',
  'tim': 'telefonia',
  'oi': 'telefonia',
  'operadora': 'telefonia',
  // Salários
  'salarios': 'salarios',
  'salários': 'salarios',
  'salario': 'salarios',
  'salário': 'salarios',
  'folha de pagamento': 'salarios',
  'folha': 'salarios',
  'rescisao': 'salarios',
  'rescisão': 'salarios',
  '13o salario': 'salarios',
  'decimo terceiro': 'salarios',
  'ferias': 'salarios',
  'férias': 'salarios',
  'beneficios': 'salarios',
  'benefícios': 'salarios',
  'vale transporte': 'salarios',
  'vale_refeicao': 'vale_refeicao',
  'vale refeicao': 'vale_refeicao',
  'vale refeição': 'vale_refeicao',
  'vale alimentacao': 'salarios',
  'vale alimentação': 'salarios',
  'plano de saude': 'salarios',
  'plano de saúde': 'salarios',
  // Impostos
  'impostos': 'impostos',
  'imposto': 'impostos',
  'tributos': 'impostos',
  'tributo': 'impostos',
  'taxas': 'impostos',
  'fgts': 'impostos',
  'inss': 'impostos',
  'irpj': 'impostos',
  'csll': 'impostos',
  'pis': 'impostos',
  'cofins': 'impostos',
  'icms': 'impostos',
  'iss': 'impostos',
  'ipva': 'impostos',
  'iptu': 'impostos',
  'darf': 'impostos',
  'guia de recolhimento': 'impostos',
  'simples nacional': 'impostos',
  'das': 'impostos',
  // Insumos
  'insumos': 'insumos',
  'insumo': 'insumos',
  'materiais': 'insumos',
  'material': 'insumos',
  'insumos medicos': 'insumos',
  'insumos médicos': 'insumos',
  'suprimentos': 'insumos',
  'descartaveis': 'insumos',
  'descartáveis': 'insumos',
  'consumiveis': 'insumos',
  'consumíveis': 'insumos',
  'filmes': 'insumos',
  'reagentes': 'insumos',
  'contraste': 'insumos',
  // Manutenção
  'manutencao': 'manutencao',
  'manutenção': 'manutencao',
  'manutenção preventiva': 'manutencao',
  'manutencao preventiva': 'manutencao',
  'manutenção corretiva': 'manutencao',
  'manutencao corretiva': 'manutencao',
  'conserto': 'manutencao',
  'reparo': 'manutencao',
  'reparos': 'manutencao',
  'assistencia tecnica': 'manutencao',
  'assistência técnica': 'manutencao',
  'conservacao': 'manutencao',
  'conservação': 'manutencao',
  // Software / TI
  'software': 'software',
  'softwares': 'software',
  'sistema': 'software',
  'sistemas': 'software',
  'licenca': 'software',
  'licença': 'software',
  'licencas': 'software',
  'licenças': 'software',
  'assinatura': 'software',
  'assinaturas': 'software',
  'saas': 'software',
  'ti': 'software',
  'tecnologia': 'software',
  'tecnologia da informacao': 'software',
  'tecnologia da informação': 'software',
  'cloud': 'software',
  'hosting': 'software',
  'hospedagem': 'software',
  'dominio': 'software',
  'domínio': 'software',
  // Marketing
  'marketing': 'marketing',
  'publicidade': 'marketing',
  'propaganda': 'marketing',
  'divulgacao': 'marketing',
  'divulgação': 'marketing',
  'anuncio': 'marketing',
  'anúncio': 'marketing',
  'google ads': 'marketing',
  'facebook ads': 'marketing',
  'midia social': 'marketing',
  'mídia social': 'marketing',
  'redes sociais': 'marketing',
  'site': 'marketing',
  'website': 'marketing',
  // Transporte
  'transporte': 'transporte',
  'transportes': 'transporte',
  'combustivel': 'transporte',
  'combustível': 'transporte',
  'combustiveis': 'transporte',
  'combustíveis': 'transporte',
  'gasolina': 'transporte',
  'etanol': 'transporte',
  'diesel': 'transporte',
  'pedagio': 'transporte',
  'pedágio': 'transporte',
  'estacionamento': 'transporte',
  'frota': 'transporte',
  'veiculo': 'transporte',
  'veículo': 'transporte',
  'uber': 'transporte',
  '99': 'transporte',
  'corrida': 'transporte',
    'veiculos (socios)': 'veiculos_socios',
    'veículos (sócios)': 'veiculos_socios',
    'veiculo (socio)': 'veiculos_socios',
    'veículo (sócio)': 'veiculos_socios',
    'veic (socios)': 'veiculos_socios',
    'veic (sócios)': 'veiculos_socios',
    'veic. (socios)': 'veiculos_socios',
    'veic. (sócios)': 'veiculos_socios',
    'veic socios': 'veiculos_socios',
    'veic sócios': 'veiculos_socios',
    'veiculos socios': 'veiculos_socios',
    'veículos sócios': 'veiculos_socios',
    'veiculo socio': 'veiculos_socios',
    'veículo sócio': 'veiculos_socios',
    'veiculos de socios': 'veiculos_socios',
    'veículos de sócios': 'veiculos_socios',
  // Seguros
  'seguros': 'seguros',
  'seguro': 'seguros',
  'apolice': 'seguros',
  'apólice': 'seguros',
  'seguro de vida': 'seguros',
  'seguro patrimonial': 'seguros',
  'seguro empresarial': 'seguros',
  'responsabilidade civil': 'seguros',
  // Profissionais
  'profissionais': 'profissionais',
  'profissional': 'profissionais',
  'terceirizados': 'profissionais',
  'terceirizado': 'profissionais',
  'consultoria': 'profissionais',
  'consultor': 'profissionais',
  'auditoria': 'profissionais',
  'contabilidade': 'profissionais',
  'advocacia': 'profissionais',
  'juridico': 'profissionais',
  'jurídico': 'profissionais',
  'honorarios': 'profissionais',
  'honorários': 'profissionais',
  'escritorio contabil': 'profissionais',
  'escritório contábil': 'profissionais',
  // Utilities (genérico)
  'utilities': 'utilities',
  'utilidades': 'utilities',
  'servicos gerais': 'utilities',
  'serviços gerais': 'utilities',
  'diversos': 'utilities',
  'outros': 'utilities',
  'geral': 'utilities',

  // === SERVIÇOS ===
  'servicos_contabeis': 'servicos_contabeis',
  'serviços contábeis': 'servicos_contabeis',
  'escritorio contabil': 'servicos_contabeis',
  'escritório contábil': 'servicos_contabeis',
  'honorarios_medicos_pj': 'honorarios_medicos',
  'honorários médicos pj': 'honorarios_medicos',
  'honorarios medicos': 'honorarios_medicos',
  'honorários médicos': 'honorarios_medicos',
  'medicina ocupacional': 'honorarios_medicos',
  'servicos_informatica': 'servicos_informatica',
  'serviços de informática': 'servicos_informatica',
  'suporte ti': 'servicos_informatica',
  'prestadores_terceirizados': 'prestadores_terceirizados',
  'prestadores terceirizados': 'prestadores_terceirizados',
  'terceirizados': 'prestadores_terceirizados',
  'taxas': 'taxas',
  'taxa': 'taxas',

  // === REEMBOLSO ===
  'reembolso_material': 'reembolso_material',
  'material de instalacoes': 'reembolso_material',
  'material de instalações': 'reembolso_material',
  'material de manutencao': 'reembolso_material',
  'material de manutenção': 'reembolso_material',
  'reparo': 'reembolso_material',
  'reparos': 'reembolso_material',
  'compra material hospitalar': 'reembolso_material',
  'material hospitalar': 'reembolso_material',
  'equipamentos_informatica': 'reembolso_material',
  'equipamentos de informática': 'reembolso_material',
  'hardware': 'reembolso_material',
  'saida_socio': 'saida_socio',
  'saída de sócio': 'saida_socio',
  'pro labore': 'saida_socio',
  'pro-labore': 'saida_socio',
  'veiculos socios': 'veiculos_socios',
  'veículos sócios': 'veiculos_socios',
};

// Canonical display labels keyed by canonical category code.
const CATEGORY_LABELS = {
  aluguel: 'Aluguel',
  energia: 'Energia',
  telefonia: 'Telefonia',
  salarios: 'Salários',
  impostos: 'Impostos',
  insumos: 'Insumos',
  manutencao: 'Manutenção',
  software: 'Software',
  marketing: 'Marketing',
  transporte: 'Transporte',
  veiculos_socios: 'Veículos (Sócios)',
  seguros: 'Seguros',
  profissionais: 'Profissionais',
  utilities: 'Utilities',
  // Novas Categorias
  servicos_contabeis: 'Serviços Contábeis',
  honorarios_medicos: 'Honorários Médicos PJ',
  servicos_informatica: 'Serviços de Informática',
  prestadores_terceirizados: 'Prestadores Terceirizados',
  taxas: 'Taxas',
  reembolso_material: 'Reembolso Material',
  saida_socio: 'Saída de Sócio',
};

// Maps category to type: 'servico' or 'reembolso'
const CATEGORY_TYPE_MAP = {
  // Servicos
  servicos_contabeis: 'servico',
  honorarios_medicos: 'servico',
  servicos_informatica: 'servico',
  prestadores_terceirizados: 'servico',
  taxas: 'servico',
  // Reembolso
  reembolso_material: 'reembolso',
  saida_socio: 'reembolso',
  veiculos_socios: 'reembolso',
  // Legacy categories -> default to servico for backwards compatibility
  profissionais: 'servico',
  software: 'servico',
  manutencao: 'reembolso',
  salarios: 'servico',
};

function getExpenseType(categoryCode) {
  if (!categoryCode) return 'servico';
  return CATEGORY_TYPE_MAP[categoryCode] || 'servico';
}

// Maps every known payment status variant to its canonical code.
const STATUS_ALIASES = {
  'pago': 'pago',
  'paga': 'pago',
  'pagos': 'pago',
  'pagas': 'pago',
  'liquidado': 'pago',
  'liquidada': 'pago',
  'quitado': 'pago',
  'quitada': 'pago',
  'baixado': 'pago',
  'atrasado': 'atrasado',
  'atrasada': 'atrasado',
  'em atraso': 'atrasado',
  'vencido': 'atrasado',
  'vencida': 'atrasado',
  'inadimplente': 'atrasado',
  'pago parcialmente': 'pago_parcialmente',
  'paga parcialmente': 'pago_parcialmente',
  'pagamento parcial': 'pago_parcialmente',
  'parcial': 'pago_parcialmente',
  'pendente': 'pendente',
  'pendente de pagamento': 'pendente',
  'a pagar': 'pendente',
  'aberto': 'pendente',
  'em aberto': 'pendente',
  'agendado': 'pendente',
  'cancelado': 'cancelado',
  'cancelada': 'cancelado',
  'estornado': 'cancelado',
  'estornada': 'cancelado',
  'excluido': 'cancelado',
  'excluído': 'cancelado',
};

// Canonical display labels keyed by canonical status code.
const STATUS_LABELS = {
  pago: 'Pago',
  atrasado: 'Atrasado',
  pago_parcialmente: 'Pago Parcialmente',
  pendente: 'Pendente',
  cancelado: 'Cancelado',
};

// Set of known entity codes for filtering recebido records.
const PRN_ENTITY_CODES = new Set([
  'prn_matriz',
  'prn_locacao',
  'prn_holding',
]);

// =============================================================================
// Lookup Helpers
// =============================================================================

/**
 * Looks up a value in an alias map using case/accent-insensitive matching.
 * Returns the canonical code, or the original input trimmed if no match.
 */
function normalizeLookupKey(raw) {
  if (!raw || typeof raw !== 'string') return '';

  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function resolveAlias(raw, aliasMap) {
  if (!raw || typeof raw !== 'string') return null;
  const key = normalizeLookupKey(raw);

  if (aliasMap[key]) {
    return aliasMap[key];
  }

  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (normalizeLookupKey(alias) === key) {
      return canonical;
    }
  }

  return null;
}

/**
 * Normalizes a bank account name: returns the canonical code.
 */
function normalizeBank(raw) {
  return resolveAlias(raw, BANK_ALIASES);
}

/**
 * Normalizes an entity name: returns the canonical code.
 */
function normalizeEntity(raw) {
  return resolveAlias(raw, ENTITY_ALIASES);
}

/**
 * Normalizes a category name: returns the canonical code.
 */
function normalizeCategory(raw) {
  return resolveAlias(raw, CATEGORY_ALIASES);
}

/**
 * Normalizes a payment status: returns the canonical code.
 */
function normalizeStatus(raw) {
  return resolveAlias(raw, STATUS_ALIASES);
}

// =============================================================================
// Date Helpers
// =============================================================================

/**
 * Attempts to parse a date value into an ISO string.
 * Accepts Date objects, ISO strings, or Brazilian "dd/mm/yyyy" strings.
 * Returns null if unparseable.
 */
function toISODate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Numeric strings are treated as Excel serial dates when plausible.
  // Plain year-like strings (e.g. "2502") are rejected to avoid false positives.
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum > 20000 && asNum < 90000) {
      const wholeDays = Math.floor(asNum);
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(excelEpoch + wholeDays * 86400000);
      return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }
    return null;
  }

  // Try native ISO parse first
  const isoLike = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoLike) {
    const [, year, month, day] = isoLike;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  // Try Brazilian dd/mm/yyyy or dd/mm/yyyy hh:mm
  const brMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  // Last resort only for clearly date-like strings.
  if (/[\-/:T]/.test(trimmed)) {
    const native = new Date(trimmed);
    if (!isNaN(native.getTime())) {
      return native.toISOString().slice(0, 10);
    }
  }

  return null;
}

// =============================================================================
// Value Helpers
// =============================================================================

/**
 * Coerces a value to a number. Handles string numbers with common
 * Brazilian formatting (dot as thousands separator, comma as decimal).
 * Returns NaN if unparseable.
 */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    // Remove R$ prefix, spaces, and common currency symbols
    let cleaned = value
      .replace(/[R$\s]/g, '')
      .replace(/\.(?=\d{3})/g, '')   // remove thousands separators (dots)
      .replace(/,/g, '.');            // decimal comma -> dot

    // Handle edge case where cleaned string ends with a dot
    cleaned = cleaned.replace(/\.$/, '');

    const parsed = Number(cleaned);
    return isNaN(parsed) ? NaN : parsed;
  }

  return NaN;
}

/**
 * Trims a string value, or returns null for falsy input.
 */
function trimText(value) {
  if (!value || typeof value !== 'string') return null;
  return value.trim();
}

// =============================================================================
// Warning Helpers
// =============================================================================

/**
 * Creates a normalization warning object.
 */
function makeWarning(source, field, rawValue, message) {
  return {
    severity: 'low',
    source: `normalizer:${source}`,
    field,
    raw: rawValue ?? null,
    message,
  };
}

// =============================================================================
// Build Entity Summaries
// =============================================================================

/**
 * Builds the entities array from the daily resumo data.
 * Each entity gets its bank balance, applications, expenses total,
 * and received total from the parsed summary.
 */
function buildEntities(resumo, warnings) {
  const entityCodes = ['prn_matriz', 'prn_locacao', 'prn_holding'];
  const entities = [];

  for (const code of entityCodes) {
    const raw = resumo?.[code] || {};
    const label = ENTITY_LABELS[code] || code;

entities.push({
      code,
      label,
      saldoBancario: toNumber(raw.saldos) || 0,
      despesas: toNumber(raw.despesas) || 0,
      recebimento: toNumber(raw.recebido) || 0,
    });
  }

  return entities;
}

// =============================================================================
// Normalize Expenses (Contas a Pagar)
// =============================================================================

/**
 * Normalizes the daily contas array into the canonical expense format.
 * Attempts to resolve entity, bank, and category from the raw record.
 */
function normalizeExpenses(contas, warnings) {
  if (!Array.isArray(contas)) return [];

  let categoryWarningCount = 0;

  return contas.map((item, idx) => {
    const entity = normalizeEntity(item.empresa || item.entidade || item.favorecido);
    const contaCorrenteRaw = trimText(item.contaCorrente || item.conta_corrente || item.banco);
    const contaCorrente = normalizeBank(contaCorrenteRaw);
    const categoriaRaw = trimText(item.categoria || item.categoria_descricao);
    const categoria = normalizeCategory(categoriaRaw);

    // Warn about unresolvable aliases
    if (!entity && contaCorrenteRaw) {
      // Only warn if there is context suggesting an entity was intended
    }
    if (contaCorrenteRaw && !contaCorrente) {
      warnings.push(
        makeWarning('expenses', 'contaCorrente', contaCorrenteRaw,
          `Unknown bank alias "${contaCorrenteRaw}" at index ${idx}`)
      );
    }
    if (categoriaRaw && !categoria && categoriaRaw.toLowerCase() !== 'sem categoria' && categoryWarningCount < 10) {
      categoryWarningCount += 1;
      warnings.push(
        makeWarning('expenses', 'categoria', categoriaRaw,
          `Unknown category alias "${categoriaRaw}" at index ${idx}`)
      );
    }

    return {
      entity: entity || null,
      vencimento: toISODate(item.vencimento),
      favorecido: trimText(item.favorecido) || trimText(item.fornecedor),
      categoria,
      categoriaOriginal: categoriaRaw,
      departamento: trimText(item.departamento),
      valor: toNumber(item.valor) || 0,
      parcela: trimText(item.parcela),
      contaCorrente: contaCorrente || null,
      contaCorrenteOriginal: contaCorrenteRaw,
      observacao: trimText(item.observacao) || trimText(item.obs) || trimText(item.descricao),
    };
  });
}

// =============================================================================
// Normalize Receipts (Recebido)
// =============================================================================

/**
 * Normalizes the daily recebido array.
 * Filters to only records belonging to PRN entities.
 */
function normalizeReceipts(recebido, warnings) {
  if (!Array.isArray(recebido)) return [];

  const filtered = recebido.filter((item) => {
    const empresa = trimText(item.empresa) || '';
    const code = normalizeEntity(empresa);

    if (code && PRN_ENTITY_CODES.has(code)) {
      return true;
    }

    // If isPrn flag is explicitly set, include it regardless of entity name
    if (item.isPrn === true || item.isPrn === 'true' || item.isPrn === 1) {
      return true;
    }

    return false;
  });

  return filtered.map((item, idx) => {
    const empresa = trimText(item.empresa) || '';
    const entity = normalizeEntity(empresa) || null;
    const contaCorrenteRaw = trimText(item.contaCorrente || item.conta_corrente || item.banco);
    const contaCorrente = normalizeBank(contaCorrenteRaw);
    const categoriaRaw = trimText(item.categoria);

    if (contaCorrenteRaw && !contaCorrente) {
      warnings.push(
        makeWarning('receipts', 'contaCorrente', contaCorrenteRaw,
          `Unknown bank alias "${contaCorrenteRaw}" at index ${idx}`)
      );
    }

    return {
      entity,
      data: toISODate(item.data),
      descricao: trimText(item.descricao),
      contaCorrente: contaCorrente || null,
      contaCorrenteOriginal: contaCorrenteRaw,
      valor: toNumber(item.valor) || 0,
      categoria: normalizeCategory(categoriaRaw),
      categoriaOriginal: categoriaRaw,
      conciliado: item.conciliado === true || item.conciliado === 'true' || item.conciliado === 1,
    };
  });
}

// =============================================================================
// Build Balances
// =============================================================================

/**
 * Builds the balances array from entity summaries.
 * Each entity's saldoBancario is attributed to the "default" bank group.
 */
function buildBalances(entities) {
  const balances = [];

  for (const entity of entities) {
    // If the entity has bank-level breakdowns in resumo, use those.
    // Otherwise, report saldoBancario as a single entry.
    if (entity.saldoBancario !== 0) {
      balances.push({
        entity: entity.code,
        contaCorrente: 'total',
        saldo: entity.saldoBancario,
      });
    }
  }

  return balances;
}

// =============================================================================
// Normalize History
// =============================================================================

/**
 * Normalizes the history rows and builds a summary.
 */
function normalizeHistory(history) {
  if (!history || !history.rows) {
    return {
      rows: [],
      summary: {
        totalRecords: 0,
        periodStart: null,
        periodEnd: null,
        totalPago: 0,
        totalAtrasado: 0,
      },
    };
  }

  const normalizedRows = history.rows.map((row) => {
    const contaCorrenteRaw = trimText(row.contaCorrente || row.conta_corrente || row.banco);
    const contaCorrente = normalizeBank(contaCorrenteRaw);
    const categoriaRaw = trimText(row.categoria);

    return {
      situacao: normalizeStatus(row.situacao || row.status) || trimText(row.situacao),
      situacaoOriginal: trimText(row.situacao) || trimText(row.status),
      fornecedor: trimText(row.fornecedor) || trimText(row.favorecido),
      previsao: toISODate(row.previsao),
      ultimoPagamento: toISODate(row.ultimoPagamento || row.ultimo_pagamento),
      valorLiquido: toNumber(row.valorLiquido || row.valor_liquido || row.valor) || 0,
      valorPago: toNumber(row.valorPago || row.valor_pago) || 0,
      categoria: normalizeCategory(categoriaRaw),
      categoriaOriginal: categoriaRaw,
      contaCorrente: contaCorrente || null,
      contaCorrenteOriginal: contaCorrenteRaw,
      vencimento: toISODate(row.vencimento),
      sourceFile: trimText(row.sourceFile),
      sourceLayout: trimText(row.sourceLayout),
    };
  });

  // Build summary by aggregating normalized rows
  let totalPago = 0;
  let totalAtrasado = 0;
  let periodStart = null;
  let periodEnd = null;

  for (const row of normalizedRows) {
    const situacao = row.situacao;
    if (situacao === 'pago' || situacao === 'pago_parcialmente') {
      totalPago += row.valorLiquido;
    }
    if (situacao === 'atrasado') {
      totalAtrasado += row.valorLiquido;
    }

    const venc = row.vencimento;
    if (venc) {
      if (!periodStart || venc < periodStart) periodStart = venc;
      if (!periodEnd || venc > periodEnd) periodEnd = venc;
    }
  }

  return {
    rows: normalizedRows,
    summary: {
      totalRecords: normalizedRows.length,
      periodStart,
      periodEnd,
      totalPago: Math.round(totalPago * 100) / 100,
      totalAtrasado: Math.round(totalAtrasado * 100) / 100,
    },
  };
}

// =============================================================================
// Main Normalizer Function
// =============================================================================

/**
 * Normalizes raw parsed data from parser-daily.js and parser-history.js.
 *
 * @param {Object} rawData - Raw parsed data with `daily` and `history` keys.
 * @returns {Object} Normalized data with entities, expenses, receipts, balances,
 *                   history, and warnings.
 */
function normalizeData(rawData) {
  const warnings = [];

  // Collect warnings from both parsers if present
  const dailyWarnings = rawData?.daily?.warnings || [];
  const historyWarnings = rawData?.history?.warnings || [];

  for (const w of dailyWarnings) {
    warnings.push({
      severity: w.severity || 'low',
      source: w.source || 'parser:daily',
      field: w.field || null,
      raw: w.raw ?? null,
      message: w.message || String(w),
    });
  }

  for (const w of historyWarnings) {
    warnings.push({
      severity: w.severity || 'low',
      source: w.source || 'parser:history',
      field: w.field || null,
      raw: w.raw ?? null,
      message: w.message || String(w),
    });
  }

  // Build entities from daily resumo
  const entities = buildEntities(rawData?.daily?.resumo, warnings);

  // Normalize expenses (contas a pagar)
  const expenses = normalizeExpenses(rawData?.daily?.contas, warnings);

  // Normalize receipts (recebido) - filtered to PRN entities only
  const receipts = normalizeReceipts(rawData?.daily?.recebido, warnings);

  // Build balances from entities
  const balances = buildBalances(entities);

  // Normalize history rows and summary
  const history = normalizeHistory(rawData?.history);

  return {
    entities,
    expenses,
    receipts,
    balances,
    history,
    warnings,
  };
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  normalizeData,
  // Export individual normalizers and maps for testing/extension
  normalizeEntity,
  normalizeBank,
  normalizeCategory,
  normalizeStatus,
  normalizeLookupKey,
  toISODate,
  toNumber,
  trimText,
  ENTITY_ALIASES,
  ENTITY_LABELS,
  BANK_ALIASES,
  BANK_LABELS,
  CATEGORY_ALIASES,
  CATEGORY_LABELS,
  CATEGORY_TYPE_MAP,
  getExpenseType,
  STATUS_ALIASES,
  STATUS_LABELS,
};
