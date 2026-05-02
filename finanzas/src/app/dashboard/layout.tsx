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
  Loader2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col z-30">
        <div className="zen-sidebar flex flex-col h-full py-6 px-3">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 mb-8">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-950 flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="font-serif text-white text-lg leading-none">Z</span>
            </div>
            <div>
              <p className="font-serif text-stone-900 font-semibold text-lg leading-tight">Zen</p>
              <p className="text-stone-400 text-xs font-medium tracking-widest uppercase leading-none">Finanzas</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'nav-link group',
                    active && 'active'
                  )}
                >
                  <div className={cn(
                    'p-1.5 rounded-xl transition-colors flex-shrink-0',
                    active ? 'bg-stone-100 text-stone-700' : 'text-stone-400 group-hover:text-stone-600'
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span>{item.name}</span>
                  {active && (
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
              className="nav-link w-full text-left text-rose-400 hover:text-rose-600 hover:bg-rose-50 group"
            >
              <div className="p-1.5 rounded-xl text-rose-300 group-hover:text-rose-500 transition-colors flex-shrink-0">
                <LogOut className="h-4 w-4" />
              </div>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className="sticky top-0 z-20 flex h-14 items-center bg-white/80 backdrop-blur-md border-b border-stone-200/50 px-4 md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-xl text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1 flex justify-center">
          <span className="font-serif text-stone-800 font-semibold text-lg">Zen Finanzas</span>
        </div>
        <div className="w-9" />
      </header>

      {/* ── Main Content ── */}
      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
