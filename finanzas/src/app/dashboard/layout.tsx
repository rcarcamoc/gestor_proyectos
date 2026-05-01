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
    <div className="min-h-screen bg-[#FDFCFB]">
      {/* Sidebar Desktop */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-stone-200 bg-white">
          <div className="flex flex-1 flex-col overflow-y-auto pt-8 pb-4">
            <div className="flex items-center px-6 mb-10">
              <div className="h-8 w-8 rounded-lg bg-stone-800 flex items-center justify-center">
                <span className="text-white font-serif text-xl">Z</span>
              </div>
              <span className="ml-3 text-xl font-serif tracking-tight text-stone-800">Zen Finanzas</span>
            </div>
            <nav className="mt-5 flex-1 space-y-1 px-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      isActive
                        ? 'bg-stone-50 text-stone-900'
                        : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900',
                      'group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-stone-800' : 'text-stone-400 group-hover:text-stone-800',
                        'mr-3 h-5 w-5 flex-shrink-0'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex flex-shrink-0 border-t border-stone-100 p-4">
            <button
              onClick={() => signOut()}
              className="group block w-full flex-shrink-0"
            >
              <div className="flex items-center px-4 py-3 text-sm font-medium text-stone-500 rounded-xl hover:bg-stone-50 hover:text-red-600 transition-all">
                <LogOut className="mr-3 h-5 w-5 text-stone-400 group-hover:text-red-500" />
                Cerrar Sesión
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white border-b border-stone-200 md:hidden">
        <button
          type="button"
          className="px-4 text-stone-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-stone-500 md:hidden"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex flex-1 justify-center items-center">
            <span className="text-xl font-serif text-stone-800">Zen Finanzas</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col md:pl-64">
        <main className="flex-1 py-8 px-4 sm:px-6 md:px-8">
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
