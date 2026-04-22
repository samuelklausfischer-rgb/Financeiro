import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type ColumnDef = {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  render?: (val: any, row: any) => React.ReactNode
}

export function SortableTable({ data = [], columns }: { data?: any[]; columns: ColumnDef[] }) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null,
  )

  const sortedData = useMemo(() => {
    if (!sortConfig) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortConfig])

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-xl">
      <Table>
        <TableHeader className="bg-white/5 border-b border-white/10">
          <TableRow className="hover:bg-transparent border-white/10">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`py-4 ${
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                }`}
              >
                {col.sortable !== false ? (
                  <Button
                    variant="ghost"
                    className="h-8 px-2 font-bold text-white/50 hover:bg-white/10 hover:text-white -ml-2 text-xs uppercase tracking-widest transition-all"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortConfig?.key === col.key ? (
                      sortConfig.direction === 'asc' ? (
                        <ArrowUp className="ml-1.5 h-3 w-3 text-blue-400" />
                      ) : (
                        <ArrowDown className="ml-1.5 h-3 w-3 text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="ml-1.5 h-3 w-3 opacity-20" />
                    )}
                  </Button>
                ) : (
                  <span className="px-2 font-bold text-white/50 text-xs uppercase tracking-widest">{col.label}</span>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 && (
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableCell colSpan={columns.length} className="text-center py-12 text-white/30 font-medium">
                Nenhum registro encontrado.
              </TableCell>
            </TableRow>
          )}
          {sortedData.map((row, i) => (
            <TableRow key={i} className="border-white/5 hover:bg-white/[0.04] transition-all duration-200">
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={`py-4 text-sm font-medium break-words whitespace-normal max-w-[240px] ${
                    col.align === 'right'
                      ? 'text-right text-white'
                      : col.align === 'center'
                        ? 'text-center text-white/70'
                        : 'text-left text-white/90'
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
