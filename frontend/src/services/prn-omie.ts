import { getSupabase } from '@/lib/supabase/client'

export type PrnOmiePaymentType = 'pix' | 'boleto' | 'transferencia' | 'not_found'

export interface PrnOmieExpenseLookupInput {
  favorecido: string
  vencimento: string
  valor: number
  parcela?: string | null
  observacao?: string | null
  departamento?: string | null
  categoriaOriginal?: string | null
}

export interface PrnOmieLookupResult {
  status: 'success' | 'multiple_matches' | 'no_match' | 'error' | 'not_configured'
  paymentType?: PrnOmiePaymentType
  label?: string
  message?: string
  omieMatchStatus?: string
  details?: Record<string, any> | null
  matches?: Array<{
    id?: string
    label: string
    paymentType?: PrnOmiePaymentType
    message?: string
    details?: Record<string, any> | null
  }>
}

function normalizePaymentType(rawType?: string | null): PrnOmiePaymentType | undefined {
  if (!rawType) return undefined

  const normalized = rawType.toLowerCase()
  if (normalized.includes('pix')) return 'pix'
  if (normalized.includes('boleto') || normalized.includes('bol')) return 'boleto'
  if (normalized.includes('transferencia') || normalized.includes('tra') || normalized.includes('ted') || normalized.includes('doc')) return 'transferencia'
  if (normalized === 'not_found') return 'not_found'

  return undefined
}

function normalizeLookupResult(payload: any): PrnOmieLookupResult {
  const paymentType = normalizePaymentType(payload?.paymentType || payload?.formaPagamento)

  return {
    status: payload?.status || 'error',
    paymentType,
    label: payload?.label,
    message: payload?.message,
    omieMatchStatus: payload?.omieMatchStatus,
    details: payload?.details || null,
    matches: Array.isArray(payload?.matches)
      ? payload.matches.map((match: any) => ({
          id: match?.id,
          label: match?.label || 'Resultado Omie',
          paymentType: normalizePaymentType(match?.paymentType || match?.formaPagamento),
          message: match?.message,
          details: match?.details || null,
        }))
      : undefined,
  }
}

export async function lookupPrnOmiePayment(args: {
  requestId?: string | null
  rowName: string
  expense: PrnOmieExpenseLookupInput
}): Promise<PrnOmieLookupResult> {
  const supabase = getSupabase()

  try {
    const { data, error } = await supabase.functions.invoke('prn-omie-lookup', {
      body: {
        requestId: args.requestId,
        rowNome: args.rowName,
        expense: args.expense,
      },
    })

    if (error) {
      console.error('Erro na Edge Function:', error)
      return {
        status: 'error',
        message: error.message || 'Falha ao consultar Omie.',
        details: { error },
      }
    }

    return normalizeLookupResult(data)
  } catch (err: any) {
    return {
      status: 'error',
      message: err.message || 'Falha na requisição.',
      details: { err },
    }
  }
}
