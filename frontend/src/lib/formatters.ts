const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCurrency(value: any): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  return currencyFmt.format(num)
}

export function formatPercentage(value: any): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  const sign = num > 0 ? '+' : ''
  return `${sign}${num.toFixed(2).replace('.', ',')}%`
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  if (typeof dateStr === 'string' && dateStr.includes('/')) return dateStr

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
  const date = new Date(isDateOnly ? `${dateStr}T12:00:00Z` : dateStr)
  if (isNaN(date.getTime())) return dateStr
  return dateFmt.format(date)
}
