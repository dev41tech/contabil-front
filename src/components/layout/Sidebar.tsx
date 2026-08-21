import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileText,
  FileClock,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  Tags,
  TrendingUp,
  Users,
  Wifi,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

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
      { to: '/configuracoes', icon: Settings, label: 'Configurações', adminOnly: false },
      { to: '/usuarios', icon: Users, label: 'Usuários', adminOnly: true },
      { to: '/permissoes', icon: ShieldCheck, label: 'Permissões', adminOnly: true },
      { to: '/auditoria', icon: FileClock, label: 'Auditoria', adminOnly: true },
    ],
  },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const activeGroup = navGroups.find(group => group.items.some(item => pathname.startsWith(item.to)))?.label
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => activeGroup ? { [activeGroup]: true } : {})

  useEffect(() => {
    if (activeGroup) setOpenGroups(current => ({ ...current, [activeGroup]: true }))
  }, [activeGroup])

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="border-b p-6">
        <h1 className="text-xl font-bold text-primary">Contabil Core</h1>
        <p className="mt-1 truncate text-sm font-medium">{user?.nome}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-3">
        {navGroups.map(group => {
          const items = group.items.filter(({ adminOnly }) => !adminOnly || user?.role === 'admin')
          const isOpen = !!openGroups[group.label]

          return (
            <section key={group.label}>
              <button
                type="button"
                onClick={() => setOpenGroups(current => ({ ...current, [group.label]: !isOpen }))}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-expanded={isOpen}
              >
                {group.label}
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div className="mt-1 space-y-1">
                  {items.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) => cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </NavLink>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </nav>

      <div className="border-t p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
