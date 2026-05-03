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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
  Sparkles,
  Loader2,
  Trash2,
  EyeOff,
  Eye,
  UserCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getMonthOptions, formatBillingPeriod } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'ignored'>('all');
  const [showIgnored, setShowIgnored] = useState(false);
  const [households, setHouseholds] = useState<any[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTx, setNewTx] = useState({
    amount: '',
    description: '',
    categoryId: '',
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    billingPeriod: formatBillingPeriod(new Date()),
    type: 'EXPENSE'
  });
  const [isDeletePeriodOpen, setIsDeletePeriodOpen] = useState(false);
  const [deletePeriod, setDeletePeriod] = useState(formatBillingPeriod(new Date()));
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchTransactions();
    fetchMetadata();
  }, [showIgnored]);

  const fetchMetadata = async () => {
    try {
        const [accRes, catRes, hhRes] = await Promise.all([
            fetch('/finanzas/api/accounts?all=true'),
            fetch('/finanzas/api/categories'),
            fetch('/finanzas/api/households')
        ]);
        if (accRes.ok) setAccounts(await accRes.json());
        if (catRes.ok) setCategories(await catRes.json());
        if (hhRes.ok) setHouseholds(await hhRes.json());
    } catch (err) {
        console.error(err);
    }
  };

  const handleAddTransaction = async () => {
    if (!newTx.amount || !newTx.accountId) return toast.error("Monto y cuenta son obligatorios");
    setLoading(true);
    try {
        const res = await fetch('/finanzas/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...newTx,
                amount: Math.abs(parseFloat(newTx.amount))
            })
        });
        if (res.ok) {
            toast.success("Transacción registrada");
            setIsAddModalOpen(false);
            setNewTx({
              amount: '',
              description: '',
              categoryId: '',
              accountId: '',
              date: new Date().toISOString().split('T')[0],
              billingPeriod: formatBillingPeriod(new Date()),
              type: 'EXPENSE'
            });
            fetchTransactions();
        } else {
            toast.error("Error al registrar");
        }
    } catch (err) {
        toast.error("Error de conexión");
    } finally {
        setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    const url = showIgnored
      ? '/finanzas/api/transactions?includeIgnored=true'
      : '/finanzas/api/transactions';
    const res = await fetch(url);
    if (res.ok) {
        setTransactions(await res.json());
    } else {
        toast.error("No se pudieron cargar las transacciones");
    }
    setLoading(false);
  };

  const handleIgnore = async (id: string, ignored: boolean) => {
    const res = await fetch(`/finanzas/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignored })
    });
    if (res.ok) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ignored } : t));
      toast.success(ignored ? 'Movimiento ignorado' : 'Movimiento restaurado');
    } else {
      toast.error('Error al actualizar');
    }
  };

  const handleSetScope = async (id: string, scope: string, userId_internal?: string) => {
    const res = await fetch(`/finanzas/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, ...(userId_internal ? { userId_internal } : {}) })
    });
    if (res.ok) {
      const updated = await res.json();
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, scope: updated.scope, userId_internal: updated.userId_internal } : t));
      toast.success('Imputación actualizada');
    } else {
      toast.error('Error al actualizar');
    }
  };

  // Get all household members (flattened)
  const allHouseholdMembers = households.flatMap((hh: any) =>
    (hh.users || []).map((u: any) => ({ ...u.user, householdId: hh.id, householdName: hh.name }))
  );

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
  
  const handleDeletePeriod = async () => {
    if (!confirm(`¿Estás COMPLETAMENTE seguro de borrar TODAS las transacciones del periodo ${deletePeriod}? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    try {
        const res = await fetch(`/finanzas/api/transactions?billingPeriod=${encodeURIComponent(deletePeriod)}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            const data = await res.json();
            toast.success(`Se eliminaron ${data.count} transacciones`);
            setIsDeletePeriodOpen(false);
            fetchTransactions();
        } else {
            toast.error("Error al borrar el periodo");
        }
    } catch (err) {
        toast.error("Error de conexión");
    } finally {
        setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(search.toLowerCase()) ||
                         t.category?.name.toLowerCase().includes(search.toLowerCase());
    if (activeTab === 'pending') return matchesSearch && t.status === 'PENDING_REVIEW' && !t.ignored;
    if (activeTab === 'ignored') return matchesSearch && t.ignored;
    return matchesSearch && !t.ignored;
  });

  const pendingCount = transactions.filter(t => t.status === 'PENDING_REVIEW' && !t.ignored).length;
  const ignoredCount = transactions.filter(t => t.ignored).length;

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
                onClick={() => setIsAddModalOpen(true)}
            >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Registro
            </Button>
            <Button 
                variant="outline"
                className="rounded-full px-6 border-rose-200 text-rose-600 hover:bg-rose-50 transition-all duration-300"
                onClick={() => setIsDeletePeriodOpen(true)}
            >
                <Trash2 className="h-4 w-4 mr-2" />
                Borrar Periodo
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
          <button 
            onClick={() => { setShowIgnored(true); setActiveTab('ignored'); }}
            className={cn(
                "pb-4 px-1 text-sm font-semibold transition-colors relative flex items-center",
                activeTab === 'ignored' ? "text-stone-400" : "text-stone-300 hover:text-stone-500"
            )}
          >
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              Ignoradas
              {ignoredCount > 0 && (
                  <span className="ml-2 bg-stone-100 text-stone-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {ignoredCount}
                  </span>
              )}
              {activeTab === 'ignored' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-stone-400 rounded-t-full" />}
          </button>
          {activeTab !== 'ignored' && (
            <button onClick={() => { setShowIgnored(false); setActiveTab('all'); }} className="ml-auto pb-4 px-1 text-[11px] text-stone-300 hover:text-stone-500 transition-colors" />
          )}
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
                <TableHead className="text-stone-400 font-bold text-[10px] uppercase tracking-widest py-4">Monto</TableHead>
                <TableHead className="text-stone-400 font-bold text-[10px] uppercase tracking-widest py-4">Periodo</TableHead>
                <TableHead className="text-stone-400 font-bold text-[10px] uppercase tracking-widest py-4">Estado / Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={7} className="h-16 bg-stone-50/50" />
                  </TableRow>
                ))
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center text-stone-400">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <div 
                          className="p-2.5 rounded-xl group-hover:scale-110 transition-transform shadow-sm flex-shrink-0" 
                          style={{ backgroundColor: `${t.category?.color || '#ccc'}15`, color: t.category?.color || '#999' }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-stone-800 text-sm">{t.category?.name || 'Sin categoría'}</span>
                            {t.categorySource === 'keyword' && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full" title="Clasificado por reglas de palabras clave">
                                <Zap className="h-2.5 w-2.5" />Regla
                              </span>
                            )}
                            {t.categorySource === 'ml' && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full" title={`ML Naive Bayes · Confianza: ${t.aiConfidence ? Math.round(t.aiConfidence * 100) : '?'}%`}>
                                <Sparkles className="h-2.5 w-2.5" />ML {t.aiConfidence ? `${Math.round(t.aiConfidence * 100)}%` : ''}
                              </span>
                            )}
                            {t.categorySource === 'groq' && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full" title="Clasificado por Groq LLM">
                                <Sparkles className="h-2.5 w-2.5" />IA
                              </span>
                            )}
                            {t.categorySource === 'needs_review' && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-full" title="Necesita tu revisión">
                                <HelpCircle className="h-2.5 w-2.5" />Revisar
                              </span>
                            )}
                          </div>
                        </div>
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
                    <TableCell className="py-4 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Scope selector for household transactions */}
                          {t.householdId && allHouseholdMembers.length > 0 && (
                            <Select
                              value={t.scope === 'PERSONAL' ? t.userId_internal : 'HOUSEHOLD'}
                              onValueChange={(val) => {
                                if (val === 'HOUSEHOLD') handleSetScope(t.id, 'HOUSEHOLD');
                                else handleSetScope(t.id, 'PERSONAL', val);
                              }}
                            >
                              <SelectTrigger className="h-7 w-auto min-w-[110px] rounded-full border-stone-200 text-[11px] font-semibold bg-stone-50 px-3 gap-1">
                                <UserCheck className="h-3 w-3 text-stone-400" />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="HOUSEHOLD">
                                  <span className="flex items-center gap-1.5">🏠 Compartido</span>
                                </SelectItem>
                                {allHouseholdMembers.map((m: any) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <span className="flex items-center gap-1.5">👤 {m.name || m.email}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {/* Ignore/restore button */}
                          {t.ignored ? (
                            <Button size="sm" variant="ghost"
                              className="h-7 rounded-full text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all px-2"
                              title="Restaurar movimiento"
                              onClick={() => handleIgnore(t.id, false)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost"
                              className="h-7 rounded-full text-stone-300 hover:text-stone-500 hover:bg-stone-100 transition-all px-2 opacity-0 group-hover:opacity-100"
                              title="Ignorar movimiento"
                              onClick={() => handleIgnore(t.id, true)}>
                              <EyeOff className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* Status badge/actions */}
                          {isPending ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm"
                                className="h-7 bg-emerald-600 hover:bg-emerald-700 rounded-full text-[11px] font-semibold px-3"
                                onClick={() => handleUpdateStatus(t.id, 'CONFIRMED')}>
                                Confirmar
                              </Button>
                              <Button size="sm" variant="ghost"
                                className="h-7 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-full text-[11px] font-semibold px-2"
                                onClick={() => handleDelete(t.id)}>
                                Descartar
                              </Button>
                            </div>
                          ) : !t.ignored && (
                            <Badge className="bg-stone-100 text-stone-500 border-transparent font-medium rounded-full px-3 text-[11px]">
                              Confirmado
                            </Badge>
                          )}
                          {t.ignored && (
                            <Badge className="bg-stone-100 text-stone-400 border-transparent font-medium rounded-full px-3 text-[11px] line-through">
                              Ignorado
                            </Badge>
                          )}
                        </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[2rem] border-stone-100 shadow-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-stone-800">Nuevo Registro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newTx.type} onValueChange={(v) => setNewTx({...newTx, type: v || 'EXPENSE'})}>
                        <SelectTrigger className="rounded-xl border-stone-200">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="EXPENSE">Gasto</SelectItem>
                            <SelectItem value="INCOME">Ingreso</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input 
                        type="number" 
                        placeholder="0" 
                        className="rounded-xl border-stone-200"
                        value={newTx.amount}
                        onChange={(e) => setNewTx({...newTx, amount: e.target.value})}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Descripción</Label>
                <Input 
                    placeholder="Ej: Supermercado" 
                    className="rounded-xl border-stone-200"
                    value={newTx.description}
                    onChange={(e) => setNewTx({...newTx, description: e.target.value})}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={newTx.categoryId} onValueChange={(v) => setNewTx({...newTx, categoryId: v || ''})}>
                        <SelectTrigger className="rounded-xl border-stone-200">
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {categories.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Cuenta</Label>
                    <Select value={newTx.accountId} onValueChange={(v) => setNewTx({...newTx, accountId: v || ''})}>
                        <SelectTrigger className="rounded-xl border-stone-200">
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {accounts.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input 
                        type="date" 
                        className="rounded-xl border-stone-200"
                        value={newTx.date}
                        onChange={(e) => setNewTx({...newTx, date: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Periodo de Facturación</Label>
                    <Select value={newTx.billingPeriod} onValueChange={(v) => v && setNewTx({...newTx, billingPeriod: v})}>
                        <SelectTrigger className="rounded-xl border-stone-200">
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {getMonthOptions().map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
            <Button className="bg-stone-800 hover:bg-stone-900 rounded-full px-8" onClick={handleAddTransaction} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeletePeriodOpen} onOpenChange={setIsDeletePeriodOpen}>
        <DialogContent className="rounded-[2rem] border-rose-100 shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-stone-800">Borrar Periodo</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <p className="text-sm text-stone-500 font-medium">
                Selecciona el periodo que deseas eliminar. Se borrarán todas las transacciones asociadas a este mes.
            </p>
            <div className="space-y-2">
                <Label>Periodo de Facturación</Label>
                <Select value={deletePeriod} onValueChange={(v) => v && setDeletePeriod(v)}>
                    <SelectTrigger className="rounded-xl border-stone-200 h-12">
                        <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {getMonthOptions().map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" className="rounded-full order-2 sm:order-1" onClick={() => setIsDeletePeriodOpen(false)}>Cancelar</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 rounded-full px-8 order-1 sm:order-2" onClick={handleDeletePeriod} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Eliminar Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
