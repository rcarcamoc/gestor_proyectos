'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useScope } from '@/components/ScopeProvider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
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
  DialogDescription,
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Loader2, 
  HelpCircle, 
  FileText,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { getMonthOptions, formatBillingPeriod } from "@/lib/utils";

export default function DebtsPage() {
  const { data: session } = useSession();
  const { selectedScope } = useScope();
  
  const [debts, setDebts] = useState<any[]>([]);
  const [households, setHouseholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<any>(null);
  
  // Form State
  const [form, setForm] = useState({
    debtorType: 'registered', // 'registered' | 'dummy'
    debtorId: '',
    debtorName: '',
    creditorType: 'registered', // 'registered' | 'dummy'
    creditorId: '',
    creditorName: '',
    amount: '',
    reason: '',
    billingPeriod: formatBillingPeriod(new Date()),
    dueDate: '',
    notes: '',
  });

  const currentUser = session?.user as any;

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (selectedScope && selectedScope !== 'personal') {
      fetchDebts();
    } else {
      setDebts([]);
      setLoading(false);
    }
  }, [selectedScope]);

  const fetchMetadata = async () => {
    try {
      const res = await fetch('/finanzas/api/households');
      if (res.ok) setHouseholds(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/finanzas/api/debts?householdId=${selectedScope}`);
      if (res.ok) {
        setDebts(await res.json());
      } else {
        toast.error("Error al cargar deudas");
      }
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const currentHousehold = households.find((h: any) => h.id === selectedScope);
  const members = currentHousehold?.users?.map((u: any) => u.user) || [];

  const handleOpenAdd = () => {
    setEditingDebt(null);
    setForm({
      debtorType: 'registered',
      debtorId: members[0]?.id || '',
      debtorName: members[0]?.name || members[0]?.email || '',
      creditorType: 'registered',
      creditorId: currentUser?.id || members[1]?.id || '',
      creditorName: currentUser?.name || currentUser?.email || members[1]?.name || '',
      amount: '',
      reason: '',
      billingPeriod: formatBillingPeriod(new Date()),
      dueDate: '',
      notes: '',
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (debt: any) => {
    setEditingDebt(debt);
    setForm({
      debtorType: debt.debtorId ? 'registered' : 'dummy',
      debtorId: debt.debtorId || '',
      debtorName: debt.debtorName,
      creditorType: debt.creditorId ? 'registered' : 'dummy',
      creditorId: debt.creditorId || '',
      creditorName: debt.creditorName,
      amount: String(debt.amount),
      reason: debt.reason,
      billingPeriod: debt.billingPeriod || formatBillingPeriod(new Date()),
      dueDate: debt.dueDate ? new Date(debt.dueDate).toISOString().split('T')[0] : '',
      notes: debt.notes || '',
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      return toast.error("Por favor ingresa un monto válido");
    }
    if (!form.reason.trim()) {
      return toast.error("El motivo de la deuda es obligatorio");
    }

    const finalDebtorName = form.debtorType === 'registered'
      ? (members.find((m: any) => m.id === form.debtorId)?.name || members.find((m: any) => m.id === form.debtorId)?.email || '')
      : form.debtorName.trim();

    const finalCreditorName = form.creditorType === 'registered'
      ? (members.find((m: any) => m.id === form.creditorId)?.name || members.find((m: any) => m.id === form.creditorId)?.email || '')
      : form.creditorName.trim();

    if (!finalDebtorName) return toast.error("El nombre del deudor es obligatorio");
    if (!finalCreditorName) return toast.error("El nombre del acreedor es obligatorio");
    if (form.debtorType === 'registered' && form.creditorType === 'registered' && form.debtorId === form.creditorId) {
      return toast.error("El deudor y acreedor no pueden ser la misma persona");
    }

    setSaving(true);
    try {
      const res = await fetch('/finanzas/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDebt?.id,
          householdId: selectedScope,
          debtorId: form.debtorType === 'registered' ? form.debtorId : null,
          debtorName: finalDebtorName,
          creditorId: form.creditorType === 'registered' ? form.creditorId : null,
          creditorName: finalCreditorName,
          amount: parseFloat(form.amount),
          reason: form.reason.trim(),
          billingPeriod: form.billingPeriod,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
          notes: form.notes.trim(),
          status: editingDebt?.status || 'PENDIENTE'
        })
      });

      if (res.ok) {
        toast.success(editingDebt ? "Deuda actualizada" : "Deuda creada exitosamente");
        setIsOpen(false);
        fetchDebts();
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al guardar la deuda");
      }
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (debt: any, newStatus: string) => {
    try {
      const res = await fetch('/finanzas/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: debt.id,
          householdId: selectedScope,
          debtorId: debt.debtorId,
          debtorName: debt.debtorName,
          creditorId: debt.creditorId,
          creditorName: debt.creditorName,
          amount: Number(debt.amount),
          reason: debt.reason,
          billingPeriod: debt.billingPeriod,
          dueDate: debt.dueDate,
          notes: debt.notes,
          status: newStatus
        })
      });

      if (res.ok) {
        setDebts(prev => prev.map(d => d.id === debt.id ? { ...d, status: newStatus } : d));
        toast.success(`Deuda marcada como ${newStatus.toLowerCase()}`);
      } else {
        toast.error("Error al actualizar estado");
      }
    } catch (err) {
      toast.error("Error de conexión");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar permanentemente esta deuda?")) return;
    try {
      const res = await fetch(`/finanzas/api/debts?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDebts(prev => prev.filter(d => d.id !== id));
        toast.success("Deuda eliminada");
      } else {
        toast.error("Error al eliminar deuda");
      }
    } catch (err) {
      toast.error("Error de conexión");
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

  // Filter & KPI calculations
  const filteredDebts = debts.filter(d => {
    if (filterStatus === 'ALL') return true;
    return d.status === filterStatus;
  });

  const activeDebts = debts.filter(d => d.status === 'PENDIENTE');

  // KPI Calculations relative to Current Logged In User
  const owedToMe = activeDebts
    .filter(d => d.creditorId === currentUser?.id || (d.creditorName.toLowerCase() === (currentUser?.name || '').toLowerCase() && !d.creditorId))
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const iOwe = activeDebts
    .filter(d => d.debtorId === currentUser?.id || (d.debtorName.toLowerCase() === (currentUser?.name || '').toLowerCase() && !d.debtorId))
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalHouseholdDebt = activeDebts.reduce((sum, d) => sum + Number(d.amount), 0);
  const netBalance = owedToMe - iOwe;

  if (selectedScope === 'personal') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Cuentas por Cobrar y Deudas</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Lleva el control de saldos y cuentas pendientes en tu hogar.</p>
        </div>
        <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white/70 backdrop-blur-md">
          <CardContent className="py-24 text-center">
            <Coins className="h-16 w-16 text-stone-300 mx-auto mb-6" />
            <p className="text-stone-500 font-medium">Selecciona un hogar en el menú superior para ver y gestionar las deudas compartidas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Deudas y Saldos</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Registro de deudas y cuentas por cobrar de {currentHousehold?.name}.</p>
        </div>
        <Button 
          className="bg-stone-800 hover:bg-stone-900 rounded-full px-6 shadow-sm hover:shadow-md transition-all duration-300"
          onClick={handleOpenAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva Deuda
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-stone-100/50 shadow-sm rounded-2xl bg-white p-5 hover:shadow-md transition-all duration-300">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">A ti te deben</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-500">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="font-serif text-2xl text-emerald-600 font-bold tracking-tight">{formatCurrency(owedToMe)}</p>
            <p className="text-stone-400 text-xs mt-1">Saldos pendientes a tu favor</p>
          </CardContent>
        </Card>

        <Card className="border-stone-100/50 shadow-sm rounded-2xl bg-white p-5 hover:shadow-md transition-all duration-300">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Tú debes</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-500">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="font-serif text-2xl text-rose-600 font-bold tracking-tight">{formatCurrency(iOwe)}</p>
            <p className="text-stone-400 text-xs mt-1">Tus compromisos pendientes</p>
          </CardContent>
        </Card>

        <Card className="border-stone-100/50 shadow-sm rounded-2xl bg-white p-5 hover:shadow-md transition-all duration-300">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Tu Balance Neto</span>
            <div className={`p-2 rounded-xl ${netBalance >= 0 ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500'}`}>
              <Coins className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className={`font-serif text-2xl font-bold tracking-tight ${netBalance >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>
              {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
            </p>
            <p className="text-stone-400 text-xs mt-1">Cálculo simplificado de tu estado</p>
          </CardContent>
        </Card>

        <Card className="border-stone-100/50 shadow-sm rounded-2xl bg-white p-5 hover:shadow-md transition-all duration-300">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Total del Hogar</span>
            <div className="p-2 rounded-xl bg-stone-100 text-stone-500">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="font-serif text-2xl text-stone-700 font-bold tracking-tight">{formatCurrency(totalHouseholdDebt)}</p>
            <p className="text-stone-400 text-xs mt-1">Suma global de deudas del hogar</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel */}
      <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden hover:shadow-md transition-shadow duration-300">
        <CardHeader className="border-b border-stone-100/60 bg-stone-50/50 py-5 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-serif text-stone-800">Listado de Cuentas</CardTitle>
            <CardDescription className="text-stone-500 font-medium">Deudas pendientes e historial de pagos.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val || 'ALL')}>
              <SelectTrigger className="w-[180px] rounded-xl border-stone-200 bg-white shadow-sm text-xs font-semibold">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="rounded-lg">Todos los estados</SelectItem>
                <SelectItem value="PENDIENTE" className="rounded-lg">Pendientes</SelectItem>
                <SelectItem value="COBRADO" className="rounded-lg">Cobrados</SelectItem>
                <SelectItem value="CANCELADO" className="rounded-lg">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-stone-300" />
            </div>
          ) : filteredDebts.length === 0 ? (
            <div className="py-24 text-center text-stone-400">
              <Coins className="h-12 w-12 text-stone-200 mx-auto mb-4" />
              <p className="text-sm font-medium italic">No se encontraron deudas registradas.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-stone-50/30">
                    <TableRow className="border-stone-100/60 hover:bg-transparent">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4 pl-6">Deudor</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Acreedor</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Monto</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Motivo / Descripción</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Periodo</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4">Estado</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-stone-500 py-4 w-[240px] text-right pr-6">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDebts.map((debt) => {
                      const isDebtorMe = debt.debtorId === currentUser?.id;
                      const isCreditorMe = debt.creditorId === currentUser?.id;
                      
                      return (
                        <TableRow key={debt.id} className="border-stone-100/60 hover:bg-stone-50/50 transition-colors group">
                          <TableCell className="pl-6 py-4 font-semibold text-stone-800 text-sm">
                            <div className="flex items-center gap-1.5">
                              {debt.debtorId ? <Badge variant="outline" className="bg-indigo-50/30 text-indigo-700 border-indigo-100 font-semibold px-2 py-0.5 text-[10px] rounded-lg">Real</Badge> : <Badge variant="outline" className="bg-stone-50 text-stone-500 font-medium px-2 py-0.5 text-[10px] rounded-lg">Ficticio</Badge>}
                              <span>{debt.debtorName}</span>
                              {isDebtorMe && <span className="text-[10px] text-stone-400 font-semibold">(Tú)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 font-semibold text-stone-800 text-sm">
                            <div className="flex items-center gap-1.5">
                              {debt.creditorId ? <Badge variant="outline" className="bg-indigo-50/30 text-indigo-700 border-indigo-100 font-semibold px-2 py-0.5 text-[10px] rounded-lg">Real</Badge> : <Badge variant="outline" className="bg-stone-50 text-stone-500 font-medium px-2 py-0.5 text-[10px] rounded-lg">Ficticio</Badge>}
                              <span>{debt.creditorName}</span>
                              {isCreditorMe && <span className="text-[10px] text-stone-400 font-semibold">(Tú)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="font-bold text-base font-serif tracking-tight text-stone-900">
                              {formatCurrency(Number(debt.amount))}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <div>
                              <p className="font-semibold text-stone-800 text-xs">{debt.reason}</p>
                              {debt.notes && <p className="text-[10px] text-stone-400 mt-0.5 max-w-xs truncate">{debt.notes}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-stone-500 text-xs font-semibold">
                            {debt.billingPeriod || '-'}
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge className={`border-transparent font-bold rounded-full px-2.5 py-0.5 text-[10px] ${
                              debt.status === 'PENDIENTE' 
                                ? 'bg-amber-100 text-amber-800' 
                                : debt.status === 'COBRADO' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-stone-100 text-stone-500'
                            }`}>
                              {debt.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              {debt.status === 'PENDIENTE' && (
                                <>
                                  <Button 
                                    size="sm"
                                    className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[10px] px-2.5 font-bold"
                                    onClick={() => handleUpdateStatus(debt, 'COBRADO')}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Cobrar
                                  </Button>
                                  <Button 
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-stone-200 text-stone-500 hover:bg-stone-100 rounded-full text-[10px] px-2.5"
                                    onClick={() => handleUpdateStatus(debt, 'CANCELADO')}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Cancelar
                                  </Button>
                                </>
                              )}
                              {debt.status !== 'PENDIENTE' && (
                                <Button 
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-full text-[10px] px-2.5 font-bold"
                                  onClick={() => handleUpdateStatus(debt, 'PENDIENTE')}
                                >
                                  Reabrir
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-7 rounded-full text-stone-300 hover:text-stone-600 hover:bg-stone-50 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                                onClick={() => handleOpenEdit(debt)}
                                title="Editar"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-7 rounded-full text-rose-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                                onClick={() => handleDelete(debt.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card Layout View */}
              <div className="block md:hidden p-4 space-y-4">
                {filteredDebts.map((debt) => {
                  const isDebtorMe = debt.debtorId === currentUser?.id;
                  const isCreditorMe = debt.creditorId === currentUser?.id;
                  
                  return (
                    <Card key={debt.id} className="border-stone-100 shadow-sm rounded-2xl bg-white p-4 space-y-3 relative hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className={`border-transparent font-bold rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                            debt.status === 'PENDIENTE' 
                              ? 'bg-amber-100 text-amber-800' 
                              : debt.status === 'COBRADO' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-stone-100 text-stone-500'
                          }`}>
                            {debt.status}
                          </span>
                          <p className="font-serif text-lg font-bold text-stone-900 mt-1">{formatCurrency(Number(debt.amount))}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-stone-400" onClick={() => handleOpenEdit(debt)}>
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-rose-400" onClick={() => handleDelete(debt.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-stone-50">
                        <div>
                          <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Deudor</span>
                          <p className="font-semibold text-stone-700 mt-0.5 truncate">{debt.debtorName} {isDebtorMe && '(Tú)'}</p>
                        </div>
                        <div>
                          <span className="text-stone-400 font-bold uppercase tracking-wider text-[9px]">Acreedor</span>
                          <p className="font-semibold text-stone-700 mt-0.5 truncate">{debt.creditorName} {isCreditorMe && '(Tú)'}</p>
                        </div>
                      </div>

                      <div className="text-xs space-y-1 pt-1">
                        <div className="flex items-center text-stone-600">
                          <AlertCircle className="h-3 w-3 mr-1.5 text-stone-400 shrink-0" />
                          <span className="font-medium truncate">{debt.reason}</span>
                        </div>
                        {debt.billingPeriod && (
                          <div className="flex items-center text-stone-400 text-[10px]">
                            <Calendar className="h-3 w-3 mr-1.5 shrink-0" />
                            <span>Periodo: {debt.billingPeriod}</span>
                          </div>
                        )}
                        {debt.notes && (
                          <p className="text-[10px] text-stone-400 italic bg-stone-50/50 p-2 rounded-xl border border-stone-100/50 mt-1">{debt.notes}</p>
                        )}
                      </div>

                      {/* Mobile Actions */}
                      {debt.status === 'PENDIENTE' ? (
                        <div className="flex gap-2 pt-2">
                          <Button 
                            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                            onClick={() => handleUpdateStatus(debt, 'COBRADO')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Marcar Cobrado
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 h-8 border-stone-200 text-stone-500 rounded-xl text-xs"
                            onClick={() => handleUpdateStatus(debt, 'CANCELADO')}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          variant="secondary"
                          className="w-full h-8 text-stone-600 rounded-xl text-xs font-semibold"
                          onClick={() => handleUpdateStatus(debt, 'PENDIENTE')}
                        >
                          Reabrir Deuda
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Debt Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-[2.5rem] border-stone-100 shadow-2xl max-w-lg bg-white overflow-hidden p-0">
          <DialogHeader className="bg-stone-50/60 border-b border-stone-100/60 p-6 pb-4">
            <DialogTitle className="font-serif text-2xl text-stone-800">
              {editingDebt ? 'Editar Deuda' : 'Nueva Deuda'}
            </DialogTitle>
            <DialogDescription className="text-stone-500 text-xs font-medium">
              Completa los datos para registrar la deuda. Soporta integrantes registrados y ficticios.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Debtor Selection */}
            <div className="space-y-3">
              <Label className="text-stone-600 font-bold uppercase tracking-wider text-[10px]">Deudor (¿Quién debe?)</Label>
              <div className="flex gap-3">
                <Select 
                  value={form.debtorType} 
                  onValueChange={(val: any) => setForm({ ...form, debtorType: val || 'registered', debtorId: val === 'registered' ? (members[0]?.id || '') : '' })}
                >
                  <SelectTrigger className="w-[140px] rounded-xl border-stone-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="registered">Integrante</SelectItem>
                    <SelectItem value="dummy">Ficticio</SelectItem>
                  </SelectContent>
                </Select>

                {form.debtorType === 'registered' ? (
                  <Select 
                    value={form.debtorId} 
                    onValueChange={(val: any) => setForm({ ...form, debtorId: val || '' })}
                  >
                    <SelectTrigger className="flex-1 rounded-xl border-stone-200">
                      <SelectValue placeholder="Seleccionar deudor..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {members.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    placeholder="Nombre del deudor ficticio..." 
                    className="flex-1 rounded-xl border-stone-200"
                    value={form.debtorName}
                    onChange={(e) => setForm({ ...form, debtorName: e.target.value })}
                  />
                )}
              </div>
            </div>

            {/* Creditor Selection */}
            <div className="space-y-3">
              <Label className="text-stone-600 font-bold uppercase tracking-wider text-[10px]">Acreedor (¿A quién se debe?)</Label>
              <div className="flex gap-3">
                <Select 
                  value={form.creditorType} 
                  onValueChange={(val: any) => setForm({ ...form, creditorType: val || 'registered', creditorId: val === 'registered' ? (currentUser?.id || members[0]?.id || '') : '' })}
                >
                  <SelectTrigger className="w-[140px] rounded-xl border-stone-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="registered">Integrante</SelectItem>
                    <SelectItem value="dummy">Ficticio</SelectItem>
                  </SelectContent>
                </Select>

                {form.creditorType === 'registered' ? (
                  <Select 
                    value={form.creditorId} 
                    onValueChange={(val: any) => setForm({ ...form, creditorId: val || '' })}
                  >
                    <SelectTrigger className="flex-1 rounded-xl border-stone-200">
                      <SelectValue placeholder="Seleccionar acreedor..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {members.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    placeholder="Nombre del acreedor ficticio..." 
                    className="flex-1 rounded-xl border-stone-200"
                    value={form.creditorName}
                    onChange={(e) => setForm({ ...form, creditorName: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-stone-600 font-bold uppercase tracking-wider text-[10px]">Monto</Label>
                <Input 
                  type="number" 
                  placeholder="Ej: 15000" 
                  className="rounded-xl border-stone-200"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              {/* Billing Period */}
              <div className="space-y-2">
                <Label className="text-stone-600 font-bold uppercase tracking-wider text-[10px]">Periodo</Label>
                <Select value={form.billingPeriod} onValueChange={(val) => val && setForm({ ...form, billingPeriod: val })}>
                  <SelectTrigger className="rounded-xl border-stone-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {getMonthOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-stone-600 font-bold uppercase tracking-wider text-[10px]">Motivo de la Deuda</Label>
              <Input 
                placeholder="Ej: Mitad del arriendo, compra del súper..." 
                className="rounded-xl border-stone-200"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-stone-600 font-bold uppercase tracking-wider text-[10px]">Fecha de Vencimiento (Opcional)</Label>
              <Input 
                type="date" 
                className="rounded-xl border-stone-200"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-stone-600 font-bold uppercase tracking-wider text-[10px]">Notas Adicionales</Label>
              <textarea 
                placeholder="Ingresa detalles sobre plazos o formas de pago..." 
                rows={3}
                className="w-full text-sm border border-stone-200 rounded-xl p-3 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-100 transition-all"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="bg-stone-50 border-t border-stone-100/60 p-6 flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button className="bg-stone-800 hover:bg-stone-900 rounded-full px-8 font-bold" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingDebt ? 'Guardar Cambios' : 'Registrar Deuda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
