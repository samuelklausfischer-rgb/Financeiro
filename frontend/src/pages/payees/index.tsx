import { useState, useEffect } from 'react'
import { Users, Plus, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getRecebedores } from '@/services/recebedores'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Payees() {
  const [recebedores, setRecebedores] = useState<any[]>([])
  const [search, setSearch] = useState('')

  const loadData = async () => {
    try {
      const data = await getRecebedores()
      setRecebedores(data)
    } catch (e) {
      console.error('Failed to load recebedores:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('recebedores', loadData)

  const filtered = recebedores.filter(
    (r) =>
      r.nome_razao_social.toLowerCase().includes(search.toLowerCase()) ||
      r.cpf_cnpj.includes(search) ||
      (r.email && r.email.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Recebedores</h2>
          <p className="text-white/60 text-sm mt-1">Gerencie médicos, fornecedores e empresas.</p>
        </div>
        <Button className="bg-[#0066CC] hover:bg-[#0055aa] text-white transition-all duration-300 hover:scale-[1.02] shadow-lg border-none">
          <Plus className="mr-2 h-4 w-4" />
          Novo Recebedor
        </Button>
      </div>

      <Card className="hover-glass">
        <CardHeader className="pb-3 border-b border-[rgba(255,255,255,0.05)] mb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white">Lista de Recebedores</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/50" />
              <Input
                type="search"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white placeholder:text-white/40 focus:ring-[#0066CC]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-[rgba(255,255,255,0.05)]">
                  <TableHead className="text-white/70">Nome / Razão Social</TableHead>
                  <TableHead className="text-white/70">Tipo</TableHead>
                  <TableHead className="text-white/70">CPF / CNPJ</TableHead>
                  <TableHead className="text-white/70">E-mail</TableHead>
                  <TableHead className="text-right text-white/70">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-white">{r.nome_razao_social}</TableCell>
                    <TableCell className="text-white/70 capitalize">{r.tipo}</TableCell>
                    <TableCell className="text-white/70">{r.cpf_cnpj}</TableCell>
                    <TableCell className="text-white/70">{r.email || '-'}</TableCell>
                    <TableCell className="text-right">
                      {r.ativo ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#28A745]/20 text-[#28A745]">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#DC3545]/20 text-[#DC3545]">
                          Inativo
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)]">
              <div className="bg-[rgba(255,255,255,0.05)] p-4 rounded-full mb-4">
                <Users className="h-8 w-8 text-white/40" />
              </div>
              <h3 className="text-lg font-medium text-white">Nenhum recebedor encontrado</h3>
              <p className="text-sm text-white/50 mt-1 max-w-sm">
                Comece adicionando novos recebedores ou ajuste seus filtros de busca.
              </p>
              <Button
                variant="outline"
                className="mt-4 border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.1)] text-white bg-transparent"
              >
                Importar Planilha
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
