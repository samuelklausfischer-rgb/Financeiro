import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, RefreshCw, Eye, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function PrnHistoryTable({
  historyRuns,
  isHistoryLoading,
  fetchHistory,
  handleOpenHistory,
  handleDeleteHistory,
}: any) {
  const [runToDelete, setRunToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const formatReferenceDate = (value?: string | null) => {
    if (!value) return '-'

    const parsed = new Date(`${value}T12:00:00Z`)
    if (Number.isNaN(parsed.getTime())) return value

    return format(parsed, 'dd/MM/yyyy', { locale: ptBR })
  }

  const confirmDelete = async () => {
    if (!runToDelete) return
    setIsDeleting(true)
    try {
      await handleDeleteHistory(runToDelete.id)
    } finally {
      setIsDeleting(false)
      setRunToDelete(null)
    }
  }

  return (
    <>
      <Card className="hover-glass border-white/5 text-white shadow-2xl overflow-hidden">
        <CardHeader className="bg-white/[0.03] border-b border-white/5 py-6 flex flex-row items-center justify-between px-6">
          <CardTitle className="text-base font-bold flex items-center gap-3 m-0 uppercase tracking-widest text-white/70">
            <div className="p-2 bg-white/5 rounded-lg">
              <History className="h-4 w-4 text-blue-400" />
            </div>
            Histórico
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/40 hover:bg-white/10 hover:text-white rounded-xl transition-all"
            onClick={fetchHistory}
            disabled={isHistoryLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isHistoryLoading && 'animate-spin')} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-transparent sticky top-0 z-10 backdrop-blur-md">
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest text-white/30 pl-6 py-4">Data da Planilha</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest text-white/30">Status</TableHead>
                  <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-white/30 pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHistoryLoading && historyRuns.length === 0 ? (
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell colSpan={3} className="text-center py-20">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500/50" />
                      <p className="text-xs font-bold uppercase tracking-tighter text-white/20">Sincronizando histórico...</p>
                    </TableCell>
                  </TableRow>
                ) : historyRuns.length === 0 ? (
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell colSpan={3} className="text-center py-20 text-white/20 font-bold uppercase text-xs tracking-widest">
                      Nenhum registro
                    </TableCell>
                  </TableRow>
                ) : (
                  historyRuns.map((run: any) => (
                    <TableRow
                      key={run.id}
                      className="border-white/5 transition-all hover:bg-white/[0.03] cursor-pointer group"
                      onClick={() => handleOpenHistory(run)}
                    >
                      <TableCell className="text-[11px] font-bold text-white/60 pl-6 py-4">
                        {formatReferenceDate(run.data_referencia)}
                      </TableCell>
                      <TableCell>
                        {run.status === 'success' && (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold text-[9px] uppercase tracking-tighter px-2 py-0.5">
                            Sucesso
                          </Badge>
                        )}
                        {run.status === 'processing' && (
                          <Badge
                            variant="secondary"
                            className="font-bold text-[9px] uppercase tracking-tighter bg-blue-500/10 text-blue-400 border-blue-500/20 px-2 py-0.5 animate-pulse"
                          >
                            Processando
                          </Badge>
                        )}
                        {run.status === 'error' && (
                          <Badge
                            variant="destructive"
                            className="font-bold text-[9px] uppercase tracking-tighter bg-red-500/10 text-red-400 border-red-500/20 px-2 py-0.5"
                          >
                            Falha
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-blue-500/20 text-white/20 group-hover:text-blue-400 transition-all"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenHistory(run)
                            }}
                            disabled={run.status === 'processing'}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRunToDelete(run)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!runToDelete} onOpenChange={(open) => !open && setRunToDelete(null)}>
        <AlertDialogContent className="bg-[#0f111a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Excluir Relatório</AlertDialogTitle>
              <AlertDialogDescription className="text-white/60">
              Tem certeza que deseja excluir a análise da planilha{' '}
              {runToDelete && formatReferenceDate(runToDelete.data_referencia)}? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 hover:text-white text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={isDeleting}
              className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
