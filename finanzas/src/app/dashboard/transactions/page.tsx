'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Badge 
} from '@/components/ui/badge';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Search,
  Filter,
  Plus,
  Home,
  Zap,
  ShoppingBasket,
  Utensils,
  Car,
  HeartPulse,
  Ticket,
  CreditCard,
  ShieldCheck,
  PawPrint,
  Shirt,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ICON_MAP: Record<string, any> = {
  'home': Home,
  'zap': Zap,
  'shopping-basket': ShoppingBasket,
  'utensils': Utensils,
  'car': Car,
  'heart-pulse': HeartPulse,
  'ticket': Ticket,
  'credit-card': CreditCard,
  'shield-check': ShieldCheck,
  'paw-print': PawPrint,
  'shirt': Shirt,
  'help-circle': HelpCircle,
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    const res = await fetch('/api/transactions');
    if (res.ok) {
        setTransactions(await res.json());
    } else {
        toast.error("No se pudieron cargar las transacciones");
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
        const res = await fetch(`/api/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            setTransactions(transactions.map(t => t.id === id ? { ...t, status } : t));
            toast.success(status === 'CONFIRMED' ? "Transacción confirmada" : "Estado actualizado");
        }
    } catch (err) {
        toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de descartar esta transacción?")) return;
    try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setTransactions(transactions.filter(t => t.id !== id));
            toast.success("Transacción eliminada");
        }
    } catch (err) {
        toast.error("Error al eliminar");
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase()) ||
                         t.category?.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || t.status === 'PENDING_REVIEW';
    return matchesSearch && matchesTab;
  });

  const pendingCount = transactions.filter(t => t.status === 'PENDING_REVIEW').length;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Transacciones</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Historial completo de tus movimientos financieros.</p>
        </div>
        <div className="flex gap-2">
            <Button 
                className="bg-stone-800 hover:bg-stone-900 rounded-full px-6 shadow-sm hover:shadow-md transition-all duration-300"
                onClick={() => toast.info("Funcionalidad de nuevo registro próximamente")}
            >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Registro
            </Button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-stone-200/60">
          <button 
            onClick={() => setActiveTab('all')}
            className={cn(
                "pb-4 px-1 text-sm font-semibold transition-colors relative",
                activeTab === 'all' ? "text-stone-800" : "text-stone-400 hover:text-stone-600"
            )}
          >
              Todas
              {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-stone-800 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={cn(
                "pb-4 px-1 text-sm font-semibold transition-colors relative flex items-center",
                activeTab === 'pending' ? "text-amber-600" : "text-stone-400 hover:text-stone-600"
            )}
          >
              Por Revisar
              {pendingCount > 0 && (
                  <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {pendingCount}
                  </span>
              )}
              {activeTab === 'pending' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500 rounded-t-full" />}
          </button>
      </div>

      <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden hover:shadow-md transition-shadow duration-300">
        <CardHeader className="border-b border-stone-100/60 bg-stone-50/50 py-4 px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input 
                placeholder="Buscar por descripción o categoría..." 
                className="pl-10 bg-white border-stone-200/60 rounded-full h-10 shadow-sm focus-visible:ring-stone-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="rounded-full border-stone-200/60 text-stone-600 hover:bg-stone-50">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-stone-50/30">
              <TableRow className="border-stone-100/60 hover:bg-transparent">
                <TableHead className="w-[120px] font-semibold text-xs uppercase tracking-wider text-stone-500 py-4 pl-6">Fecha</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Categoría</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Descripción</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Cuenta</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Monto</TableHead>
                <TableHead className="text-center font-semibold text-xs uppercase tracking-wider text-stone-500 py-4 pr-6">Estado / Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="h-16 bg-stone-50/50" />
                  </TableRow>
                ))
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center text-stone-400">
                        {activeTab === 'pending' ? 'No hay transacciones pendientes de revisión.' : 'No se encontraron transacciones.'}
                    </TableCell>
                </TableRow>
              ) : filteredTransactions.map((t) => {
                const Icon = ICON_MAP[t.category?.icon] || HelpCircle;
                const isExpense = t.type === 'EXPENSE';
                const isPending = t.status === 'PENDING_REVIEW';
                
                return (
                  <TableRow key={t.id} className={cn(
                    "border-stone-100/60 hover:bg-stone-50/50 transition-colors group",
                    isPending && "bg-amber-50/20 hover:bg-amber-50/40"
                  )}>
                    <TableCell className="text-stone-500 text-sm pl-6 py-4">
                      {new Date(t.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center">
                        <div 
                          className="p-2.5 rounded-xl mr-3 group-hover:scale-110 transition-transform shadow-sm" 
                          style={{ backgroundColor: `${t.category?.color || '#ccc'}15`, color: t.category?.color || '#999' }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-stone-800 text-sm">{t.category?.name || 'Sin categoría'}</span>
                        {t.metadata && (t.metadata as any).ai_suggested && (
                          <div className="ml-2 flex items-center bg-purple-50 text-purple-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-purple-100 shadow-sm" title="Sugerido por IA">
                            <Sparkles className="h-3 w-3 mr-1" />
                            IA
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-stone-600 font-medium py-4 max-w-[200px] truncate">
                      {t.description || '-'}
                    </TableCell>
                    <TableCell className="py-4">
                        <Badge variant="outline" className="font-medium text-stone-500 border-stone-200/60 bg-stone-50 rounded-lg">
                            {t.account?.name}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "font-bold text-base font-serif tracking-tight",
                          isExpense ? "text-stone-900" : "text-emerald-600"
                        )}>
                          {isExpense ? '-' : '+'}{formatCurrency(Number(t.amount))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4 pr-6">
                        {isPending ? (
                            <div className="flex items-center justify-center gap-2">
                                <Button 
                                    size="sm" 
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700 rounded-full text-xs font-semibold shadow-sm transition-all hover:shadow"
                                    onClick={() => handleUpdateStatus(t.id, 'CONFIRMED')}
                                >
                                    Confirmar
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-full text-xs font-semibold transition-all"
                                    onClick={() => handleDelete(t.id)}
                                >
                                    Descartar
                                </Button>
                            </div>
                        ) : (
                            <Badge className="bg-stone-100 text-stone-500 border-transparent font-medium rounded-full px-3 shadow-sm hover:bg-stone-200 transition-colors cursor-default">
                                Confirmado
                            </Badge>
                        )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
