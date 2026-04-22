/**
 * calculator.js - Financial Calculation Engine for PRN Reporting
 *
 * Receives normalized data from normalizer.js and performs the financial
 * calculations required by the n8n reporting workflow.
 *
 * Output:
 *   {
 *     summary,
 *     topDespesas,
 *     despesasPorCategoria,
 *     recebidosPorConta,
 *     historyAnalysis,
 *     crossAnalysis,
 *     warnings,
 *   }
 */

'use strict';

const {
  CATEGORY_LABELS,
  getExpenseType,
  normalizeLookupKey,
} = require('./normalizer');

const SALARY_LIKE_MARKER = '__salary_like__';
const SKIP_CROSS_ANALYSIS_MARKER = '__skip_cross_analysis__';

const CROSS_CATEGORY_LABELS = {
  salarios_pessoas: 'Salarios / Pessoa',
  salarios_empresas: 'Salarios / Empresa',
  salarios_indefinido: 'Salarios / Tipo Indefinido',
  reembolso_pessoas: 'Reembolso / Pessoa',
  emprestimos: 'Emprestimos',
  investimentos_infraestrutura: 'Investimentos Infraestrutura',
  bens_equipamentos: 'Bens / Equipamentos',
  devolucao_valor_exame: 'Devolucao Valor Exame',
};

const COMPANY_MARKERS = [
  'ltda',
  'mei',
  'eireli',
  'clinica',
  'hospital',
  'centro',
  'lab',
  'laboratorio',
  'diagnosticos',
  'imagem',
  'servicos',
  'comercio',
  'associacao',
  'instituto',
  'ambulancia',
  'vigilancia',
  'seguranca',
  'empresa',
  'grupo',
  'radiologia',
  'medicina',
  'coleta',
  'transportes',
  'distribuicao',
  'industria',
  'farmaceutica',
  'equipamentos',
  'solucoes',
  'tecnologia',
  'consultoria',
  'engenharia',
  'construcao',
  'manutencao',
  'administradora',
  'representacoes',
  'fornecimentos',
  'suprimentos',
];

// Marcadores de banco/instituição financeira para classifyPayeeType()
const BANK_MARKERS = [
  'banco',
  'bank',
  'caixa economica',
  'caixa federal',
  'caixa cartoes',
  'caixa cartões',
  'bradesco',
  'santander',
  'itau',
  'sicredi',
  'unicreds',
  'bb ',
  'bndes',
  'credito',
  'creditos',
  'financeira',
  'financeiro',
  'investimento',
  'corretora',
  'bpce',
  'bv financeira',
  'bv leasing',
  'leasing',
  'financiamento',
  'arrendamento',
  'fundo de',
];

const PERSON_TITLES = new Set(['dr', 'dra', 'sr', 'sra', 'prof', 'profa']);
const SALARY_LIKE_CATEGORY_CODES = new Set([
  'honorarios_medicos',
  'prestadores_terceirizados',
]);

// Mapa de subcategorias fiscais: texto original normalizado → código canônico
// Usado para separar impostos no cruzamento histórico por subcategoria
const TAX_SUBCATEGORY_RAW_MAP = Object.fromEntries(
  Object.entries({
    // IRRF / IR
    IRRF: 'irrf',
    'IRRF Retido': 'irrf',
    'IR Retido na Fonte': 'irrf',
    'IRRF - Funcionarios': 'irrf',
    'IRRF - Funcionários': 'irrf',
    // PIS
    PIS: 'pis',
    'PIS/PASEP': 'pis',
    // COFINS
    COFINS: 'cofins',
    // IRPJ
    IRPJ: 'irpj',
    // CSLL
    CSLL: 'csll',
    'Contribuicao Social': 'contribuicao_social',
    'Contribuição Social': 'contribuicao_social',
    'CSLL - Contribuicao Social': 'csll',
    'CSLL - Contribuição Social': 'csll',
    // ISS / ISSQN
    ISS: 'iss',
    'ISS Retido': 'iss',
    ISSQN: 'iss',
    'ISSQN Retido': 'iss',
    // IOF
    IOF: 'iof',
    'Tarifas IOF': 'iof',
    // Simples Nacional / DAS
    'Simples Nacional': 'simples_nacional',
    DAS: 'simples_nacional',
    // DARF
    DARF: 'darf',
    // ICMS
    ICMS: 'icms',
    // IPTU
    IPTU: 'iptu',
    // IPVA
    IPVA: 'ipva',
    // CRF (decisão: imposto próprio)
    CRF: 'crf',
    // FGTS / INSS (decisão: separar de salários)
    FGTS: 'fgts',
    'FGTS - Funcionários': 'fgts',
    'FGTS - Funcionarios': 'fgts',
    INSS: 'inss',
    'INSS Empresa': 'inss',
    'INSS - Funcionários': 'inss',
    'INSS - Funcionarios': 'inss',
  }).map(([raw, target]) => [normalizeSemanticText(raw), target]),
);

// Labels legíveis para cada subcategoria fiscal
const TAX_SUBCATEGORY_LABELS = {
  irrf: 'IRRF',
  pis: 'PIS',
  cofins: 'COFINS',
  irpj: 'IRPJ',
  csll: 'CSLL',
  contribuicao_social: 'Contribuição Social',
  iss: 'ISS',
  iof: 'IOF',
  simples_nacional: 'Simples Nacional',
  darf: 'DARF',
  icms: 'ICMS',
  iptu: 'IPTU',
  ipva: 'IPVA',
  crf: 'CRF',
  fgts: 'FGTS',
  inss: 'INSS',
};

const CROSS_CATEGORY_RAW_MAP = Object.fromEntries(
  Object.entries({
    // ---- Aluguel / Locação ----
    Aluguel: 'aluguel',
    'Locacao Equipamentos': 'aluguel',
    'Locação Equipamentos': 'aluguel',
    'Locacao de Equipamentos': 'aluguel',
    'Locação de Equipamentos': 'aluguel',
    Condominio: 'aluguel',
    Condomínio: 'aluguel',

    // ---- Energia ----
    'Energia Eletrica': 'energia',
    'Energia Elétrica': 'energia',
    Celesc: 'energia',

    // ---- Telefonia / Internet ----
    'Internet/telefonia': 'telefonia',
    'Internet/Telefonia': 'telefonia',
    'Telefone/Internet': 'telefonia',
    Telefonia: 'telefonia',
    Internet: 'telefonia',

    // ---- Água ----
    Agua: 'utilities',
    Água: 'utilities',
    'Agua/Esgoto': 'utilities',
    'Água/Esgoto': 'utilities',

    // ---- Software / Sistemas ----
    'Sistemas/Softwares': 'software',
    'Sistemas/Software': 'software',
    Software: 'software',
    Sistemas: 'software',

    // ---- Salários ----
    'Salarios e Ordenados': 'salarios',
    'Salários e Ordenados': 'salarios',
    'Vale Transporte': 'salarios',
    'Vale-Transporte': 'salarios',
    Rescisao: 'salarios',
    Rescisão: 'salarios',
    'Ferias e 1/3': 'salarios',
    'Férias e 1/3': 'salarios',
    Ferias: 'salarios',
    Férias: 'salarios',
    'Decimo Terceiro': 'salarios',
    'Décimo Terceiro': 'salarios',
    '13o Salario': 'salarios',
    Beneficios: 'salarios',
    Benefícios: 'salarios',
    'Plano de Saude': 'salarios',
    'Plano de Saúde': 'salarios',
    'Vale Alimentacao': 'salarios',
    'Vale Alimentação': 'salarios',
    'Vale Refeicao': 'vale_refeicao',
    'Vale Refeição': 'vale_refeicao',
    'Folha de Pagamento': 'salarios',

    // ---- Impostos ----
    ISS: 'impostos',
    'ISS Retido': 'impostos',
    'ISSQN Retido': 'impostos',
    PIS: 'impostos',
    COFINS: 'impostos',
    IRPJ: 'impostos',
    CSLL: 'impostos',
    IRRF: 'impostos',
    'IRRF Retido': 'impostos',
    'IR Retido na Fonte': 'impostos',
    'Tarifas IOF': 'impostos',
    IOF: 'impostos',
    'Simples Nacional': 'impostos',
    DARF: 'impostos',
    ICMS: 'impostos',
    IPTU: 'impostos',
    IPVA: 'impostos',

    // ---- Taxas ----
    Taxas: 'taxas',
    'Alvara de Funcionamento': 'taxas',
    'Alvará de Funcionamento': 'taxas',
    CRF: 'impostos',
    'Anuidade CRM': 'taxas',
    'Anuidade CFM': 'taxas',
    'Tarifas bancarias': 'taxas',
    'Tarifas bancárias': 'taxas',
    'Tarifas Bancarias': 'taxas',
    'Tarifas Bancárias': 'taxas',
    'Taxa Bancaria': 'taxas',
    'Taxa Bancária': 'taxas',
    'Taxas Cartorio': 'taxas',
    'Taxas Cartório': 'taxas',
    'Registro de Contratos': 'taxas',

    // ---- Seguros ----
    'Seguro de Vida': 'seguros',
    'Seguro Vida': 'seguros',
    Seguro: 'seguros',
    Seguros: 'seguros',
    'Seguro Patrimonial': 'seguros',
    'Seguro Empresarial': 'seguros',

    // ---- Marketing ----
    'Marketing/Midias Sociais': 'marketing',
    'Marketing/Mídias Sociais': 'marketing',
    'Marketing/Midia Social': 'marketing',
    Marketing: 'marketing',

    // ---- Transporte ----
    'Frete/Transporte': 'transporte',
    'Frete / Transporte': 'transporte',
    Transporte: 'transporte',
    Combustivel: 'transporte',
    Combustível: 'transporte',
    'Veiculos (Socios)': 'veiculos_socios',
    'Veículos (Sócios)': 'veiculos_socios',
    'Veiculo (Socio)': 'veiculos_socios',
    'Veículo (Sócio)': 'veiculos_socios',
    'Veic. (Socios)': 'veiculos_socios',
    'Veic. (Sócios)': 'veiculos_socios',
    'Veiculos Socios': 'veiculos_socios',
    'Veículos Sócios': 'veiculos_socios',
    'Veiculo Socio': 'veiculos_socios',
    'Veículo Sócio': 'veiculos_socios',
    Veiculo: 'transporte',
    Veículo: 'transporte',

    // ---- Insumos / Materiais ----
    'Material/Medicamento/Gases': 'insumos',
    'Material/Medicamentos/Gases': 'insumos',
    'Material Expediente': 'insumos',
    'MATERIAL DE ESCRITORIO': 'insumos',
    'MATERIAL DE ESCRITÓRIO': 'insumos',
    'Materiais Papelaria': 'insumos',
    'Material de Escritorio': 'insumos',
    'Material de Escritório': 'insumos',
    'Equip. de Seguranca (Dosimetros)': 'insumos',
    'Equip. de Segurança (Dosimetros)': 'insumos',
    'Material de Limpeza/Higiene': 'insumos',
    'Material de Limpeza': 'insumos',
    Impressoras: 'insumos',
    'Compra de Material de Injecao de Contraste': 'insumos',
    'Compra de Material de Injeção de Contraste': 'insumos',
    'Material de Injecao de Contraste': 'insumos',
    'Material de Injeção de Contraste': 'insumos',
    Contraste: 'insumos',
    Insumos: 'insumos',
    'Materiais Medicos': 'insumos',
    'Materiais Médicos': 'insumos',
    'Suprimentos Medicos': 'insumos',
    'Suprimentos Médicos': 'insumos',

    // ---- Manutenção ----
    'Reparos e instalacoes.': 'manutencao',
    'Reparos e instalações.': 'manutencao',
    'Reparos e Instalacoes': 'manutencao',
    'Reparos e Instalações': 'manutencao',
    'Manutencao geral': 'manutencao',
    'Manutenção geral': 'manutencao',
    'Manutencao Geral': 'manutencao',
    'Manutenção Geral': 'manutencao',
    'Manutencao Ar Condicionado': 'manutencao',
    'Manutenção Ar Condicionado': 'manutencao',
    'Manutencao TC': 'manutencao',
    'Manutenção TC': 'manutencao',
    'Manut. (US, RX, Mamo, Densito, elevador)': 'manutencao',
    'Manutencao Maquinas': 'manutencao',
    'Manutenção Máquinas': 'manutencao',
    'Manutencao Maquinas e Equipamentos': 'manutencao',
    'Manutenção Máquinas e Equipamentos': 'manutencao',
    'Maquinas e Equipamentos Medicos': 'manutencao',
    'Máquinas e Equipamentos Médicos': 'manutencao',
    'Manutencao de Equipamentos': 'manutencao',
    'Manutenção de Equipamentos': 'manutencao',
    'Manutencao Predial': 'manutencao',
    'Manutenção Predial': 'manutencao',
    Manutencao: 'manutencao',
    Manutenção: 'manutencao',

    // ---- Utilities (Limpeza, Jardim, Coleta) ----
    'Limpeza e Conservacao': 'utilities',
    'Limpeza e Conservação': 'utilities',
    'Jardim (Conservacao)': 'utilities',
    'Jardim (Conservação)': 'utilities',
    'Coleta de Lixo': 'utilities',
    'Coleta Residuos': 'utilities',
    'Coleta Resíduos': 'utilities',
    'Coleta de Residuos': 'utilities',
    'Coleta de Resíduos': 'utilities',
    Limpeza: 'utilities',
    Higienizacao: 'utilities',
    Higienização: 'utilities',

    // ---- Serviços Contábeis ----
    Contabilidade: 'servicos_contabeis',
    'Servicos Contabeis': 'servicos_contabeis',
    'Serviços Contábeis': 'servicos_contabeis',
    'Escritorio Contabil': 'servicos_contabeis',
    'Escritório Contábil': 'servicos_contabeis',

    // ---- Prestadores Terceirizados / Serviços ----
    'Vigilancia e Seguranca': 'prestadores_terceirizados',
    'Vigilancia e Segurança': 'prestadores_terceirizados',
    'Vigilância e Segurança': 'prestadores_terceirizados',
    'Servicos Emergencias Medicas/Ambulancia': 'prestadores_terceirizados',
    'Serviços Emergências Médicas/Ambulância': 'prestadores_terceirizados',
    'Servicos de Seguranca': 'prestadores_terceirizados',
    'Serviços de Segurança': 'prestadores_terceirizados',

    // ---- Bens / Equipamentos (reembolso) ----
    'Bens/Equipamentos': 'reembolso_material',
    'Bens / Equipamentos': 'reembolso_material',
    'Compra de Equipamentos': 'reembolso_material',
    'Aquisicao de Equipamentos': 'reembolso_material',
    'Aquisição de Equipamentos': 'reembolso_material',
    'Equipamentos Medicos': 'reembolso_material',
    'Equipamentos Médicos': 'reembolso_material',

    // ---- Salary-like (resolve por tipo de favorecido) ----
    'Servicos profissional tecnico': SALARY_LIKE_MARKER,
    'Serviços profissional técnico': SALARY_LIKE_MARKER,
    'Servicos Profissional Tecnico': SALARY_LIKE_MARKER,
    'Serviços Profissional Técnico': SALARY_LIKE_MARKER,
    'Colaboradores PJ': SALARY_LIKE_MARKER,
    'Honorario Medico': SALARY_LIKE_MARKER,
    'Honorário Médico': SALARY_LIKE_MARKER,
    'Honorarios Medicos': SALARY_LIKE_MARKER,
    'Honorários Médicos': SALARY_LIKE_MARKER,
    'Prestadores terceirizados': SALARY_LIKE_MARKER,
    'Prestadores Terceirizados': SALARY_LIKE_MARKER,
    'Medicos Plantonistas': SALARY_LIKE_MARKER,
    'Médicos Plantonistas': SALARY_LIKE_MARKER,
    'Profissional Tecnico': SALARY_LIKE_MARKER,
    'Profissional Técnico': SALARY_LIKE_MARKER,

    // ---- Skip (não cruzar) ----
    Emprestimos: SKIP_CROSS_ANALYSIS_MARKER,
    Empréstimos: SKIP_CROSS_ANALYSIS_MARKER,
    'Emprestimos Bancarios': SKIP_CROSS_ANALYSIS_MARKER,
    'Empréstimos Bancários': SKIP_CROSS_ANALYSIS_MARKER,
    'Investimentos Infraestrutura': SKIP_CROSS_ANALYSIS_MARKER,
    'Investimentos em Infraestrutura': SKIP_CROSS_ANALYSIS_MARKER,
    'Devolucao Valor Exame': SKIP_CROSS_ANALYSIS_MARKER,
    'Devolução Valor Exame': SKIP_CROSS_ANALYSIS_MARKER,
    'Devolucao de Valores': SKIP_CROSS_ANALYSIS_MARKER,
    'Devolução de Valores': SKIP_CROSS_ANALYSIS_MARKER,
    'Pro Labore': SKIP_CROSS_ANALYSIS_MARKER,
    'Pro-Labore': SKIP_CROSS_ANALYSIS_MARKER,
    'Prolabore': SKIP_CROSS_ANALYSIS_MARKER,
    'Saida de Socio': SKIP_CROSS_ANALYSIS_MARKER,
    'Saída de Sócio': SKIP_CROSS_ANALYSIS_MARKER,
    'Distribuicao de Lucros': SKIP_CROSS_ANALYSIS_MARKER,
    'Distribuição de Lucros': SKIP_CROSS_ANALYSIS_MARKER,
    'Aporte de Capital': SKIP_CROSS_ANALYSIS_MARKER,
  }).map(([raw, target]) => [normalizeSemanticText(raw), target]),
);

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function isoMonth(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.slice(0, 7)
    : null;
}

function normalizeSemanticText(value) {
  return normalizeLookupKey(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compositeKey(nome, categoria, subcategoria) {
  const nomeKey = normalizeSemanticText(nome) || 'indefinido';
  const categoriaKey = normalizeSemanticText(categoria) || 'semcategoria';
  if (subcategoria) {
    const subcategoriaKey = normalizeSemanticText(subcategoria) || 'indefinido';
    return `${nomeKey}|${categoriaKey}|${subcategoriaKey}`;
  }
  return `${nomeKey}|${categoriaKey}`;
}

function isSameAmount(a, b) {
  return Math.abs(round2(a) - round2(b)) < 0.01;
}

function categoryLabel(categoryCode, categoryOriginal) {
  if (categoryCode && CROSS_CATEGORY_LABELS[categoryCode]) {
    return CROSS_CATEGORY_LABELS[categoryCode];
  }
  if (categoryCode && CATEGORY_LABELS[categoryCode]) {
    return CATEGORY_LABELS[categoryCode];
  }

  const original = asText(categoryOriginal);
  if (original) return original;

  return 'Indefinido';
}

function historyAmount(row) {
  const valorPago = toNumber(row?.valorPago);
  if (valorPago > 0) return valorPago;
  return toNumber(row?.valorLiquido);
}

function historyMonth(row) {
  return isoMonth(row?.ultimoPagamento) || isoMonth(row?.vencimento) || isoMonth(row?.previsao);
}

function latestDate(current, candidate) {
  if (!candidate) return current || null;
  if (!current) return candidate;
  return candidate > current ? candidate : current;
}

function makeCalcWarning(code, message, context) {
  return {
    code,
    severity: 'low',
    message,
    context: context || undefined,
    source: 'calculator',
  };
}

function pushUniqueWarning(warnings, seenWarnings, code, message, context) {
  const key = `${code}|${message}|${JSON.stringify(context || {})}`;
  if (seenWarnings.has(key)) return;
  seenWarnings.add(key);
  warnings.push(makeCalcWarning(code, message, context));
}

function classifyPayeeType(payeeName) {
  const text = asText(payeeName);
  if (!text) return 'indefinido';

  const digits = text.replace(/\D/g, '');
  if (digits.length === 14) {
    // CNPJ — pode ser banco ou empresa; checar marcadores de banco primeiro
    const normalized = normalizeSemanticText(text);
    if (BANK_MARKERS.some((marker) => normalized.includes(marker))) return 'banco';
    return 'empresa';
  }
  if (digits.length === 11) return 'pessoa';

  const normalized = normalizeSemanticText(text);
  if (!normalized) return 'indefinido';

  // Checar banco antes de empresa (mais restritivo)
  if (BANK_MARKERS.some((marker) => normalized.includes(marker))) return 'banco';

  if (COMPANY_MARKERS.some((marker) => normalized.includes(marker))) {
    return 'empresa';
  }

  const words = normalized
    .split(' ')
    .filter(Boolean)
    .filter((word) => !PERSON_TITLES.has(word));

  if (
    words.length >= 2
    && words.length <= 4
    && words.every((word) => word.length > 1 && !/^\d+$/.test(word))
  ) {
    return 'pessoa';
  }

  return 'indefinido';
}

function salaryCrossCategory(payeeType) {
  if (payeeType === 'pessoa') return 'salarios_pessoas';
  if (payeeType === 'empresa') return 'salarios_empresas';
  if (payeeType === 'banco') return 'salarios_empresas'; // banco tratado como empresa para salários
  return 'salarios_indefinido';
}

function crossCategoryType(category) {
  if (!category) return 'servico';
  if (
    category === 'bens_equipamentos' ||
    category === 'reembolso_material' ||
    category === 'saida_socio' ||
    category === 'veiculos_socios'
  ) {
    return 'reembolso';
  }
  return getExpenseType(category) || 'servico';
}

function mapRawCrossCategory(rawCategory) {
  const key = normalizeSemanticText(rawCategory);
  return key ? CROSS_CATEGORY_RAW_MAP[key] || null : null;
}

function mapTaxSubcategory(rawCategory) {
  const key = normalizeSemanticText(rawCategory);
  return key ? TAX_SUBCATEGORY_RAW_MAP[key] || null : null;
}

function deriveCrossCategory(categoryCode, categoryOriginal, payeeName, sourceLayout) {
  const payeeType = classifyPayeeType(payeeName);
  const mappedRawCategory = mapRawCrossCategory(categoryOriginal || categoryCode);

  // Deriva subcategoria fiscal: tenta sobre o texto original primeiro, depois o código
  const taxSubcategoria = mapTaxSubcategory(categoryOriginal) || mapTaxSubcategory(categoryCode) || null;

  // NOVO: Se identificou subcategoria fiscal (FGTS, INSS, IRRF...), força para a categoria 'impostos'
  // Isso impede que tributos pagos via banco (Caixa, etc) caiam na lógica de salários.
  if (taxSubcategoria) {
    return {
      crossCategory: 'impostos',
      payeeType,
      crossEligible: true,
      reason: null,
      subcategoria: taxSubcategoria,
    };
  }

  // SEGUNDO: Se a categoria da planilha mapeou para algo válido e NÃO é um marcador, usa ela.
  // Isso garante que se a planilha diz "Tarifas", a Caixa Cartões não vire "Salários".
  if (mappedRawCategory && mappedRawCategory !== SALARY_LIKE_MARKER && mappedRawCategory !== SKIP_CROSS_ANALYSIS_MARKER) {
    return {
      crossCategory: mappedRawCategory,
      payeeType,
      crossEligible: true,
      reason: null,
      subcategoria: null,
    };
  }

  if (mappedRawCategory === SALARY_LIKE_MARKER) {
    return {
      crossCategory: salaryCrossCategory(payeeType),
      payeeType,
      crossEligible: true,
      reason: payeeType === 'indefinido' ? 'salary_like_unknown_payee_type' : null,
      subcategoria: null,
    };
  }

  if (mappedRawCategory === SKIP_CROSS_ANALYSIS_MARKER) {
    return {
      crossCategory: null,
      payeeType,
      crossEligible: false,
      reason: 'skip_cross_analysis_category',
      subcategoria: null,
    };
  }

  if (sourceLayout === 'titulos_pagos') {
    const resolvedCategory = mappedRawCategory;
    return {
      crossCategory: resolvedCategory,
      payeeType,
      crossEligible: Boolean(resolvedCategory),
      reason: resolvedCategory ? null : 'unmapped_palhoca_conta_financeira',
      subcategoria: resolvedCategory === 'impostos' ? (taxSubcategoria || 'indefinido') : null,
    };
  }

  if (categoryCode && SALARY_LIKE_CATEGORY_CODES.has(categoryCode)) {
    return {
      crossCategory: salaryCrossCategory(payeeType),
      payeeType,
      crossEligible: true,
      reason: payeeType === 'indefinido' ? 'salary_like_unknown_payee_type' : null,
      subcategoria: null,
    };
  }

  if (categoryCode === 'profissionais' && normalizeSemanticText(categoryOriginal).includes('contabil')) {
    return {
      crossCategory: 'servicos_contabeis',
      payeeType,
      crossEligible: true,
      reason: null,
      subcategoria: null,
    };
  }

  if (categoryCode) {
    const isImposto = categoryCode === 'impostos' || mappedRawCategory === 'impostos';
    return {
      crossCategory: isImposto ? 'impostos' : categoryCode,
      payeeType,
      crossEligible: true,
      reason: null,
      subcategoria: isImposto ? (taxSubcategoria || 'indefinido') : null,
    };
  }

  return {
    crossCategory: mappedRawCategory,
    payeeType,
    crossEligible: Boolean(mappedRawCategory),
    reason: mappedRawCategory ? null : 'unmapped_cross_category',
    subcategoria: mappedRawCategory === 'impostos' ? (taxSubcategoria || 'indefinido') : null,
  };
}

function groupAndSumByCategory(items) {
  const groups = {};

  for (const item of asArray(items)) {
    const nome = asText(item?.nome || item?.fornecedor || item?.favorecido, 'Indefinido');
    const categoria = asText(item?.categoria || item?.categoriaOriginal, 'Indefinido');
    const key = compositeKey(nome, categoria, item?.subcategoria || null);
    const value = round2(item?.valorLiquido ?? item?.valor ?? item?.total);

    if (!groups[key]) {
      groups[key] = { nome, categoria, total: 0, count: 0 };
    }

    groups[key].total = round2(groups[key].total + value);
    groups[key].count += 1;
  }

  return Object.values(groups).sort((a, b) => b.total - a.total);
}

function buildTopDespesas(expenses) {
  return asArray(expenses)
    .map((expense, index) => ({
      posicao: index + 1,
      favorecido: asText(expense?.favorecido, 'Indefinido'),
      categoria: categoryLabel(expense?.categoria, expense?.categoriaOriginal),
      categoriaCode: expense?.categoria || null,
      valor: round2(expense?.valor),
      vencimento: expense?.vencimento || null,
      departamento: expense?.departamento || null,
      entity: expense?.entity || null,
      tipo: getExpenseType(expense?.categoria || null),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10)
    .map((expense, index) => ({ ...expense, posicao: index + 1 }));
}

function buildDespesasPorCategoria(expenses) {
  const groups = {};

  for (const expense of asArray(expenses)) {
    const categoryCode = asText(expense?.categoria);
    const key = categoryCode || normalizeLookupKey(expense?.categoriaOriginal) || 'indefinido';

    if (!groups[key]) {
      groups[key] = {
        categoria: categoryLabel(categoryCode, expense?.categoriaOriginal),
        categoriaCode: categoryCode || null,
        tipo: getExpenseType(categoryCode || null),
        total: 0,
        count: 0,
      };
    }

    groups[key].total = round2(groups[key].total + toNumber(expense?.valor));
    groups[key].count += 1;
  }

  return Object.values(groups).sort((a, b) => b.total - a.total);
}

function buildRecebidosPorConta(receipts) {
  const groups = {};

  for (const receipt of asArray(receipts)) {
    const contaCorrente = asText(receipt?.contaCorrenteOriginal || receipt?.contaCorrente, 'Sem conta');

    if (!groups[contaCorrente]) {
      groups[contaCorrente] = {
        contaCorrente,
        total: 0,
        count: 0,
      };
    }

    groups[contaCorrente].total = round2(groups[contaCorrente].total + toNumber(receipt?.valor));
    groups[contaCorrente].count += 1;
  }

  return Object.values(groups).sort((a, b) => b.total - a.total);
}

function buildHistoryAnalysis(history) {
  const rows = asArray(history?.rows);
  const summary = history?.summary || {};

  const paidRows = rows.filter((row) => historyAmount(row) > 0);
  const topCategorias = {};
  const topFornecedores = {};
  const distribuicaoContas = {};

  for (const row of paidRows) {
    const amount = historyAmount(row);
    const categoriaCode = asText(row?.categoria);
    const categoria = categoryLabel(categoriaCode, row?.categoriaOriginal);
    const fornecedor = asText(row?.fornecedor, 'Indefinido');
    const conta = asText(row?.contaCorrenteOriginal || row?.contaCorrente, 'Sem conta');

    if (!topCategorias[categoria]) {
      topCategorias[categoria] = { categoria, total: 0, count: 0 };
    }
    topCategorias[categoria].total = round2(topCategorias[categoria].total + amount);
    topCategorias[categoria].count += 1;

    if (!topFornecedores[fornecedor]) {
      topFornecedores[fornecedor] = { fornecedor, total: 0, count: 0 };
    }
    topFornecedores[fornecedor].total = round2(topFornecedores[fornecedor].total + amount);
    topFornecedores[fornecedor].count += 1;

    if (!distribuicaoContas[conta]) {
      distribuicaoContas[conta] = { conta, total: 0, percentual: 0 };
    }
    distribuicaoContas[conta].total = round2(distribuicaoContas[conta].total + amount);
  }

  const totalDistribuicao = Object.values(distribuicaoContas).reduce((acc, item) => acc + item.total, 0);

  const distribuicao = Object.values(distribuicaoContas)
    .map((item) => ({
      ...item,
      percentual: totalDistribuicao > 0 ? round2((item.total / totalDistribuicao) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalRecords: Number.isFinite(Number(summary.totalRecords)) ? Number(summary.totalRecords) : rows.length,
    periodStart: summary.periodStart || null,
    periodEnd: summary.periodEnd || null,
    period: {
      start: summary.periodStart || null,
      end: summary.periodEnd || null,
    },
    totalPago: round2(summary.totalPago),
    totalAtrasado: round2(summary.totalAtrasado),
    topCategorias: Object.values(topCategorias).sort((a, b) => b.total - a.total).slice(0, 10),
    topFornecedores: Object.values(topFornecedores).sort((a, b) => b.total - a.total).slice(0, 10),
    distribuicaoContas: distribuicao,
  };
}

function buildCrossAnalysis(expenses, historyRows, warnings, seenWarnings) {
  const config = {
    divergenceThresholdPct: 25,
    minMonthsForExactAnalysis: 2,
    divergenceBase: 'media_historica_mensal_com_pagamento',
  };

  const dailyGroups = {};
  const historyGroups = {};
  const monthSet = new Set();

  asArray(expenses).forEach((expense, index) => {
    const nome = asText(expense?.favorecido, 'Indefinido');
    const cross = deriveCrossCategory(
      expense?.categoria || null,
      expense?.categoriaOriginal || null,
      nome,
      'daily',
    );

    if (cross.reason === 'salary_like_unknown_payee_type') {
      pushUniqueWarning(
        warnings,
        seenWarnings,
        'UNDETERMINED_PAYEE_TYPE',
        `Favorecido "${nome}" não pôde ser classificado como pessoa ou empresa para cruzamento salarial.`,
        { favorecido: nome, categoriaOriginal: expense?.categoriaOriginal || expense?.categoria || null },
      );
    }

    // Warning se imposto sem subcategoria reconhecida
    if (cross.crossCategory === 'impostos' && cross.subcategoria === 'indefinido') {
      pushUniqueWarning(
        warnings,
        seenWarnings,
        'IMPOSTO_SEM_SUBCATEGORIA',
        `Imposto "${expense?.categoriaOriginal || expense?.categoria || 'Indefinido'}" do favorecido "${nome}" não tem subcategoria fiscal mapeada.`,
        { favorecido: nome, categoriaOriginal: expense?.categoriaOriginal || expense?.categoria || null },
      );
    }

    const key = cross.crossEligible
      ? compositeKey(nome, cross.crossCategory, cross.subcategoria)
      : `__daily_unmatched__${index}`;

    if (!dailyGroups[key]) {
      dailyGroups[key] = {
        nome,
        categoria: cross.crossCategory || expense?.categoria || null,
        categoriaOriginal: expense?.categoriaOriginal || null,
        categoriaCruzamento: cross.crossCategory || null,
        subcategoria: cross.subcategoria || null,
        subcategoriaOriginal: expense?.categoriaOriginal || null,
        subcategoriaCruzamento: cross.subcategoria || null,
        departamento: expense?.departamento || null,
        tipo: cross.crossCategory
          ? crossCategoryType(cross.crossCategory)
          : getExpenseType(expense?.categoria || null),
        favorecidoTipo: cross.payeeType,
        valorDia: 0,
        valorPago: 0,
        qtdTitulosDia: 0,
        crossEligible: cross.crossEligible,
        dailyLines: [],
      };
    }

    dailyGroups[key].valorDia = round2(dailyGroups[key].valorDia + toNumber(expense?.valor));
    dailyGroups[key].valorPago = round2(dailyGroups[key].valorDia);
    dailyGroups[key].qtdTitulosDia += 1;
    if (!dailyGroups[key].departamento && expense?.departamento) {
      dailyGroups[key].departamento = expense.departamento;
    }
    dailyGroups[key].dailyLines.push({
      favorecido: nome,
      categoria: expense?.categoriaOriginal || expense?.categoria || null,
      subcategoria: cross.subcategoria || null,
      subcategoriaLabel: cross.subcategoria ? (TAX_SUBCATEGORY_LABELS[cross.subcategoria] || cross.subcategoria) : null,
      valor: round2(toNumber(expense?.valor)),
      vencimento: expense?.vencimento || null,
      departamento: expense?.departamento || null,
      entity: expense?.entity || null,
      observacao: expense?.observacao || null,
    });
  });

  for (const row of asArray(historyRows)) {
    const nome = asText(row?.fornecedor, 'Indefinido');
    const cross = deriveCrossCategory(
      row?.categoria || null,
      row?.categoriaOriginal || null,
      nome,
      row?.sourceLayout || null,
    );
    const amount = historyAmount(row);

    if (cross.crossCategory === 'impostos' && cross.subcategoria === 'indefinido') {
      pushUniqueWarning(
        warnings,
        seenWarnings,
        'IMPOSTO_SEM_SUBCATEGORIA',
        `Imposto "${row?.categoriaOriginal || row?.categoria || 'Indefinido'}" do favorecido "${nome}" não tem subcategoria fiscal mapeada.`,
        { fornecedor: nome, categoriaOriginal: row?.categoriaOriginal || row?.categoria || null },
      );
    }

    if (amount <= 0 || !cross.crossEligible) {
      if (cross.reason === 'unmapped_palhoca_conta_financeira') {
        pushUniqueWarning(
          warnings,
          seenWarnings,
          'UNMAPPED_PALHOCA_CONTA_FINANCEIRA',
          `Conta Financeira "${row?.categoriaOriginal || row?.categoria || 'Indefinido'}" sem mapeamento para cruzamento.`,
          { fornecedor: nome, categoriaOriginal: row?.categoriaOriginal || row?.categoria || null },
        );
      }
      if (cross.reason === 'salary_like_unknown_payee_type') {
        pushUniqueWarning(
          warnings,
          seenWarnings,
          'UNDETERMINED_PAYEE_TYPE',
          `Favorecido "${nome}" não pôde ser classificado como pessoa ou empresa para cruzamento salarial.`,
          { fornecedor: nome, categoriaOriginal: row?.categoriaOriginal || row?.categoria || null },
        );
      }
      continue;
    }

    const key = compositeKey(nome, cross.crossCategory, cross.subcategoria);
    if (!dailyGroups[key]) continue;

    if (!historyGroups[key]) {
      historyGroups[key] = {
        nome,
        categoria: cross.crossCategory,
        categoriaOriginal: row?.categoriaOriginal || null,
        categoriaCruzamento: cross.crossCategory,
        subcategoria: cross.subcategoria || null,
        subcategoriaOriginal: row?.categoriaOriginal || null,
        subcategoriaCruzamento: cross.subcategoria || null,
        favorecidoTipo: cross.payeeType,
        totalHistorico: 0,
        qtdHistorico: 0,
        ultimoPagamento: null,
        months: {},
        historyLines: [],
      };
    }

    const month = historyMonth(row);
    if (month) {
      monthSet.add(month);
      historyGroups[key].months[month] = round2((historyGroups[key].months[month] || 0) + amount);
    }

    historyGroups[key].totalHistorico = round2(historyGroups[key].totalHistorico + amount);
    historyGroups[key].qtdHistorico += 1;
    historyGroups[key].ultimoPagamento = latestDate(
      historyGroups[key].ultimoPagamento,
      row?.ultimoPagamento || row?.vencimento || row?.previsao || null,
    );
    historyGroups[key].historyLines.push({
      fornecedor: nome,
      categoria: row?.categoriaOriginal || row?.categoria || null,
      subcategoria: cross.subcategoria || null,
      subcategoriaLabel: cross.subcategoria ? (TAX_SUBCATEGORY_LABELS[cross.subcategoria] || cross.subcategoria) : null,
      valor: amount,
      mes: month,
      ultimoPagamento: row?.ultimoPagamento || null,
      vencimento: row?.vencimento || null,
      sourceFile: row?.sourceFile || null,
      sourceLayout: row?.sourceLayout || null,
    });
  }

  const months = Array.from(monthSet).sort().slice(-3);

  // Determine current month and previous month for repeatCount
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const rows = Object.entries(dailyGroups).map(([key, daily]) => {
    const history = historyGroups[key] || null;
    const allMonthlyValues = history ? Object.values(history.months).filter((value) => value > 0) : [];
    const mediaHistoricaMensal = allMonthlyValues.length > 0
      ? round2(allMonthlyValues.reduce((acc, value) => acc + value, 0) / allMonthlyValues.length)
      : 0;
    const temHistorico = Boolean(history);
    const pagamentoExatoMensal = temHistorico
      && allMonthlyValues.length >= config.minMonthsForExactAnalysis
      && allMonthlyValues.every((value) => isSameAmount(value, daily.valorDia));

    let grupoMensal = 'sem_historico';
    if (temHistorico) {
      grupoMensal = allMonthlyValues.length < config.minMonthsForExactAnalysis
        ? 'historico_insuficiente'
        : (pagamentoExatoMensal ? 'exato' : 'diferente');
    }

    const divergenciaPct = mediaHistoricaMensal > 0
      ? round2(((daily.valorDia - mediaHistoricaMensal) / mediaHistoricaMensal) * 100)
      : null;

    // Count how many times this payee appears in current and previous month
    const currentMonthRepeatCount = history
      ? (history.historyLines || []).filter((l) => l.mes === currentMonth).length
      : 0;
    const previousMonthRepeatCount = history
      ? (history.historyLines || []).filter((l) => l.mes === previousMonth).length
      : 0;

    return {
      nome: daily.nome,
      categoria: daily.categoria,
      categoriaOriginal: daily.categoriaOriginal,
      categoriaCruzamento: daily.categoriaCruzamento,
      subcategoria: daily.subcategoria || null,
      subcategoriaOriginal: daily.subcategoriaOriginal || null,
      subcategoriaCruzamento: daily.subcategoriaCruzamento || null,
      subcategoriaLabel: daily.subcategoria ? (TAX_SUBCATEGORY_LABELS[daily.subcategoria] || daily.subcategoria) : null,
      departamento: daily.departamento,
      tipo: daily.tipo,
      favorecidoTipo: daily.favorecidoTipo,
      crossEligible: daily.crossEligible,
      valorDia: daily.valorDia,
      valorPago: daily.valorPago,
      qtdTitulosDia: daily.qtdTitulosDia,
      totalHistorico: history ? history.totalHistorico : 0,
      qtdHistorico: history ? history.qtdHistorico : 0,
      mediaHistoricaMensal,
      divergenciaPct,
      temHistorico,
      pagamentoExatoMensal,
      grupoMensal,
      alertaDivergencia25: divergenciaPct !== null && Math.abs(divergenciaPct) >= config.divergenceThresholdPct,
      ultimoPagamento: history ? history.ultimoPagamento : null,
      meses: months.reduce((acc, month) => {
        acc[month] = history ? round2(history.months[month] || 0) : 0;
        return acc;
      }, {}),
      dailyLines: daily.dailyLines || [],
      historyLines: history ? (history.historyLines || []) : [],
      currentMonthRepeatCount,
      previousMonthRepeatCount,
    };
  });

  rows.sort((a, b) => {
    if (a.alertaDivergencia25 !== b.alertaDivergencia25) {
      return a.alertaDivergencia25 ? -1 : 1;
    }
    if (a.temHistorico !== b.temHistorico) {
      return a.temHistorico ? -1 : 1;
    }
    return b.valorDia - a.valorDia;
  });

  const buildGroup = (groupRows) => ({
    totalNomes: groupRows.length,
    totalValorDia: round2(groupRows.reduce((acc, row) => acc + toNumber(row.valorDia), 0)),
    totalHistorico: round2(groupRows.reduce((acc, row) => acc + toNumber(row.totalHistorico), 0)),
    rows: groupRows,
  });

  const comHistorico = rows.filter((row) => row.temHistorico);
  const semHistorico = rows.filter((row) => !row.temHistorico);
  const exatoTodosMeses = rows.filter((row) => row.pagamentoExatoMensal);
  const diferenteEntreMeses = rows.filter((row) => row.temHistorico && !row.pagamentoExatoMensal);
  const alertaAnaliseManual = rows.filter((row) => row.alertaDivergencia25);

  return {
    months,
    rows,
    config,
    totalNomesDia: rows.length,
    totalValorDia: round2(rows.reduce((acc, row) => acc + toNumber(row.valorDia), 0)),
    totalHistoricoCruzado: round2(rows.reduce((acc, row) => acc + toNumber(row.totalHistorico), 0)),
    groups: {
      comHistorico: buildGroup(comHistorico),
      semHistorico: buildGroup(semHistorico),
      exatoTodosMeses: buildGroup(exatoTodosMeses),
      diferenteEntreMeses: buildGroup(diferenteEntreMeses),
      alertaAnaliseManual: buildGroup(alertaAnaliseManual),
    },
  };
}

function calculateFinancials(normalizedData) {
  const expenses = asArray(normalizedData?.expenses);
  const receipts = asArray(normalizedData?.receipts);
  const balances = asArray(normalizedData?.balances);
  const history = normalizedData?.history || { rows: [], summary: {} };
  const warnings = [];
  const seenWarnings = new Set();

  const totalDespesas = round2(expenses.reduce((acc, expense) => acc + toNumber(expense?.valor), 0));
  const totalRecebido = round2(receipts.reduce((acc, receipt) => acc + toNumber(receipt?.valor), 0));
  const saldoBancario = round2(balances.reduce((acc, balance) => acc + toNumber(balance?.saldo), 0));
  const transferenciaNecessaria = round2(Math.max(totalDespesas - totalRecebido, 0));

  if (expenses.length === 0) {
    pushUniqueWarning(
      warnings,
      seenWarnings,
      'NO_EXPENSES',
      'Nenhuma despesa normalizada disponível para cálculo.',
    );
  }

  if (asArray(history?.rows).length === 0) {
    pushUniqueWarning(
      warnings,
      seenWarnings,
      'NO_HISTORY_ROWS',
      'Nenhuma linha histórica normalizada disponível para cruzamento.',
    );
  }

  const topDespesas = buildTopDespesas(expenses);
  const despesasPorCategoria = buildDespesasPorCategoria(expenses);
  const recebidosPorConta = buildRecebidosPorConta(receipts);
  const historyAnalysis = buildHistoryAnalysis(history);
  const crossAnalysis = buildCrossAnalysis(expenses, history.rows, warnings, seenWarnings);

  return {
    summary: {
      totalDespesas,
      totalRecebido,
      saldoBancario,
      transferenciaNecessaria,
    },
    totalDespesas,
    totalRecebido,
    saldoBancario,
    transferenciaNecessaria,
    topDespesas,
    despesasPorCategoria,
    recebidosPorConta,
    historyAnalysis,
    crossAnalysis,
    warnings,
  };
}

module.exports = {
  calculateFinancials,
  groupAndSumByCategory,
};
