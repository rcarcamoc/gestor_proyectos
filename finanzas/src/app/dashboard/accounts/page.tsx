'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, CreditCard, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('personal');
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('CHECKING');
  const [currency, setCurrency] = useState('CLP');

  useEffect(() => {
    fetchHouseholds();
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [selectedHousehold]);

  const fetchHouseholds = async () => {
    try {
      const res = await fetch('/finanzas/api/households');
      if (res.ok) {
        setHouseholds(await res.json());
      } else if (res.status === 401) {
        toast.error("Sesión expirada. Por favor, inicia sesión nuevamente.");
      }
    } catch (err) {
      console.error("Error fetching households:", err);
    }
  };

  const fetchAccounts = async () => {
    const url = selectedHousehold === 'personal'
      ? '/finanzas/api/accounts'
      : `/finanzas/api/accounts?householdId=${selectedHousehold}`;
    const res = await fetch(url);
    if (res.ok) setAccounts(await res.json());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/finanzas/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          currency,
          householdId: selectedHousehold === 'personal' ? null : selectedHousehold
        }),
      });
      if (res.ok) {
        toast.success('Cuenta creada');
        setName('');
        fetchAccounts();
      }
    } catch (error) {
      toast.error('Error al crear cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Cuentas</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Administra tus métodos de pago y cuentas de ahorro.</p>
        </div>
        <Select value={selectedHousehold} onValueChange={(v: string | null) => setSelectedHousehold(v || "")}>
          <SelectTrigger className="w-[200px] bg-white border-stone-200/60 rounded-xl h-11 shadow-sm">
            <SelectValue placeholder="Seleccionar Entidad" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-stone-200 shadow-lg">
            <SelectItem value="personal" className="rounded-lg">Personal</SelectItem>
            {households.map(h => (
              <SelectItem key={h.id} value={h.id} className="rounded-lg">{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 border-stone-100/50 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow duration-300">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100/60 p-6">
            <CardTitle className="text-xl font-serif text-stone-800 tracking-tight">Nueva Cuenta</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-stone-600 font-medium">Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required className="rounded-xl border-stone-200/60 h-11 shadow-sm focus-visible:ring-stone-200" placeholder="Ej. Tarjeta VISA" />
              </div>
              <div className="space-y-2">
                <Label className="text-stone-600 font-medium">Tipo</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="rounded-xl border-stone-200/60 h-11 shadow-sm focus-visible:ring-stone-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="CHECKING" className="rounded-lg">Cuenta Corriente</SelectItem>
                    <SelectItem value="SAVINGS" className="rounded-lg">Ahorro</SelectItem>
                    <SelectItem value="CREDIT_CARD" className="rounded-lg">Tarjeta de Crédito</SelectItem>
                    <SelectItem value="CASH" className="rounded-lg">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-stone-600 font-medium">Moneda</Label>
                <Input value={currency} onChange={e => setCurrency(e.target.value)} required className="rounded-xl border-stone-200/60 h-11 shadow-sm focus-visible:ring-stone-200" />
              </div>
              <Button type="submit" className="w-full bg-stone-800 hover:bg-stone-900 rounded-xl h-11 shadow-sm transition-all mt-4" disabled={isLoading}>
                  {isLoading ? 'Creando...' : 'Crear Cuenta'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 items-start auto-rows-max">
          {accounts.map(acc => (
            <Card key={acc.id} className="border-stone-100/50 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                      "p-3.5 rounded-2xl flex-shrink-0 shadow-sm",
                      acc.type === 'CREDIT_CARD' ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
                  )}>
                    {acc.type === 'CREDIT_CARD' ? <CreditCard className="h-6 w-6" /> : <Landmark className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-800 truncate">{acc.name}</p>
                    <p className="text-2xl font-serif tracking-tight mt-0.5">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: acc.currency }).format(acc.balance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200/80 rounded-3xl bg-stone-50/30">
                <Wallet className="h-12 w-12 text-stone-300 mb-4" />
                <p className="text-stone-500 font-medium">No hay cuentas registradas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
