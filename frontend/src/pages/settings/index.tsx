import { Settings as SettingsIcon, Bell, Lock, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Configurações</h2>
        <p className="text-white/60 text-sm mt-1">
          Gerencie preferências do sistema e perfil de usuário.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="hover-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Bell className="h-5 w-5 text-[#FF9800]" />
              Notificações
            </CardTitle>
            <CardDescription className="text-white/60">
              Escolha como deseja ser alertado sobre eventos do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="alerts" className="flex flex-col space-y-1 text-white">
                <span>Alertas de Vencimento</span>
                <span className="font-normal text-sm text-white/60">
                  Notificar quando pagamentos estiverem próximos do vencimento.
                </span>
              </Label>
              <Switch id="alerts" defaultChecked />
            </div>
            <Separator className="bg-[rgba(255,255,255,0.1)]" />
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="dups" className="flex flex-col space-y-1 text-white">
                <span>Avisos de Duplicidade</span>
                <span className="font-normal text-sm text-white/60">
                  Receber e-mail ao identificar possíveis cobranças em duplicidade.
                </span>
              </Label>
              <Switch id="dups" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Lock className="h-5 w-5 text-[#28A745]" />
              Segurança
            </CardTitle>
            <CardDescription className="text-white/60">
              As opções de segurança são gerenciadas pelo Skip Cloud.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/60">
              Para alterar sua senha ou gerenciar dispositivos, acesse o painel central do Skip
              Cloud Auth.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
