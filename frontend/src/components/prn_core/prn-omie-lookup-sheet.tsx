import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, CalendarDays, Wallet, Landmark, CreditCard } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import { lookupPrnOmiePayment, type PrnOmieLookupResult } from '@/services/prn-omie'

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function buildExpenseKey(expense: any, index: number) {
  return [
    expense.favorecido,
    expense.vencimento,
    expense.valor,
    expense.parcela || '',
    expense.departamento || '',
    index,
  ].join('|')
}

function paymentBadge(result?: PrnOmieLookupResult | null) {
  switch (result?.paymentType) {
    case 'pix':
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">PIX</Badge>
    case 'boleto':
      return <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">Boleto</Badge>
    case 'transferencia':
      return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">Transferencia bancaria</Badge>
    case 'not_found':
      return <Badge className="bg-white/10 text-white/70 border-white/10">Nao encontrado</Badge>
    default:
      return null
  }
}

function renderKeyValue(label: string, value?: string | number | null) {
  if (value === undefined || value === null || value === '') return null

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-white">{String(value)}</div>
    </div>
  )
}

export function PrnOmieLookupSheet({
  open,
  onOpenChange,
  row,
  fullPayload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: any | null
  fullPayload: any
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [lookupResult, setLookupResult] = useState<PrnOmieLookupResult | null>(null)

  const expenses = useMemo(() => {
    const source = Array.isArray(fullPayload?.data?.expenses) ? fullPayload.data.expenses : []
    const rowName = normalizeText(row?.nome)

    return source
      .map((expense: any, index: number) => ({
        ...expense,
        _lookupKey: buildExpenseKey(expense, index),
      }))
      .filter((expense: any) => normalizeText(expense.favorecido) === rowName)
  }, [fullPayload, row])

  useEffect(() => {
    if (!open) {
      setSelectedKey(null)
      setSelectedExpense(null)
      setLookupState('idle')
      setLookupResult(null)
    }
  }, [open])

  const handleLookup = async (expense: any) => {
    setSelectedKey(expense._lookupKey)
    setSelectedExpense(expense)
    setLookupState('loading')
    setLookupResult(null)

    const result = await lookupPrnOmiePayment({
      requestId: fullPayload?.requestId,
      rowName: row?.nome || expense.favorecido,
      expense: {
        favorecido: expense.favorecido,
        vencimento: expense.vencimento,
        valor: expense.valor,
        parcela: expense.parcela,
        observacao: expense.observacao,
        departamento: expense.departamento,
        categoriaOriginal: expense.categoriaOriginal,
      },
    })

    setLookupResult(result)
    setLookupState('done')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-[#06080d] p-0 text-white sm:max-w-[880px] xl:max-w-[1000px]"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-white/10 bg-white/[0.03] px-6 py-6 text-left">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <SheetTitle className="text-2xl font-black tracking-tight text-white">
                  Consulta Omie
                </SheetTitle>
                <SheetDescription className="mt-2 max-w-2xl text-white/45">
                  Abra um titulo especifico desta pessoa para conferir o meio de pagamento do mes.
                </SheetDescription>
              </div>
              {paymentBadge(lookupResult)}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Card className="border-white/10 bg-white/[0.03] text-white shadow-none">
                <CardContent className="p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Favorecido
                  </div>
                  <div className="mt-2 text-sm font-bold text-white break-words">{row?.nome || '-'}</div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.03] text-white shadow-none">
                <CardContent className="p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Valor total do dia
                  </div>
                  <div className="mt-2 text-sm font-bold text-blue-400">
                    {formatCurrency(row?.valorPago ?? row?.valorDia ?? 0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.03] text-white shadow-none">
                <CardContent className="p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                    Titulos locais
                  </div>
                  <div className="mt-2 text-sm font-bold text-white">{expenses.length}</div>
                </CardContent>
              </Card>
            </div>
          </SheetHeader>

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-b border-white/10 bg-white/[0.02] lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
                <Search className="h-4 w-4 text-blue-400" />
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">
                  Titulos para consulta
                </div>
              </div>

              <div className="max-h-full space-y-3 overflow-y-auto p-4">
                {expenses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/45">
                    Nenhum titulo do diario foi encontrado para este favorecido.
                  </div>
                ) : (
                  expenses.map((expense: any) => {
                    const isActive = selectedKey === expense._lookupKey

                    return (
                      <Button
                        key={expense._lookupKey}
                        variant="ghost"
                        onClick={() => handleLookup(expense)}
                        className={cn(
                          'h-auto w-full flex-col items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-all',
                          isActive
                            ? 'border-blue-500/40 bg-blue-500/10 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.15)]'
                            : 'border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]',
                        )}
                      >
                        <div className="flex w-full items-start justify-between gap-3">
                          <div className="text-sm font-bold text-white whitespace-normal break-words text-left">{expense.departamento || 'Sem departamento'}</div>
                          <Badge className="border-white/10 bg-white/[0.05] text-white/65 shrink-0">
                            {expense.parcela || 'Sem parcela'}
                          </Badge>
                        </div>

                        <div className="grid w-full gap-2 text-xs text-white/55">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-white/35" />
                            <span>{formatDate(expense.vencimento)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wallet className="h-3.5 w-3.5 text-white/35" />
                            <span>{formatCurrency(expense.valor || 0)}</span>
                          </div>
                        </div>
                      </Button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-6 py-6">
              {!selectedExpense && lookupState === 'idle' && (
                <div className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-8 text-center">
                  <Search className="mb-4 h-10 w-10 text-white/15" />
                  <div className="text-lg font-bold text-white">Selecione um titulo</div>
                  <div className="mt-2 max-w-md text-sm text-white/45">
                    Escolha um dos itens da lista para consultar PIX, boleto ou transferencia bancaria na Omie.
                  </div>
                </div>
              )}

              {lookupState === 'loading' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-blue-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-bold">Consultando Omie...</span>
                  </div>
                  <Skeleton className="h-28 rounded-3xl bg-white/5" />
                  <Skeleton className="h-40 rounded-3xl bg-white/5" />
                </div>
              )}

              {lookupState === 'done' && selectedExpense && (
                <div className="space-y-5">
                  <Card className="border-white/10 bg-white/[0.03] text-white shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-black tracking-tight text-white">
                        Titulo selecionado
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      {renderKeyValue('Departamento', selectedExpense.departamento || 'Sem departamento')}
                      {renderKeyValue('Vencimento', formatDate(selectedExpense.vencimento))}
                      {renderKeyValue('Valor', formatCurrency(selectedExpense.valor || 0))}
                      {renderKeyValue('Parcela', selectedExpense.parcela || 'Sem parcela')}
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-white/[0.03] text-white shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-black tracking-tight text-white">
                        Resultado Omie
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        {paymentBadge(lookupResult)}
                        {lookupResult?.label && (
                          <Badge className="border-white/10 bg-white/[0.05] text-white/70">
                            {lookupResult.label}
                          </Badge>
                        )}
                        {lookupResult?.omieMatchStatus && (
                          <Badge className="border-white/10 bg-white/[0.05] text-white/70">
                            {lookupResult.omieMatchStatus}
                          </Badge>
                        )}
                      </div>

                      <div
                        className={cn(
                          'rounded-2xl border px-4 py-4 text-sm',
                          lookupResult?.status === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            : lookupResult?.status === 'error'
                              ? 'border-red-500/20 bg-red-500/10 text-red-300'
                              : 'border-white/10 bg-white/[0.02] text-white/65',
                        )}
                      >
                        {lookupResult?.message ||
                          (lookupResult?.paymentType === 'pix'
                            ? 'Pagamento localizado como PIX.'
                            : lookupResult?.paymentType === 'boleto'
                              ? 'Pagamento localizado como boleto.'
                              : lookupResult?.paymentType === 'transferencia'
                                ? 'Pagamento localizado como transferencia bancaria.'
                                : 'Meio de pagamento nao encontrado.')}
                      </div>

                      {lookupResult?.paymentType === 'pix' && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {renderKeyValue(
                            'Chave PIX',
                            lookupResult.details?.pixKey || lookupResult.details?.chavePix,
                          )}
                          {renderKeyValue(
                            'QR Code PIX',
                            lookupResult.details?.pixQrCode || lookupResult.details?.pix_qrcode,
                          )}
                        </div>
                      )}

                      {lookupResult?.paymentType === 'boleto' && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {renderKeyValue(
                            'Linha digitavel',
                            lookupResult.details?.linhaDigitavel || lookupResult.details?.boletoLinhaDigitavel,
                          )}
                          {renderKeyValue(
                            'Numero do boleto',
                            lookupResult.details?.numeroBoleto || lookupResult.details?.cNumBoleto,
                          )}
                          {renderKeyValue(
                            'Link do boleto',
                            lookupResult.details?.boletoUrl || lookupResult.details?.urlBoleto,
                          )}
                        </div>
                      )}

                      {lookupResult?.paymentType === 'transferencia' && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-blue-300">
                            <div className="flex items-center gap-2 text-sm font-bold">
                              <Landmark className="h-4 w-4" />
                              Transferencia bancaria
                            </div>
                            <div className="mt-2 text-sm text-blue-200/85">
                              A Omie informou este titulo como transferencia bancaria.
                            </div>
                          </div>
                        </div>
                      )}

                      {!!lookupResult?.matches?.length && (
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                            Multiplos resultados retornados
                          </div>
                          {lookupResult.matches.map((match, index) => (
                            <div
                              key={match.id || `${match.label}-${index}`}
                              className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-white break-words">{match.label}</span>
                                {match.paymentType && paymentBadge({ status: 'success', paymentType: match.paymentType })}
                              </div>
                              {match.message && <div className="mt-2 text-sm text-white/55 break-words">{match.message}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {lookupResult?.details && (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/35">
                            <CreditCard className="h-3.5 w-3.5" />
                            Payload tecnico
                          </div>
                          <pre className="overflow-x-auto text-xs text-white/60 whitespace-pre-wrap break-words">
                            {JSON.stringify(lookupResult.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
