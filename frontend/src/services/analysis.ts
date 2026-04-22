export interface CrossAnalysisItem {
  nome: string
  divergenciaPercentual?: number
  mediaHistorica?: number
  valorDia: number
  ultimoPagamento?: string
  alertaDivergencia25?: boolean
}

export interface TopExpense {
  posicao: number
  favorecido: string
  categoria: string
  valor: number
  vencimento: string
}

export interface CategoryExpense {
  categoria: string
  valor: number
  percentual: number
}

export interface SupplierRanking {
  fornecedor: string
  valor: number
  percentual: number
}

export interface AccountDistribution {
  conta: string
  valor: number
  percentual: number
}

export interface EntityBalance {
  entidade: string
  saldo: number
}

export interface AnalysisResult {
  executionId: string
  dataReferencia: string
  summary: {
    totalDespesas: number
    totalRecebido: number
    saldoBancario: number
    transferenciaNecessaria: number
  }
  secondary: {
    recebimentosDiariosCount: number
    recebimentosDiariosValor: number
    emissoesCount: number
    emissoesValor: number
    contasPagasCount: number
    contasPagasValor: number
    volumePagamentos: number
  }
  alertasManual: CrossAnalysisItem[]
  comHistorico: CrossAnalysisItem[]
  diferenteEntreMeses: CrossAnalysisItem[]
  exatoTodosMeses: CrossAnalysisItem[]
  semHistorico: CrossAnalysisItem[]
  top10Despesas: TopExpense[]
  despesasCategoria: CategoryExpense[]
  topFornecedores: SupplierRanking[]
  distribuicaoConta: AccountDistribution[]
  balancesEntidade: EntityBalance[]
}

const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  executionId: 'exec-9f8e-4b2a-11ec-b2d8',
  dataReferencia: '2023-10-25',
  summary: {
    totalDespesas: 145230.5,
    totalRecebido: 180500.0,
    saldoBancario: 45000.0,
    transferenciaNecessaria: 0,
  },
  secondary: {
    recebimentosDiariosCount: 15,
    recebimentosDiariosValor: 4500.0,
    emissoesCount: 8,
    emissoesValor: 12300.0,
    contasPagasCount: 42,
    contasPagasValor: 35000.0,
    volumePagamentos: 150,
  },
  alertasManual: [
    {
      nome: 'Fornecedor Alpha',
      divergenciaPercentual: 28.5,
      mediaHistorica: 1000,
      valorDia: 1285,
      ultimoPagamento: '2023-09-25',
      alertaDivergencia25: true,
    },
    {
      nome: 'Serviços Beta',
      divergenciaPercentual: 15.2,
      mediaHistorica: 500,
      valorDia: 576,
      ultimoPagamento: '2023-09-25',
      alertaDivergencia25: false,
    },
  ],
  comHistorico: [
    {
      nome: 'Energia Elétrica',
      divergenciaPercentual: 5.0,
      mediaHistorica: 800,
      valorDia: 840,
      ultimoPagamento: '2023-09-20',
      alertaDivergencia25: false,
    },
    {
      nome: 'Internet ISP',
      divergenciaPercentual: 0.0,
      mediaHistorica: 150,
      valorDia: 150,
      ultimoPagamento: '2023-09-21',
      alertaDivergencia25: false,
    },
  ],
  diferenteEntreMeses: [
    {
      nome: 'Material Escritório',
      divergenciaPercentual: 12.0,
      mediaHistorica: 300,
      valorDia: 336,
      ultimoPagamento: '2023-08-15',
      alertaDivergencia25: false,
    },
  ],
  exatoTodosMeses: [
    {
      nome: 'Aluguel',
      divergenciaPercentual: 0,
      mediaHistorica: 5000,
      valorDia: 5000,
      ultimoPagamento: '2023-09-01',
      alertaDivergencia25: false,
    },
    {
      nome: 'Condomínio',
      divergenciaPercentual: 0,
      mediaHistorica: 800,
      valorDia: 800,
      ultimoPagamento: '2023-09-05',
      alertaDivergencia25: false,
    },
  ],
  semHistorico: [
    { nome: 'Manutenção Ar Condicionado', valorDia: 450 },
    { nome: 'Consultoria Jurídica Extra', valorDia: 2500 },
  ],
  top10Despesas: [
    {
      posicao: 1,
      favorecido: 'Imobiliária XYZ',
      categoria: 'Aluguel',
      valor: 5000,
      vencimento: '2023-10-01',
    },
    {
      posicao: 2,
      favorecido: 'Receita Federal',
      categoria: 'Impostos',
      valor: 4500,
      vencimento: '2023-10-15',
    },
  ],
  despesasCategoria: [
    { categoria: 'Infraestrutura', valor: 6000, percentual: 30 },
    { categoria: 'Impostos', valor: 4500, percentual: 22.5 },
  ],
  topFornecedores: [
    { fornecedor: 'Imobiliária XYZ', valor: 5000, percentual: 25 },
    { fornecedor: 'Receita Federal', valor: 4500, percentual: 22.5 },
  ],
  distribuicaoConta: [
    { conta: 'Bradesco CC', valor: 100000, percentual: 70 },
    { conta: 'Itaú CC', valor: 45230.5, percentual: 30 },
  ],
  balancesEntidade: [
    { entidade: 'Empresa Matriz', saldo: 120000 },
    { entidade: 'Filial Sul', saldo: 25230.5 },
  ],
}

export const analysisService = {
  getStoredResult: (): AnalysisResult | null => {
    try {
      const data = localStorage.getItem('analysis-result-current')
      if (data) return JSON.parse(data)
      return null
    } catch {
      return null
    }
  },
  getMockResult: () => MOCK_ANALYSIS_RESULT,
  setStoredResult: (data: AnalysisResult) => {
    localStorage.setItem('analysis-result-current', JSON.stringify(data))
  },
  clearStoredResult: () => {
    localStorage.removeItem('analysis-result-current')
  },
  formatCurrency: (value?: number) => {
    if (value === undefined || value === null) return '-'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  },
  formatPercent: (value?: number) => {
    if (value === undefined || value === null) return '-'
    return `${value.toFixed(1).replace('.', ',')}%`
  },
  formatDate: (dateStr?: string) => {
    if (!dateStr) return '-'
    const [year, month, day] = dateStr.split('-')
    if (year && month && day) return `${day}/${month}/${year}`
    return dateStr
  },
}
