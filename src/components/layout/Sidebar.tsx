import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Zap, Scale, BookOpen, Settings, LogOut, Receipt, Users, ClipboardCheck, ShieldCheck, CreditCard, Wifi, TrendingUp, PiggyBank } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', adminOnly: false },
  { to: '/extrato', icon: FileText, label: 'Extrato Bancário', adminOnly: false },
  { to: '/neo', icon: Zap, label: 'NEO', adminOnly: false },
  { to: '/concilpro', icon: Scale, label: 'CONCILPRO', adminOnly: false },
  { to: '/registros', icon: BookOpen, label: 'Registros', adminOnly: false },
  { to: '/notas', icon: Receipt, label: 'Notas Fiscais', adminOnly: false },
  { to: '/comprovantes', icon: ClipboardCheck, label: 'Comprovantes', adminOnly: false },
  { to: '/cartoes', icon: CreditCard, label: 'Cartão de Crédito', adminOnly: false },
  { to: '/aplicacoes-financeiras', icon: PiggyBank, label: 'Aplicações Financeiras', adminOnly: false },
  { to: '/openbanking', icon: Wifi, label: 'Open Banking', adminOnly: false },
  { to: '/relatorios', icon: TrendingUp, label: 'Relatórios', adminOnly: false },
  { to: '/configuracoes', icon: Settings, label: 'Configurações', adminOnly: false },
  { to: '/usuarios', icon: Users, label: 'Usuários', adminOnly: true },
  { to: '/permissoes', icon: ShieldCheck, label: 'Permissões', adminOnly: true },
]

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      {/* Brand */}
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary">Contabil Core</h1>
        <p className="text-sm font-medium mt-1 truncate">{user?.nome}</p>
        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter(({ adminOnly }) => !adminOnly || user?.role === 'admin')
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
