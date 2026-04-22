import { FileText, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Relatórios</h2>
        <p className="text-white/60 text-sm mt-1">Gere e exporte demonstrativos financeiros.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover-glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <CalendarDays className="h-5 w-5 text-[#0066CC]" />
              Fechamento Mensal
            </CardTitle>
            <CardDescription className="text-white/60">
              Resumo de todos os pagamentos efetuados no mês atual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10"
            >
              Gerar PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-[#6F42C1]" />
              Previsão de Fluxo
            </CardTitle>
            <CardDescription className="text-white/60">
              Projeção de saídas baseada em contas a pagar pendentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10"
            >
              Exportar Excel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
