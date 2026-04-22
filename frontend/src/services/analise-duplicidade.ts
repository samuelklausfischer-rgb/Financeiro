import { getSupabase } from '@/lib/supabase/client'

const DUPLICITY_API_URL =
  import.meta.env.VITE_DUPLICITY_ANALYSIS_API_URL ||
  'https://prndiag1.app.n8n.cloud/webhook/analise-duplicidade-process'

export interface AnalysisRecord {
  id: string
  file_name: string
  status: 'processing' | 'completed' | 'error'
  uploaded_by?: string
  total_records: number
  analyzable_records: number
  duplicate_count: number
  manual_review_count: number
  name_repeat_manual_count: number
  group_count: number
  manual_group_count: number
  name_repeat_manual_group_count: number
  overall_manual_count: number
  overall_manual_group_count: number
  partial_structure_count: number
  result_json: any
  created: string
  updated: string
  error_message?: string
  expand?: {
    uploaded_by?: {
      name: string
      email: string
    }
  }
}

async function getCurrentUserId() {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id || null
}

async function hydrateUploadedBy(items: AnalysisRecord[]) {
  const userIds = [...new Set(items.map((item) => item.uploaded_by).filter(Boolean))]

  if (userIds.length === 0) {
    return items
  }

  const supabase = getSupabase()
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds)

  if (error) {
    throw error
  }

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))

  return items.map((item) => ({
    ...item,
    expand: item.uploaded_by
      ? {
          uploaded_by: profileMap.get(item.uploaded_by)
            ? {
                name: profileMap.get(item.uploaded_by)!.name,
                email: profileMap.get(item.uploaded_by)!.email,
              }
            : undefined,
        }
      : undefined,
  }))
}

function mapAnalysisSuccess(record: AnalysisRecord, responseData: any): AnalysisRecord {
  const data = responseData?.result || responseData || {}
  const summary = data.summary || data || {}

  return {
    ...record,
    status: 'completed',
    result_json: data,
    total_records: summary.totalRecords ?? summary.total_records ?? 0,
    analyzable_records: summary.analyzableRecords ?? summary.analyzable_records ?? 0,
    duplicate_count: summary.duplicateCount ?? summary.duplicate_count ?? 0,
    manual_review_count: summary.manualReviewCount ?? summary.manual_review_count ?? 0,
    name_repeat_manual_count: summary.nameRepeatManualCount ?? summary.name_repeat_manual_count ?? 0,
    group_count: summary.groupCount ?? summary.group_count ?? 0,
    manual_group_count: summary.manualGroupCount ?? summary.manual_group_count ?? 0,
    name_repeat_manual_group_count:
      summary.nameRepeatManualGroupCount ?? summary.name_repeat_manual_group_count ?? 0,
    overall_manual_count: summary.overallManualCount ?? summary.overall_manual_count ?? 0,
    overall_manual_group_count:
      summary.overallManualGroupCount ?? summary.overall_manual_group_count ?? 0,
    partial_structure_count: summary.partialStructureCount ?? summary.partial_structure_count ?? 0,
    error_message: undefined,
  }
}

export const getAnalises = async (
  page = 1,
  perPage = 20,
  filters?: { status?: string; search?: string; startDate?: string; endDate?: string },
) => {
  const supabase = getSupabase()
  let query = supabase.from('analises_duplicidade').select('*', { count: 'exact' })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.ilike('file_name', `%${filters.search}%`)
  }

  if (filters?.startDate) {
    query = query.gte('created', `${filters.startDate}T00:00:00.000Z`)
  }

  if (filters?.endDate) {
    query = query.lte('created', `${filters.endDate}T23:59:59.999Z`)
  }

  const from = (page - 1) * perPage
  const to = from + perPage - 1
  const { data, error, count } = await query.order('created', { ascending: false }).range(from, to)

  if (error) {
    throw error
  }

  const items = await hydrateUploadedBy((data || []) as AnalysisRecord[])

  return {
    items,
    page,
    perPage,
    hasMore: (count || 0) > page * perPage,
  }
}

export const getAnalise = async (id: string) => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('analises_duplicidade')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  const [item] = await hydrateUploadedBy([data as AnalysisRecord])
  return item
}

export const deleteAnalise = async (id: string) => {
  const supabase = getSupabase()
  const { error } = await supabase.from('analises_duplicidade').delete().eq('id', id)

  if (error) {
    throw error
  }

  return true
}

export const clearAllAnalises = async () => {
  const supabase = getSupabase()
  const { error } = await supabase.from('analises_duplicidade').delete().not('id', 'is', null)

  if (error) {
    throw error
  }

  return true
}

export const createAnalise = async (file: File) => {
  const supabase = getSupabase()
  const userId = await getCurrentUserId()

  if (!userId) {
    const error = new Error('Session Expired')
    ;(error as any).status = 401
    throw error
  }

  const { data: created, error: createError } = await supabase
    .from('analises_duplicidade')
    .insert({
      file_name: file.name,
      status: 'processing',
      uploaded_by: userId,
    })
    .select('*')
    .single()

  if (createError) {
    throw createError
  }

  const record = created as AnalysisRecord
  const formData = new FormData()
  formData.append('request_id', record.id)
  formData.append('file', file, file.name)

  try {
    const response = await fetch(DUPLICITY_API_URL, {
      method: 'POST',
      body: formData,
    })

    const responseData = await response.json().catch(() => ({}))

    let nextRecord: AnalysisRecord
    if (!response.ok || responseData.error) {
      nextRecord = {
        ...record,
        status: 'error',
        error_message:
          responseData.error_message ||
          responseData.errorMessage ||
          responseData.message ||
          'Falha ao processar arquivo no servidor.',
      }
    } else {
      nextRecord = mapAnalysisSuccess(record, responseData)
    }

    const { data: updated, error: updateError } = await supabase
      .from('analises_duplicidade')
      .update({
        status: nextRecord.status,
        error_code: nextRecord.status === 'error' ? responseData.error_code || responseData.errorCode : null,
        error_message: nextRecord.error_message || null,
        total_records: nextRecord.total_records,
        analyzable_records: nextRecord.analyzable_records,
        duplicate_count: nextRecord.duplicate_count,
        manual_review_count: nextRecord.manual_review_count,
        name_repeat_manual_count: nextRecord.name_repeat_manual_count,
        group_count: nextRecord.group_count,
        manual_group_count: nextRecord.manual_group_count,
        name_repeat_manual_group_count: nextRecord.name_repeat_manual_group_count,
        overall_manual_count: nextRecord.overall_manual_count,
        overall_manual_group_count: nextRecord.overall_manual_group_count,
        partial_structure_count: nextRecord.partial_structure_count,
        result_json: nextRecord.result_json,
      })
      .eq('id', record.id)
      .select('*')
      .single()

    if (updateError) {
      throw updateError
    }

    return updated as AnalysisRecord
  } catch (error) {
    await supabase
      .from('analises_duplicidade')
      .update({
        status: 'error',
        error_code: 'WEBHOOK_ERROR',
        error_message: error instanceof Error ? error.message : 'Falha ao executar a análise.',
      })
      .eq('id', record.id)

    throw error
  }
}
