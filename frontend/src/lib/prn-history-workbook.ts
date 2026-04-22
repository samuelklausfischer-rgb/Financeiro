import * as XLSX from 'xlsx'

export type HistorySourceMeta = {
  original_filename: string
  source: 'vault' | 'temporary' | 'legacy'
}

export type HistorySheetData = {
  sourceFile: string
  sheetName: string
  rows: unknown[][]
}

export async function extractHistoricalRows(
  files: File[],
  _meta?: HistorySourceMeta[],
): Promise<HistorySheetData[]> {
  if (files.length === 0) {
    throw new Error('Selecione ao menos uma planilha histórica para a análise.')
  }

  const allSheets: HistorySheetData[] = []

  for (const file of files) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName]
      if (!ws || !ws['!ref']) continue

      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][]
      if (rows.length === 0) continue

      allSheets.push({
        sourceFile: file.name,
        sheetName,
        rows,
      })
    }
  }

  if (allSheets.length === 0) {
    throw new Error('Nenhuma aba válida encontrada nos arquivos históricos.')
  }

  return allSheets
}
