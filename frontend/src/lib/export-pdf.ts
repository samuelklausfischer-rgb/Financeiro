import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatPercentage } from './formatters'
import { formatMonthName } from './audit-utils'
import { getTaxSubcategoryLabel } from './category-labels'

function buildDisplayCategory(row: any) {
  const category = row.categoriaExibicao || row.categoriaOriginal || row.categoria || 'Indefinido'
  const subcategory = row.subcategoria
    ? getTaxSubcategoryLabel(row.subcategoriaLabel || row.subcategoria)
    : null

  return `${category}${subcategory ? ` / ${subcategory}` : ''}`
}

export async function generateAuditPDF(data: any) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  const title = "Relatório Consolidado de Auditoria Financeira"
  const dateStr = "15 de Abril"
  const requestId = data.requestId || 'N/A'

  // --- CAPA E CABEÇALHO ---
  doc.setFontSize(22)
  doc.setTextColor(0, 102, 204)
  doc.text("PRN FINANCEIRO", 14, 20)
  
  doc.setFontSize(14)
  doc.setTextColor(100)
  doc.text(title, 14, 30)
  
  doc.setFontSize(10)
  doc.text(`Data da Auditoria: ${dateStr}`, 14, 38)
  doc.text(`Protocolo: ${requestId}`, 14, 43)

  // --- SUMÁRIO EXECUTIVO ---
  const summary = data.summary || {}
  autoTable(doc, {
    startY: 50,
    head: [['TOTAL DESPESAS (DIA)', 'TOTAL RECEBIDO (DIA)', 'SALDO BANCÁRIO']],
    body: [[
      formatCurrency(summary.totalDespesas),
      formatCurrency(summary.totalRecebido),
      formatCurrency(summary.saldoBancario)
    ]],
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40] }
  })

  // --- TABELA DE AUDITORIA CRUZADA ---
  doc.setFontSize(14)
  doc.setTextColor(0)
  doc.text("1. Análise Cruzada de Variação (Despesas)", 14, (doc as any).lastAutoTable.finalY + 15)

  const crossData = data.data?.crossAnalysis || {}
  const rawRows = Array.isArray(crossData.rows) ? crossData.rows : []
  const rawMonths = Array.isArray(crossData.months) ? crossData.months : []

  const inferredMonths = rawRows.flatMap((row: any) =>
    row?.meses && typeof row.meses === 'object' ? Object.keys(row.meses) : []
  )

  const months = Array.from(new Set([...rawMonths, ...inferredMonths]))
    .filter((m: string) => /^\d{4}-\d{2}$/.test(m))
    .sort()
    .slice(-3)

  const rows = rawRows

  const tableHead = [
    'Favorecido',
    ...months.map((m: string) => formatMonthName(m)),
    'Valor Atual',
    'Média',
    'Var %'
  ]

  let groupIndex = 0
  const tableRows = rows.flatMap((row: any) => {
    const currentGroupIndex = groupIndex++
    const groupRow = {
      isDetail: false,
      groupIndex: currentGroupIndex,
      values: [
        `${row.nome} - ${buildDisplayCategory(row)} (${row.qtdTitulosDia || 1})`,
        ...months.map((m: string) => formatCurrency(row.meses?.[m] || 0)),
        formatCurrency(row.valorPago ?? row.valorDia ?? 0),
        formatCurrency(row.mediaHistoricaMensal),
        formatPercentage(row.divergenciaPct || 0),
      ],
    }

    const detailRows = Array.isArray(row.dailyLines)
      ? row.dailyLines.map((line: any, index: number) => ({
          isDetail: true,
          groupIndex: currentGroupIndex,
          values: [
            `   ${index + 1}. ${line.departamento || 'Sem departamento'} | ${line.subcategoriaLabel || line.categoriaExibicao || line.categoria || row.categoriaExibicao || row.categoriaOriginal || row.categoria || 'Indefinido'} | ${formatCurrency(line.valor)}`,
            ...months.map(() => ''),
            '',
            '',
            '',
          ],
        }))
      : []

    return [groupRow, ...detailRows]
  })

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [tableHead],
    body: tableRows.map((row) => row.values),
    theme: 'grid',
    headStyles: { fillColor: [0, 102, 204] },
    columnStyles: {
      0: { cellWidth: 60 },
      [1 + months.length]: { halign: 'right', fontStyle: 'bold' },
      [tableHead.length - 1]: { halign: 'right' }
    },
    didParseCell: (data) => {
      const rowMeta = tableRows[data.row.index]
      if (data.section === 'body') {
        if (rowMeta?.isDetail) {
          data.cell.styles.fillColor = [252, 253, 254] // Fundo quase branco para detalhes
          data.cell.styles.textColor = [90, 90, 90]
          data.cell.styles.fontSize = 8
          if (data.column.index === 0) {
            data.cell.styles.fontStyle = 'normal'
          }
        } else {
          // Efeito Zebra Minimalista nas linhas de grupo
          // Opacidades simuladas: 30% ([217, 230, 249]) e 10% ([242, 247, 254])
          const isOddGroup = (rowMeta?.groupIndex || 0) % 2 === 0
          data.cell.styles.fillColor = isOddGroup 
            ? [217, 230, 249] // ~30%
            : [242, 247, 254] // ~10%
          
          data.cell.styles.textColor = [30, 30, 30]
          data.cell.styles.fontSize = 9
        }
      }

      // Destaque em vermelho para variações altas
      if (data.section === 'body' && !rowMeta?.isDetail && data.column.index === tableHead.length - 1) {
        const valStr = data.cell.text[0].replace('%', '').replace(',', '.')
        const val = parseFloat(valStr)
        if (Math.abs(val) > 25) {
          data.cell.styles.textColor = [220, 53, 69]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    }
  })

  // --- RECEBIMENTOS ---
  doc.addPage()
  doc.text("2. Fluxo de Recebimentos do Dia", 14, 20)
  
  const receipts = data.data?.receipts || []
  autoTable(doc, {
    startY: 25,
    head: [['Data', 'Descrição', 'Conta Corrente', 'Valor']],
    body: receipts.map((r: any) => [
      r.data,
      r.descricao,
      r.contaCorrenteOriginal || r.contaCorrente,
      formatCurrency(r.valor)
    ]),
    headStyles: { fillColor: [40, 167, 69] }
  })

  // --- RODAPÉ ---
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Página ${i} de ${pageCount} - Gerado eletronicamente em ${new Date().toLocaleString()}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  doc.save(`Auditoria_PRN_${requestId}.pdf`)
}
