import { useEffect, useRef } from 'react'
import { getSupabase, isMockBackend } from '@/lib/supabase/client'

/**
 * Hook for real-time subscriptions to a Supabase table.
 * ALWAYS use this hook instead of subscribing inline.
 */
export function useRealtime(
  tableName: string,
  callback: (data: any) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled || isMockBackend()) return

    const supabase = getSupabase()
    const channel = supabase
      .channel(`realtime:${tableName}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          callbackRef.current(payload)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tableName, enabled])
}
