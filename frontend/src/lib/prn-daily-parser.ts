import * as XLSX from 'xlsx'

type ParsedReceipt = {
  data: string | null
  valor: number
  descricao: string | null
  contaCorrenteOriginal: string | null
  contaCorrente: string | null
  entity: string | null
  categoria: string | null
  categoriaOriginal: string | null
  conciliado: boolean
}

type ParsedDailyReceipts = {
  receipts: ParsedReceipt[]
  receivedByAccount: Array<{ contaCorrente: string; total: number; count: number }>
  totalReceived: number
  sourceSheet: string | null
}

type ParsePrnDailyReceiptsOptions = {
  referenceDate?: string | null
}

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const normalizeAccountName = (value: string | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || null

const asNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const raw = String(value ?? '').trim()
  if (!raw) return 0

  const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const asIsoDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const month = String(parsed.m).padStart(2, '0')
      const day = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${month}-${day}`
    }
  }

  const raw = String(value ?? '').trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) {
    const [, day, month, year] = brMatch
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const findHeaderRow = (rows: unknown[][]) => {
  let bestIndex = -1
  let bestScore = -1

  rows.slice(0, 20).forEach((row, index) => {
    const headers = row.map(normalizeHeader)
    const score = [
      headers.some((header) => header.includes('data')),
      headers.some((header) => header.includes('valor')),
      headers.some((header) => header.includes('conta')),
      headers.some((header) => header.includes('descricao') || header.includes('historico')),
    ].filter(Boolean).length

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestScore >= 2 ? bestIndex : -1
}

const pickColumn = (
  headers: (string | undefined)[],
  predicates: Array<(header: string) => boolean>,
) => {
  for (const predicate of predicates) {
    const index = headers.findIndex((h) => h != null && predicate(h))
    if (index >= 0) return index
  }

  return -1
}

export async function parsePrnDailyReceipts(
  file: File,
  options: ParsePrnDailyReceiptsOptions = {},
): Promise<ParsedDailyReceipts | null> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames.find((name) => /receb/i.test(name)) || null
  if (!sheetName) return null

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return null

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][]
  const headerRowIndex = findHeaderRow(rows)
  if (headerRowIndex < 0) return null

  const rawHeaders = rows[headerRowIndex] || []
  const headers = rawHeaders.map(normalizeHeader)
  const valueIndex = pickColumn(headers, [(header) => header.includes('valor')])
  const dateIndex = pickColumn(headers, [(header) => header === 'data', (header) => header.includes('data')])
  const descriptionIndex = pickColumn(headers, [
    (header) => header.includes('descricao'),
    (header) => header.includes('historico'),
    (header) => header.includes('documento'),
  ])
  const accountIndex = pickColumn(headers, [
    (header) => header.includes('conta corrente'),
    (header) => header.includes('conta'),
    (header) => header.includes('banco'),
  ])
  const entityIndex = pickColumn(headers, [(header) => header.includes('entidade'), (header) => header.includes('empresa')])
  const categoryIndex = pickColumn(headers, [(header) => header.includes('categoria')])

  if (valueIndex < 0) return null

  const receipts = rows.slice(headerRowIndex + 1).reduce<ParsedReceipt[]>((acc, row) => {
    if (!Array.isArray(row)) return acc

    const value = asNumber(row[valueIndex])
    const description = descriptionIndex >= 0 ? String(row[descriptionIndex] ?? '').trim() || null : null
    const accountOriginal = accountIndex >= 0 ? String(row[accountIndex] ?? '').trim() || null : null
    const date = dateIndex >= 0 ? asIsoDate(row[dateIndex]) : null

    if (!value && !description && !accountOriginal && !date) {
      return acc
    }

    acc.push({
      data: date,
      valor: value,
      descricao: description,
      contaCorrenteOriginal: accountOriginal,
      contaCorrente: normalizeAccountName(accountOriginal),
      entity: entityIndex >= 0 ? String(row[entityIndex] ?? '').trim() || null : null,
      categoria: categoryIndex >= 0 ? String(row[categoryIndex] ?? '').trim() || null : null,
      categoriaOriginal: categoryIndex >= 0 ? String(row[categoryIndex] ?? '').trim() || null : null,
      conciliado: false,
    })

    return acc
  }, [])

  const filteredReceipts = options.referenceDate
    ? receipts.filter((receipt) => receipt.data === options.referenceDate)
    : receipts

  if (filteredReceipts.length === 0) {
    return {
      receipts: [],
      receivedByAccount: [],
      totalReceived: 0,
      sourceSheet: sheetName,
    }
  }

  const totalsByAccount = new Map<string, { contaCorrente: string; total: number; count: number }>()

  filteredReceipts.forEach((receipt) => {
    const key = receipt.contaCorrente || 'sem_conta'
    const current = totalsByAccount.get(key) || { contaCorrente: key, total: 0, count: 0 }
    current.total += receipt.valor
    current.count += 1
    totalsByAccount.set(key, current)
  })

  return {
    receipts: filteredReceipts,
    receivedByAccount: Array.from(totalsByAccount.values()).sort((a, b) => b.total - a.total),
    totalReceived: filteredReceipts.reduce((acc, receipt) => acc + receipt.valor, 0),
    sourceSheet: sheetName,
  }
}
