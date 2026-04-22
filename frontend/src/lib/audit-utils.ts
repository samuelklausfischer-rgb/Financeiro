import { formatCurrency } from './formatters'

const monthNames: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
}

/**
 * Converte um código de mês (ex: 2026-01) para o nome por extenso (ex: Janeiro)
 */
export function formatMonthName(monthCode: string): string {
  if (!monthCode || !monthCode.includes('-')) return monthCode
  const [year, month] = monthCode.split('-')
  const name = monthNames[month]
  return name ? `${name}` : monthCode
}

/**
 * Interface para os dados de auditoria cruzada
 */
export interface AuditRow {
  nome: string
  categoria?: string | null
  valorDia: number
  valorPago: number
  qtdTitulosDia: number
  totalHistorico: number
  mediaHistoricaMensal: number
  divergenciaPct: number | null
  alertaDivergencia25: boolean
  direcaoDivergencia: string
  grupoMensal: string
  meses: Record<string, number>
  categoriaOriginal?: string
  categoriaCruzamento?: string | null
  subcategoria?: string | null
  subcategoriaOriginal?: string | null
  subcategoriaCruzamento?: string | null
  subcategoriaLabel?: string | null
  departamento?: string
}

/**
 * Normaliza os dados brutos do n8n para o formato do Audit Board
 */
export function normalizeAuditData(rawRows: any[], months: string[]): AuditRow[] {
  return rawRows.map(row => ({
    nome: row.nome || 'Desconhecido',
    categoria: row.categoria || null,
    valorDia: row.valorDia || 0,
    valorPago: row.valorPago || row.valorDia || 0,
    qtdTitulosDia: row.qtdTitulosDia || 1,
    totalHistorico: row.totalHistorico || 0,
    mediaHistoricaMensal: row.mediaHistoricaMensal || 0,
    divergenciaPct: row.divergenciaPct,
    alertaDivergencia25: !!row.alertaDivergencia25,
    direcaoDivergencia: row.direcaoDivergencia || 'estavel',
    grupoMensal: row.grupoMensal || 'outros',
    meses: row.meses || {},
    categoriaOriginal: row.categoriaOriginal,
    categoriaCruzamento: row.categoriaCruzamento || null,
    subcategoria: row.subcategoria || null,
    subcategoriaOriginal: row.subcategoriaOriginal || null,
    subcategoriaCruzamento: row.subcategoriaCruzamento || null,
    subcategoriaLabel: row.subcategoriaLabel || null,
    departamento: row.departamento
  }))
}
