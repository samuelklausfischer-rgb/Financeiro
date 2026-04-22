import { mockAlertas } from '@/lib/mock-data'
import { getSupabase, isMockBackend } from '@/lib/supabase/client'

function isMock() {
  return isMockBackend()
}

export const getAlertas = async () => {
  if (isMock()) return mockAlertas

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('alertas').select('*').order('created', {
      ascending: false,
    })

    if (error) {
      throw error
    }

    return data || []
  } catch (error) {
    console.error('Supabase error:', error)
    return mockAlertas
  }
}

export const getAlerta = async (id: string) => {
  if (isMock()) return mockAlertas.find((a) => a.id === id)

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('alertas').select('*').eq('id', id).single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Supabase error:', error)
    throw error
  }
}

export const updateAlerta = async (id: string, data: any) => {
  if (isMock()) return { ...data, id }
  
  try {
    const supabase = getSupabase()
    const { data: updated, error } = await supabase
      .from('alertas')
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
