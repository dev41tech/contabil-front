import { NavLink } from 'react-router-dom'
import {
  BarChart3, BookOpen, ClipboardCheck, CreditCard, FileText, FileClock, Inbox,
  LayoutDashboard, LogOut, PiggyBank, Receipt, Scale, ShieldCheck,
  SlidersHorizontal, Tags, TrendingUp, Users, Wifi, Zap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { EmpresaSwitcher } from './EmpresaSwitcher'

const navGroups = [
  {
    label: 'Visão geral',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
    ],
  },
  {
    label: 'Movimentações',
    items: [
      { to: '/importacoes', icon: Inbox, label: 'Importações', adminOnly: false },
      { to: '/extrato', icon: FileText, label: 'Extrato Bancário', adminOnly: false },
      { to: '/cartoes', icon: CreditCard, label: 'Cartão de Crédito', adminOnly: false },
      { to: '/aplicacoes-financeiras', icon: PiggyBank, label: 'Aplicações Financeiras', adminOnly: false },
      { to: '/openbanking', icon: Wifi, label: 'Open Banking', adminOnly: false },
    ],
  },
  {
    label: 'Classificação',
    items: [
      { to: '/neo', icon: Zap, label: 'NEO', adminOnly: false },
      { to: '/classificacao', icon: Tags, label: 'Classificação', adminOnly: false },
    ],
  },
  {
    label: 'Documentos',
    items: [
      { to: '/notas', icon: Receipt, label: 'Notas Fiscais', adminOnly: false },
      { to: '/comprovantes', icon: ClipboardCheck, label: 'Comprovantes', adminOnly: false },
    ],
  },
  {
    label: 'Conferência e entrega',
    items: [
      { to: '/concilpro', icon: Scale, label: 'CONCILPRO', adminOnly: false },
      { to: '/registros', icon: BookOpen, label: 'Registros', adminOnly: false },
      { to: '/relatorios', icon: TrendingUp, label: 'Relatórios', adminOnly: false },
    ],
  },
  {
    label: 'Administração',
    items: [
      { to: '/configuracoes', icon: SlidersHorizontal, label: 'Configurações', adminOnly: false },
      { to: '/usuarios', icon: Users, label: 'Usuários', adminOnly: true },
      { to: '/permissoes', icon: ShieldCheck, label: 'Permissões', adminOnly: true },
      { to: '/auditoria', icon: FileClock, label: 'Auditoria', adminOnly: true },
    ],
  },
]

/**
 * Sidebar do DS: rótulos de grupo fixos, sem acordeão.
 *
 * Os grupos eram colapsáveis porque a lista não cabia; com a densidade do
 * Connect (item de 14px em 8px de padding) os 17 itens cabem, e um clique a
 * menos por navegação vale mais que a altura economizada. O item ativo é
 * marcado por cor + barra de 3px na borda, não por fundo cheio.
 */
export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-[18px]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand">
          <BarChart3 className="h-4 w-4 text-on-brand" strokeWidth={2.2} />
        </span>
        <span className="font-display text-base font-semibold tracking-[-0.01em]">Contabil Core</span>
      </div>

      <div className="shrink-0 border-b border-border px-3 pb-3">
        <EmpresaSwitcher />
      </div>

      <nav className="scroll-y flex-1 space-y-0.5 overflow-y-auto p-3">
        {navGroups.map(group => {
          const items = group.items.filter(({ adminOnly }) => !adminOnly || user?.role === 'admin')
          if (items.length === 0) return null

          return (
            <section key={group.label}>
              <p className="px-2.5 pb-1.5 pt-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn(
                    'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-label font-medium transition-colors',
                    isActive ? 'text-brand' : 'text-fg-secondary hover:text-foreground',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute -left-3 bottom-1 top-1 w-[3px] rounded-r-full bg-brand" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </section>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-label font-medium text-fg-secondary transition-colors hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  )
}
