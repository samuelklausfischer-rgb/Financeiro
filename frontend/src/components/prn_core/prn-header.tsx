import { Card, CardContent } from '@/components/ui/card'
import { Calendar, FileText, Hash, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/formatters'

export function PrnHeader({ header }: { header: any }) {
  if (!header) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card className="hover-glass border-white/5 bg-blue-600/5 group animate-in fade-in slide-in-from-left-4 duration-500">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform">
            <Hash className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Protocolo ID</p>
            <p className="text-sm font-black text-white truncate max-w-[150px] font-mono">{header.requestId || '---'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="hover-glass border-white/5 bg-emerald-600/5 group animate-in fade-in slide-in-from-left-4 duration-700">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <Calendar className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Referência</p>
            <p className="text-sm font-black text-white">{formatDate(header.referenceDateUsed) || '---'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="hover-glass border-white/5 bg-white/[0.02] group md:col-span-2 animate-in fade-in slide-in-from-left-4 duration-1000">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5 text-white/50" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] h-4 bg-white/5 border-white/10 text-white/40 font-bold uppercase tracking-tighter">Diário</Badge>
                <p className="text-xs font-bold text-white/80 truncate max-w-[200px]">{header.dailyFile || '---'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] h-4 bg-white/5 border-white/10 text-white/40 font-bold uppercase tracking-tighter">Histórico</Badge>
                <p className="text-xs font-bold text-white/80 truncate max-w-[200px]">{header.historicalFile || '---'}</p>
              </div>
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-end">
             <div className="flex items-center gap-1 text-emerald-400">
               <ShieldCheck className="h-4 w-4" />
               <span className="text-[10px] font-black uppercase tracking-tighter">Auditado</span>
             </div>
             <p className="text-[9px] text-white/20 font-bold uppercase mt-0.5 tracking-tighter">Integridade 100%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
