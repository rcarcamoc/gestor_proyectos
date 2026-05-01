'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, CreditCard, Landmark } from 'lucide-react';

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
    const res = await fetch('/api/households');
    if (res.ok) setHouseholds(await res.json());
  };

  const fetchAccounts = async () => {
    const url = selectedHousehold === 'personal'
      ? '/api/accounts'
      : `/api/accounts?householdId=\${selectedHousehold}`;
    const res = await fetch(url);
    if (res.ok) setAccounts(await res.json());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/accounts', {
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
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Cuentas</h1>
        <Select value={selectedHousehold} onValueChange={(v: string | null) => setSelectedHousehold(v || "")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Seleccionar Entidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">Personal</SelectItem>
            {households.map(h => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Nueva Cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">Cuenta Corriente</SelectItem>
                    <SelectItem value="SAVINGS">Ahorro</SelectItem>
                    <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Input value={currency} onChange={e => setCurrency(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>Crear</Button>
            </form>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map(acc => (
            <Card key={acc.id}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 rounded-full">
                    {acc.type === 'CREDIT_CARD' ? <CreditCard className="text-blue-600" /> : <Landmark className="text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-semibold">{acc.name}</p>
                    <p className="text-2xl font-bold">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: acc.currency }).format(acc.balance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {accounts.length === 0 && (
            <p className="text-gray-500 col-span-2 text-center py-10">No hay cuentas registradas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
