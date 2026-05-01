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
  X
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

const navigation = [
  { name: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transacciones', href: '/dashboard/transactions', icon: Receipt },
  { name: 'Cuentas', href: '/dashboard/accounts', icon: Wallet },
  { name: 'Mi Hogar', href: '/dashboard/households', icon: Users },
  { name: 'Distribución', href: '/dashboard/distribution', icon: Scale },
  { name: 'Importar', href: '/dashboard/import', icon: FileUp },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-stone-800 selection:bg-stone-200">
      {/* Sidebar Desktop */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-72 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-stone-200/50 bg-white/70 backdrop-blur-xl">
          <div className="flex flex-1 flex-col overflow-y-auto pt-8 pb-4">
            <div className="flex items-center px-8 mb-10">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 shadow-inner flex items-center justify-center transform transition-transform hover:scale-105">
                <span className="text-stone-50 font-serif text-xl tracking-widest">Z</span>
              </div>
              <span className="ml-3.5 text-2xl font-serif tracking-tight text-stone-800">Zen Finanzas</span>
            </div>
            <nav className="mt-5 flex-1 space-y-1.5 px-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      isActive
                        ? 'bg-white shadow-sm ring-1 ring-stone-200/50 text-stone-900'
                        : 'text-stone-500 hover:bg-stone-50/80 hover:text-stone-900',
                      'group flex items-center px-4 py-3.5 text-sm font-medium rounded-2xl transition-all duration-300'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-stone-700' : 'text-stone-400 group-hover:text-stone-600',
                        'mr-3.5 h-5 w-5 flex-shrink-0 transition-colors'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex flex-shrink-0 p-4">
            <button
              onClick={() => signOut()}
              className="group block w-full flex-shrink-0"
            >
              <div className="flex items-center px-4 py-3.5 text-sm font-medium text-stone-500 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all duration-300">
                <LogOut className="mr-3.5 h-5 w-5 text-stone-400 group-hover:text-rose-500 transition-colors" />
                Cerrar Sesión
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="sticky top-0 z-20 flex h-16 flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-stone-200/50 md:hidden">
        <button
          type="button"
          className="px-4 text-stone-500 focus:outline-none md:hidden"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex flex-1 justify-center items-center">
            <span className="text-xl font-serif text-stone-800 tracking-tight">Zen Finanzas</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col md:pl-72">
        <main className="flex-1 py-10 px-4 sm:px-6 md:px-10">
          {children}
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-stone-600 bg-opacity-75 transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white pt-5 pb-4">
            <div className="flex items-center justify-between px-6 mb-8">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-lg bg-stone-800 flex items-center justify-center">
                    <span className="text-white font-serif text-xl">Z</span>
                </div>
                <span className="ml-3 text-xl font-serif text-stone-800">Zen Finanzas</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-6 w-6 text-stone-500" />
              </button>
            </div>
            <nav className="mt-5 flex-1 space-y-1 px-4">
                {navigation.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                            pathname === item.href ? 'bg-stone-50 text-stone-900' : 'text-stone-500',
                            'group flex items-center px-4 py-4 text-base font-medium rounded-xl'
                        )}
                    >
                        <item.icon className="mr-4 h-6 w-6 text-stone-400" />
                        {item.name}
                    </Link>
                ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
