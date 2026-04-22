import React from 'react'

export const ResponsiveTable = ({
  columns,
  data,
  renderRow,
  emptyMessage = 'Nenhum dado disponível',
}: {
  columns: string[]
  data: any[]
  renderRow: (item: any, idx: number, isMobile: boolean) => React.ReactNode
  emptyMessage?: string
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 bg-gray-800/50 rounded-b-xl border-t border-gray-700">
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-b-xl">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-gray-300 uppercase bg-gray-800 border-b border-gray-700 sticky top-0">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="px-4 py-3 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-800">
            {data.map((item, i) => renderRow(item, i, false))}
          </tbody>
        </table>
      </div>
      <div className="block md:hidden space-y-3 p-3 bg-gray-900 rounded-b-xl">
        {data.map((item, i) => renderRow(item, i, true))}
      </div>
    </>
  )
}
