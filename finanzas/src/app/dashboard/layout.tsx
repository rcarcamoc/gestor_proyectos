'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  Users, 
  Scale, 
  FileUp, 
  LogOut,
  Menu,
  X,
  TrendingUp,
  Tags,
  Brain,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ScopeProvider, useScope } from '@/components/ScopeProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navigation = [
  { name: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transacciones', href: '/dashboard/transactions', icon: Receipt },
  { name: 'Presupuestos', href: '/dashboard/budgets', icon: TrendingUp },
  { name: 'Cuentas', href: '/dashboard/accounts', icon: Wallet },
  { name: 'Mi Hogar', href: '/dashboard/households', icon: Users },
  { name: 'Distribución', href: '/dashboard/distribution', icon: Scale },
  { name: 'Categorías', href: '/dashboard/categories', icon: Tags },
  { name: 'Clasificar IA', href: '/dashboard/classify', icon: Brain },
  { name: 'Importar', href: '/dashboard/import', icon: FileUp },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScopeProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ScopeProvider>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { selectedScope, setSelectedScope } = useScope();
  const [households, setHouseholds] = useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('zen_sidebar_collapsed');
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('zen_sidebar_collapsed', String(nextState));
  };

  useEffect(() => {
    fetch('/finanzas/api/households')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHouseholds(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center zen-bg">
        <Loader2 className="h-8 w-8 animate-spin text-stone-300" />
      </div>
    );
  }

  if (!session) return null;

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/';
    return pathname.startsWith(href);
  };

  return (
    <div className="zen-bg min-h-screen">
      {/* ── Desktop Sidebar ── */}
      <aside className={cn(
        "hidden md:fixed md:inset-y-0 md:left-0 md:flex md:flex-col z-30 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}>
        <div className="zen-sidebar flex flex-col h-full py-6 px-3">
          {/* Logo */}
          <div className={cn(
            "flex items-center justify-between px-4 mb-8",
            isCollapsed && "flex-col gap-4 px-2"
          )}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-950 flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="font-serif text-white text-lg leading-none">Z</span>
              </div>
              {!isCollapsed && (
                <div className="animate-in fade-in duration-300">
                  <p className="font-serif text-stone-900 font-semibold text-lg leading-tight">Zen</p>
                  <p className="text-stone-400 text-xs font-medium tracking-widest uppercase leading-none">Finanzas</p>
                </div>
              )}
            </div>
            <button 
              onClick={toggleCollapse} 
              className={cn(
                "p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors hidden md:block",
                isCollapsed && "mt-1"
              )}
              title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          
          <div className={cn("mb-6", isCollapsed ? "px-1" : "px-4")}>
            <Select value={selectedScope} onValueChange={(v) => v && setSelectedScope(v)}>
              <SelectTrigger className={cn(
                "w-full rounded-2xl border-stone-200 bg-white shadow-sm text-sm font-semibold text-stone-700 transition-all",
                isCollapsed ? "h-10 p-0 flex items-center justify-center" : "h-10"
              )}>
                {isCollapsed ? (
                  <span className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center text-xs uppercase font-bold">
                    {selectedScope === 'personal' ? 'P' : (households.find(h => h.id === selectedScope)?.name?.[0] || 'V')}
                  </span>
                ) : (
                  <SelectValue placeholder="Vista" />
                )}
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-stone-200 shadow-xl">
                  <SelectItem value="personal" className="rounded-xl">Personal</SelectItem>
                  {households.map(h => (
                  <SelectItem key={h.id} value={h.id} className="rounded-xl">{h.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    'nav-link group',
                    active && 'active',
                    isCollapsed && 'justify-center px-0'
                  )}
                >
                  <div className={cn(
                    'p-1.5 rounded-xl transition-colors flex-shrink-0',
                    active ? 'bg-stone-100 text-stone-700' : 'text-stone-400 group-hover:text-stone-600',
                    isCollapsed && 'mx-auto'
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  {!isCollapsed && (
                    <span className="animate-in fade-in duration-300">{item.name}</span>
                  )}
                  {active && !isCollapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-stone-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="mt-4 pt-4 border-t border-stone-200/50">
            <button
              onClick={() => signOut({ callbackUrl: '/finanzas/login' })}
              className={cn(
                "nav-link w-full text-left text-rose-400 hover:text-rose-600 hover:bg-rose-50 group",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? "Cerrar Sesión" : undefined}
            >
              <div className="p-1.5 rounded-xl text-rose-300 group-hover:text-rose-500 transition-colors flex-shrink-0">
                <LogOut className="h-4 w-4" />
              </div>
              {!isCollapsed && <span className="animate-in fade-in duration-300">Cerrar Sesión</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-white/80 backdrop-blur-md border-b border-stone-200/50 px-4 md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-xl text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 flex justify-center">
          <span className="font-serif text-stone-800 font-semibold text-lg">Zen Finanzas</span>
        </div>
        <div className="w-auto flex items-center">
            <Select value={selectedScope} onValueChange={(v) => v && setSelectedScope(v)}>
              <SelectTrigger className="w-[120px] rounded-full border-stone-200 bg-stone-50 shadow-sm h-8 text-[11px] font-semibold text-stone-600 focus:ring-0">
                  <SelectValue placeholder="Vista" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-stone-200 shadow-xl z-[100]">
                  <SelectItem value="personal" className="rounded-xl">Personal</SelectItem>
                  {households.map(h => (
                  <SelectItem key={h.id} value={h.id} className="rounded-xl">{h.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className={cn(
        "transition-all duration-300",
        isCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* ── Mobile Drawer ── */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col py-6 px-3">
            <div className="flex items-center justify-between px-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-stone-900 flex items-center justify-center">
                  <span className="font-serif text-white text-lg">Z</span>
                </div>
                <span className="font-serif text-stone-900 text-lg font-semibold">Zen Finanzas</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn('nav-link', active && 'active')}
                  >
                    <div className={cn(
                      'p-1.5 rounded-xl flex-shrink-0',
                      active ? 'bg-stone-100 text-stone-700' : 'text-stone-400'
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
