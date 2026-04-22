export const CATEGORY_LABELS: Record<string, string> = {
  servicos_contabeis: "Servicos Contabeis",
  honorarios_medicos: "Honorarios Medicos PJ",
  servicos_informatica: "Servicos de Informatica",
  prestadores_terceirizados: "Prestadores Terceirizados",
  taxas: "Taxas",
  profissionais: "Profissionais",
  software: "Software",
  insumos: "Insumos",
  manutencao: "Manutencao",
  aluguel: "Aluguel",
  energia: "Energia",
  telefonia: "Telefonia",
  salarios: "Salarios",
  impostos: "Impostos",
  marketing: "Marketing",
  transporte: "Transporte",
  veiculos_socios: "Veículos (Sócios)",
  vale_refeicao: "Vale Refeição",
  seguros: "Seguros",
  utilities: "Utilities",
  salarios_pessoas: "Salarios / Pessoa",
  salarios_empresas: "Salarios / Empresa",
  salarios_indefinido: "Salarios / Tipo Indefinido",
  emprestimos: "Emprestimos",
  investimentos_infraestrutura: "Investimentos Infraestrutura",
  bens_equipamentos: "Bens / Equipamentos",
  devolucao_valor_exame: "Devolucao Valor Exame",
  undefined: "Indefinido",
  Indefinido: "Indefinido",
};

const CATEGORY_COMPACT_LABELS: Record<string, string> = {
  veiculos_socios: 'Veic. (Sócios)',
}

export const TAX_SUBCATEGORY_LABELS: Record<string, string> = {
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
  indefinido: 'Indefinido',
}

export function getCategoryLabel(categoria: string | null | undefined): string {
  if (!categoria) return "Indefinido";
  return CATEGORY_LABELS[categoria] || categoria;
}

export function getCompactCategoryLabel(categoria: string | null | undefined): string {
  if (!categoria) return 'Indefinido'
  return CATEGORY_COMPACT_LABELS[categoria] || getCategoryLabel(categoria)
}

export function getTaxSubcategoryLabel(subcategoria: string | null | undefined): string {
  if (!subcategoria) return 'Indefinido'
  return TAX_SUBCATEGORY_LABELS[subcategoria] || subcategoria
}
