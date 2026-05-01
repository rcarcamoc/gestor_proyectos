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
  Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    const res = await fetch('/api/transactions');
    if (res.ok) setTransactions(await res.json());
    setLoading(false);
  };

  const filteredTransactions = transactions.filter(t => 
    t.description?.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-stone-800">Transacciones</h1>
          <p className="text-stone-500 mt-1">Historial completo de tus movimientos financieros.</p>
        </div>
        <div className="flex gap-2">
            <Button className="bg-stone-800 hover:bg-stone-900 rounded-xl px-6">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Registro
            </Button>
        </div>
      </div>

      <Card className="border-stone-200 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="border-b border-stone-50 bg-stone-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input 
                placeholder="Buscar por descripción o categoría..." 
                className="pl-10 bg-white border-stone-200 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl border-stone-200 text-stone-600">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-stone-50/50">
              <TableRow className="border-stone-100 hover:bg-transparent">
                <TableHead className="w-[120px] font-medium text-stone-500">Fecha</TableHead>
                <TableHead className="font-medium text-stone-500">Categoría</TableHead>
                <TableHead className="font-medium text-stone-500">Descripción</TableHead>
                <TableHead className="font-medium text-stone-500">Cuenta</TableHead>
                <TableHead className="text-right font-medium text-stone-500">Monto</TableHead>
                <TableHead className="text-center font-medium text-stone-500">Estado</TableHead>
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
                        No se encontraron transacciones.
                    </TableCell>
                </TableRow>
              ) : filteredTransactions.map((t) => {
                const Icon = ICON_MAP[t.category?.icon] || HelpCircle;
                const isExpense = t.type === 'EXPENSE';
                return (
                  <TableRow key={t.id} className="border-stone-50 hover:bg-stone-50/30 transition-colors group">
                    <TableCell className="text-stone-500 text-sm">
                      {new Date(t.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div 
                          className="p-2 rounded-lg mr-3 group-hover:scale-110 transition-transform" 
                          style={{ backgroundColor: `\${t.category?.color}15`, color: t.category?.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-stone-700 text-sm">{t.category?.name || 'Sin categoría'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-stone-600 font-medium">
                      {t.description || '-'}
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="font-normal text-stone-500 border-stone-100 bg-white">
                            {t.account.name}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "font-semibold text-base",
                          isExpense ? "text-stone-900" : "text-green-600"
                        )}>
                          {isExpense ? '-' : '+'}{formatCurrency(Number(t.amount))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                        {t.status === 'PENDING_REVIEW' ? (
                            <Badge className="bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100 font-medium rounded-full px-3">
                                <Clock className="h-3 w-3 mr-1" />
                                Revisar
                            </Badge>
                        ) : (
                            <Badge className="bg-stone-100 text-stone-500 border-transparent font-medium rounded-full px-3">
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
