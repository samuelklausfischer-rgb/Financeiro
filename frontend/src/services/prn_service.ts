import { getSupabase } from '@/lib/supabase/client'

const PRN_API_URL =
  import.meta.env.VITE_PRN_ANALYSIS_API_URL || 'https://prndiag1.app.n8n.cloud/webhook/prn/report'

const MAX_STORAGE_FILENAME_LENGTH = 120

export type HistoryFileReference = {
  id?: string
  name: string
  created_at?: string
  metadata?: Record<string, any> | null
  originalFilename: string
}

export type PrnHistoricalFileMeta = {
  storage_name?: string | null
  original_filename: string
  source: 'vault' | 'temporary' | 'legacy'
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function deriveOriginalFilename(fileName: string) {
  return fileName.split('_').slice(1).join('_') || fileName
}

function sanitizeStorageFilename(fileName: string) {
  const normalized = stripDiacritics(fileName).trim()
  const extensionIndex = normalized.lastIndexOf('.')
  const rawBase = extensionIndex > 0 ? normalized.slice(0, extensionIndex) : normalized
  const rawExtension = extensionIndex > 0 ? normalized.slice(extensionIndex + 1) : ''

  const safeBase =
    rawBase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_STORAGE_FILENAME_LENGTH) || 'historico'

  const safeExtension = rawExtension.toLowerCase().replace(/[^a-z0-9]+/g, '')

  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase
}

function parseHistoricalFilesMeta(value: FormDataEntryValue | null): PrnHistoricalFileMeta[] {
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.original_filename === 'string')
      .map((item) => ({
        storage_name: typeof item.storage_name === 'string' ? item.storage_name : null,
        original_filename: item.original_filename,
        source:
          item.source === 'vault' || item.source === 'temporary' || item.source === 'legacy'
            ? item.source
            : 'temporary',
      }))
  } catch {
    return []
  }
}

function normalizePayload(payload: any) {
  if (Array.isArray(payload)) {
    return normalizePayload(payload[0])
  }

  if (payload?.payload) {
    return normalizePayload(payload.payload)
  }

  if (payload?.reportModel) {
    return payload
  }

  return payload
}

async function getCurrentUserId() {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id || null
}

async function createRunRecord(formData: FormData) {
  const supabase = getSupabase()
  const userId = await getCurrentUserId()

  const payload = {
    user_id: userId,
    data_referencia: (formData.get('reference_date') as string) || null,
    daily_filename: (formData.get('daily_filename') as string) || 'daily.xlsx',
    historical_filename: (formData.get('historical_filename') as string) || 'historical.xlsx',
    historical_files: parseHistoricalFilesMeta(formData.get('historical_files_meta')),
    status: 'processing',
    webhook_url: PRN_API_URL,
  }

  const { data, error } = await supabase.from('prn_report_runs').insert(payload).select().single()

  if (error) {
    throw error
  }

  return data
}

async function updateRunRecord(id: string, updates: Record<string, any>) {
  const supabase = getSupabase()
  const { error } = await supabase.from('prn_report_runs').update(updates).eq('id', id)

  if (error) {
    throw error
  }
}

export async function updatePrnRunPayload(id: string, payload: any, meta?: Record<string, any>) {
  const updates: Record<string, any> = {
    result_json: payload,
  }

  if (meta) {
    updates.meta = meta
  }

  await updateRunRecord(id, updates)
}

export async function markPrnRunAsError(id: string, errorMessage: string, errorDetails?: string) {
  await updateRunRecord(id, {
    status: 'error',
    error_code: 'CLIENT_SIDE_ERROR',
    error_message: errorMessage,
    ...(errorDetails ? { meta: { details: errorDetails } } : {}),
  })
}

async function parsePrnResponse(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null)
    return normalizePayload(json)
  }

  const text = await response.text().catch(() => '')
  if (text.trim().startsWith('<')) {
    return { ok: true, type: 'legacy_html', html: text }
  }

  return normalizePayload(text)
}

export async function getPrnHistoryRuns() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('prn_report_runs')
    .select(
      'id, created, status, data_referencia, daily_filename, historical_filename, historical_files, error_message, error_code, duration_ms',
    )
    .order('created', { ascending: false })
    .limit(10)

  if (error) {
    throw error
  }

  return { items: data || [] }
}

export async function deletePrnReportRun(id: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('prn_report_runs').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function getPrnReportData(id: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('prn_report_runs')
    .select(
      'id, data_referencia, response_html, meta, result_json, status, error_message, error_code, historical_filename, historical_files',
    )
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function getPrnReportHtml(id: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('prn_report_runs')
    .select('response_html')
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  return data.response_html
}

export async function submitPrnAnalysisJson(formData: FormData) {
  const runRecord = await createRunRecord(formData)
  const startedAt = Date.now()

  try {
    const response = await fetch(PRN_API_URL, {
      method: 'POST',
      body: formData,
    })

    const data = await parsePrnResponse(response)
    const durationMs = Date.now() - startedAt

    if (!response.ok || (data && typeof data === 'object' && data.ok === false)) {
      const errorMsg =
        data?.error?.message || `Erro na comunicação com o motor de regras: ${response.status}`
      const details = data?.error?.details || 'Nenhum detalhe adicional.'
      const code = data?.error?.code || 'ANALYSIS_ERROR'

      await updateRunRecord(runRecord.id, {
        status: 'error',
        webhook_http_status: response.status,
        duration_ms: durationMs,
        error_code: code,
        error_message: errorMsg,
        meta: { details },
      })

      const err = new Error(errorMsg) as Error & { details?: string; code?: string }
      err.details = details
      err.code = code
      throw err
    }

    if (!data) {
      throw new Error(`Resposta inválida do motor de análise: ${response.status}`)
    }

    await updateRunRecord(runRecord.id, {
      status: 'success',
      webhook_http_status: response.status,
      webhook_content_type: response.headers.get('content-type') || '',
      duration_ms: durationMs,
      response_html: data.html || null,
      result_json: typeof data === 'object' ? data : null,
      meta: typeof data === 'object' ? { ...(data.meta || {}), httpStatus: response.status } : null,
    })

    return { ...data, _runId: runRecord.id }
  } catch (error: any) {
    const durationMs = Date.now() - startedAt

    try {
      await updateRunRecord(runRecord.id, {
        status: 'error',
        duration_ms: durationMs,
        error_code: error.code || 'ANALYSIS_ERROR',
        error_message: error.message || 'Falha ao processar a análise PRN.',
        meta: {
          details: error.details || error.stack || String(error),
        },
      })
    } catch (persistError) {
      console.error('Failed to persist PRN error:', persistError)
    }

    throw error
  }
}

export async function listHistoryFiles(): Promise<HistoryFileReference[]> {
  const supabase = getSupabase()
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase.storage.from('prn_history_files').list(userId, {
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) {
    console.error('Failed to list history files', error)
    return []
  }

  return (data || []).map((file: any) => ({
    ...file,
    originalFilename:
      typeof file?.metadata?.originalFilename === 'string' && file.metadata.originalFilename.trim()
        ? file.metadata.originalFilename
        : deriveOriginalFilename(file.name),
  }))
}

export async function uploadHistoryFile(file: File) {
  const supabase = getSupabase()
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('User not authenticated')

  const filePath = `${userId}/${Date.now()}_${sanitizeStorageFilename(file.name)}`
  const { data, error } = await supabase.storage.from('prn_history_files').upload(filePath, file, {
    contentType:
      file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    metadata: {
      originalFilename: file.name,
    },
  })

  if (error) {
    throw error
  }

  return data
}

export async function deleteHistoryFile(fileName: string) {
  const supabase = getSupabase()
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('User not authenticated')

  const filePath = `${userId}/${fileName}`
  const { error } = await supabase.storage.from('prn_history_files').remove([filePath])

  if (error) {
    throw error
  }
}

export async function downloadHistoryFile(fileName: string, originalFilename?: string): Promise<File> {
  const supabase = getSupabase()
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('User not authenticated')

  const filePath = `${userId}/${fileName}`
  const { data, error } = await supabase.storage.from('prn_history_files').download(filePath)

  if (error) {
    throw error
  }

  const originalName = originalFilename?.trim() || deriveOriginalFilename(fileName)
  return new File([data], originalName, { type: data.type })
}

export async function submitPrnAnalysis(formData: FormData) {
  return submitPrnAnalysisJson(formData)
}
