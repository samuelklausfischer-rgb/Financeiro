import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export const SummaryCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string
  value: string
  icon: LucideIcon
  colorClass: string
}) => (
  <div className="bg-gray-700 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm text-white transition-transform duration-300 hover:scale-[1.02]">
    <div
      className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-gray-800',
        colorClass,
      )}
    >
      <Icon className="w-6 h-6" />
    </div>
    <span className="text-sm font-medium text-gray-300 mb-1 text-center">{title}</span>
    <div className="text-xl font-bold text-center">{value}</div>
  </div>
)

export const SecondaryCard = ({ title, value }: { title: string; value: string | number }) => (
  <div className="bg-white rounded-xl p-4 flex flex-col shadow-sm border border-gray-200 transition-colors duration-300 hover:border-gray-400">
    <span className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider line-clamp-1">
      {title}
    </span>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
)
