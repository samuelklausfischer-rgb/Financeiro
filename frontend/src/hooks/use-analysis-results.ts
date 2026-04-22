import { useState, useEffect, useCallback } from 'react'
import { AnalysisResult, analysisService } from '@/services/analysis'
import { toast } from 'sonner'

export function useAnalysisResults() {
  const [data, setData] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(false)
    try {
      setTimeout(() => {
        let result = analysisService.getStoredResult()

        if (!result && !localStorage.getItem('analysis-result-cleared')) {
          result = analysisService.getMockResult()
          analysisService.setStoredResult(result)
        }

        if (result) {
          setData(result)
          toast.success('Análise carregada com sucesso!', { duration: 3000 })
        } else {
          setData(null)
        }
        setLoading(false)
      }, 600)
    } catch (e) {
      setError(true)
      setLoading(false)
      toast.error('Não foi possível carregar a análise')
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const clearAndRedirect = (navigate: (path: string) => void) => {
    analysisService.clearStoredResult()
    localStorage.setItem('analysis-result-cleared', 'true')
    navigate('/analise-prn')
  }

  return {
    data,
    loading,
    error,
    isEmpty: !loading && !error && !data,
    retry: loadData,
    clearAndRedirect,
  }
}
