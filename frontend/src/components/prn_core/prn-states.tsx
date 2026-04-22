import { Loader2, AlertCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
        <div className="relative bg-white p-5 rounded-full border border-blue-100 shadow-sm">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mt-8">Processando Análise...</h3>
      <p className="text-gray-500 mt-3 max-w-md text-center leading-relaxed">
        Estamos consolidando os dados e aplicando o motor de regras JSON. Isso pode levar alguns
        segundos.
      </p>
    </div>
  )
}

export function ErrorState({ error, onReset }: { error: any; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
      <div className="bg-red-50 p-5 rounded-full mb-6 border border-red-100 shadow-sm">
        <AlertCircle className="h-12 w-12 text-red-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">Falha na Execução</h3>
      <p className="text-gray-600 max-w-md text-center mb-8 text-lg">
        {error?.message || 'Ocorreu um erro desconhecido.'}
      </p>

      {error?.technical && (
        <Collapsible className="mb-8 w-full max-w-2xl">
          <CollapsibleTrigger className="flex items-center mx-auto text-sm font-medium text-red-800 hover:text-red-900 transition-colors">
            Ver detalhes técnicos <ChevronDown className="h-4 w-4 ml-1" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="bg-gray-900 text-gray-100 p-5 rounded-xl text-sm font-mono overflow-auto max-h-60 shadow-inner">
              {error.technical}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Button
        onClick={onReset}
        size="lg"
        className="bg-gray-900 hover:bg-gray-800 text-white font-medium"
      >
        <RefreshCw className="mr-2 h-5 w-5" /> Tentar Novamente
      </Button>
    </div>
  )
}
