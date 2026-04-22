import { mockRecebedores } from '@/lib/mock-data'
import { getSupabase, isMockBackend } from '@/lib/supabase/client'

function isMock() {
  return isMockBackend()
}

export const getRecebedores = async () => {
  if (isMock()) return mockRecebedores

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('recebedores').select('*').order('nome_razao_social')

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Supabase error:', error)
    return mockRecebedores
  }
}

export const getRecebedor = async (id: string) => {
  if (isMock()) return mockRecebedores.find((r) => r.id === id)

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('recebedores').select('*').eq('id', id).single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}

export const createRecebedor = async (data: any) => {
  if (isMock()) return { ...data, id: 'new-id' }
  
  try {
    const supabase = getSupabase()
    const { data: created, error } = await supabase.from('recebedores').insert(data).select().single()

    if (error) {
      throw error
    }

    return created
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}

export const updateRecebedor = async (id: string, data: any) => {
  if (isMock()) return { ...data, id }
  
  try {
    const supabase = getSupabase()
    const { data: updated, error } = await supabase
      .from('recebedores')
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

export const deleteRecebedor = async (id: string) => {
  if (isMock()) return true
  
  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('recebedores').delete().eq('id', id)

    if (error) {
      throw error
    }

    return true
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}
