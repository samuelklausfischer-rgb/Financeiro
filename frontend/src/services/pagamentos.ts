import { mockPagamentos } from '@/lib/mock-data'
import { getSupabase, isMockBackend } from '@/lib/supabase/client'

function isMock() {
  return isMockBackend()
}

async function withRecebedorExpand(rows: any[]) {
  const recebedorIds = [...new Set(rows.map((row) => row.recebedor_id).filter(Boolean))]

  if (recebedorIds.length === 0) {
    return rows.map((row) => ({ ...row, expand: { recebedor_id: null } }))
  }

  const supabase = getSupabase()
  const { data: recebedores, error } = await supabase
    .from('recebedores')
    .select('*')
    .in('id', recebedorIds)

  if (error) {
    throw error
  }

  const recebedorMap = new Map((recebedores || []).map((recebedor) => [recebedor.id, recebedor]))

  return rows.map((row) => ({
    ...row,
    expand: {
      recebedor_id: recebedorMap.get(row.recebedor_id) || null,
    },
  }))
}

export const getPagamentos = async () => {
  if (isMock()) return mockPagamentos

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('pagamentos').select('*').order('created', {
      ascending: false,
    })

    if (error) {
      throw error
    }

    return withRecebedorExpand(data || [])
  } catch (error) {
    console.error('Supabase error:', error)
    return mockPagamentos
  }
}

export const getPagamento = async (id: string) => {
  if (isMock()) return mockPagamentos.find((p) => p.id === id)

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('pagamentos').select('*').eq('id', id).single()

    if (error) {
      throw error
    }

    const [pagamento] = await withRecebedorExpand([data])
    return pagamento
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}

export const createPagamento = async (data: any) => {
  if (isMock()) return { ...data, id: 'new-id' }

  try {
    const supabase = getSupabase()
    const { data: created, error } = await supabase.from('pagamentos').insert(data).select().single()

    if (error) {
      throw error
    }

    return created
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}

export const updatePagamento = async (id: string, data: any) => {
  if (isMock()) return { ...data, id }

  try {
    const supabase = getSupabase()
    const { data: updated, error } = await supabase
      .from('pagamentos')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return updated
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}

export const deletePagamento = async (id: string) => {
  if (isMock()) return true

  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('pagamentos').delete().eq('id', id)

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}
