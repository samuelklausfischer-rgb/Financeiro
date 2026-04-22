import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  getAnalises,
  deleteAnalise,
  clearAllAnalises,
  type AnalysisRecord,
} from '@/services/analise-duplicidade'
import { useToast } from '@/hooks/use-toast'

export function HistoryTable({
  onViewDetails,
  refreshTrigger,
  onDeleted,
}: {
  onViewDetails: (id: string) => void
  refreshTrigger: number
  onDeleted?: (id?: string) => void
}) {
  const [records, setRecords] = useState<AnalysisRecord[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [isClearAllOpen, setIsClearAllOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const { toast } = useToast()

  const fetchHistory = useCallback(async () => {
    try {
      const result = await getAnalises(page, 20, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        search,
        startDate,
        endDate,
      })
      setRecords(result.items)
      setHasMore(result.hasMore)
    } catch (err) {
      console.error(err)
    }
  }, [page, statusFilter, search, startDate, endDate])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshTrigger])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, search, startDate, endDate])

  const handleDelete = async () => {
    if (!itemToDelete) return
    try {
      setIsProcessing(true)
      await deleteAnalise(itemToDelete)
      toast({
        title: 'Sucesso',
        description: 'Planilha apagada com sucesso.',
      })
      const deletedId = itemToDelete
      setItemToDelete(null)
      onDeleted?.(deletedId)
      fetchHistory()
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao apagar planilha.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearAll = async () => {
    try {
      setIsProcessing(true)
      await clearAllAnalises()
      toast({
        title: 'Sucesso',
        description: 'Histórico zerado com sucesso.',
      })
      setIsClearAllOpen(false)
      onDeleted?.()
      setPage(1)
      fetchHistory()
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao zerar histórico.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Card className="bg-white/5 backdrop-blur-md border-white/10 text-white shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Histórico de análises</CardTitle>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsClearAllOpen(true)}
            className="bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 border border-red-500/30"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Zerar Histórico
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Input
              placeholder="Buscar por arquivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black/40 border-white/10 text-white w-full sm:w-auto flex-1 min-w-[200px]"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-black/40 border-white/10 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">De:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-black/40 border-white/10 text-white w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">Até:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-black/40 border-white/10 text-white w-auto"
              />
            </div>
          </div>

          <div className="rounded-md border border-white/10 overflow-x-auto">
            <Table className="text-white/80">
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/60 whitespace-nowrap">Data</TableHead>
                  <TableHead className="text-white/60">Arquivo</TableHead>
                  <TableHead className="text-white/60">Usuário</TableHead>
                  <TableHead className="text-white/60">Status</TableHead>
                  <TableHead className="text-white/60 text-right">Total</TableHead>
                  <TableHead className="text-white/60 text-right">Duplicidades</TableHead>
                  <TableHead className="text-white/60 text-right">Grupos</TableHead>
                  <TableHead className="text-white/60 text-right whitespace-nowrap">
                    Total Manual
                  </TableHead>
                  <TableHead className="text-white/60 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(r.created), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={r.file_name}>
                      {r.file_name}
                    </TableCell>
                    <TableCell>{r.expand?.uploaded_by?.name || 'Sistema'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === 'completed'
                            ? 'default'
                            : r.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className={r.status === 'completed' ? 'bg-green-600' : ''}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.total_records || 0}</TableCell>
                    <TableCell className="text-right">{r.duplicate_count || 0}</TableCell>
                    <TableCell className="text-right">{r.group_count || 0}</TableCell>
                    <TableCell className="text-right">
                      {r.overall_manual_group_count || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(r.id)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-white/5"
                        >
                          Ver detalhes
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setItemToDelete(r.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-white/5 h-8 w-8"
                          title="Apagar planilha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && (
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableCell colSpan={9} className="text-center py-8 text-white/50">
                      Nenhuma análise encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end items-center gap-4 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="bg-black/40 border-white/10 text-white hover:bg-white/10 hover:text-white"
            >
              Anterior
            </Button>
            <span className="text-sm text-white/50">Página {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="bg-black/40 border-white/10 text-white hover:bg-white/10 hover:text-white"
            >
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Planilha</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Tem certeza que deseja apagar esta planilha? Esta ação não pode ser desfeita e
              removerá todos os dados de análise associados a ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isProcessing}
              className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-white"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessing}
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Zerar Histórico</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Tem certeza que deseja apagar todas as planilhas? Esta ação não pode ser desfeita e
              todo o seu histórico de análises será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isProcessing}
              className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white text-white"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessing}
              onClick={(e) => {
                e.preventDefault()
                handleClearAll()
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
