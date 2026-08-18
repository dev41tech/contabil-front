import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import ExtratoPage from '@/pages/Extrato'
import NeoPage from '@/pages/Neo'
import ConcilProPage from '@/pages/ConcilPro'
import RegistrosPage from '@/pages/Registros'
import ConfiguracoesPage from '@/pages/Configuracoes'
import NotasPage from '@/pages/Notas'
import UsuariosPage from '@/pages/Usuarios'
import ComprovantesPage from '@/pages/Comprovantes'
import PermissoesPage from '@/pages/Permissoes'
import CartoesPage from '@/pages/Cartoes'
import OpenBankingPage from '@/pages/OpenBanking'
import RelatoriosPage from '@/pages/Relatorios'
import AplicacoesFinanceirasPage from '@/pages/AplicacoesFinanceiras'
import ContrapartesPage from '@/pages/Contrapartes'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/toaster'
import { EmpresaProvider } from '@/contexts/EmpresaContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="extrato" element={<ExtratoPage />} />
        <Route path="neo" element={<NeoPage />} />
        <Route path="concilpro" element={<ConcilProPage />} />
        <Route path="registros" element={<RegistrosPage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
        <Route path="notas" element={<NotasPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="permissoes" element={<PermissoesPage />} />
        <Route path="cartoes" element={<CartoesPage />} />
        <Route path="openbanking" element={<OpenBankingPage />} />
        <Route path="relatorios" element={<RelatoriosPage />} />
        <Route path="comprovantes" element={<ComprovantesPage />} />
        <Route path="aplicacoes-financeiras" element={<AplicacoesFinanceirasPage />} />
        <Route path="contrapartes" element={<ContrapartesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
            <AppRoutes />
            <Toaster />
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
