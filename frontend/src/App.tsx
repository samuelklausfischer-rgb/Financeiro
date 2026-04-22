import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/protected-route'
import { RootLayout } from '@/components/layout/root-layout'

// Pages
import Login from './pages/auth/login'
import AnalysisResults from './pages/analysis-results'
import Dashboard from './pages/dashboard'
import Payees from './pages/payees'
import Payments from './pages/payments'
import Reports from './pages/reports'
import Settings from './pages/settings'
import DuplicityAnalysis from './pages/duplicity-analysis'
import PrnAnalysis from './pages/prn-analysis'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes inside App Layout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/analysis-results" element={<AnalysisResults />} />
            <Route element={<RootLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/recebedores" element={<Payees />} />
              <Route path="/pagamentos" element={<Payments />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/analise-duplicidade" element={<DuplicityAnalysis />} />
              <Route path="/analise-prn" element={<PrnAnalysis />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
