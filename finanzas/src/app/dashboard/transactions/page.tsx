'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowUpCircle, ArrowDownCircle, Filter } from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  type: 'INCOME' | 'EXPENSE';
  description?: string;
  category?: { name: string };
  account?: { name: string };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('personal');
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('EXPENSE');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchInitialData = useCallback(async () => {
    const res = await fetch('/api/households');
    if (res.ok) setHouseholds(await res.json());
  }, []);

  const fetchContextData = useCallback(async () => {
    const query = selectedHousehold === 'personal' ? '' : `?householdId=${selectedHousehold}`;
    const [accRes, catRes] = await Promise.all([
      fetch(`/api/accounts${query}`),
      fetch(`/api/categories${query}`)
    ]);
    if (accRes.ok) setAccounts(await accRes.json());
    if (catRes.ok) setCategories(await catRes.json());
  }, [selectedHousehold]);

  const fetchTransactions = useCallback(async () => {
    const url = selectedHousehold === 'personal'
      ? '/api/transactions'
      : `/api/transactions?householdId=${selectedHousehold}`;
    const res = await fetch(url);
    if (res.ok) setTransactions(await res.json());
  }, [selectedHousehold]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchTransactions();
    fetchContextData();
  }, [selectedHousehold, fetchTransactions, fetchContextData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency: 'CLP',
          date,
          type,
          description,
          accountId,
          categoryId,
          householdId: selectedHousehold === 'personal' ? null : selectedHousehold
        }),
      });
      if (res.ok) {
        toast.success('Transacción registrada');
        setAmount('');
        setDescription('');
        fetchTransactions();
      }
    } catch (error) {
      toast.error('Error al registrar transacción');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Transacciones</h1>
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

      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Nuevo Registro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Gasto</SelectItem>
                    <SelectItem value="INCOME">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cuenta</Label>
                <Select value={accountId} onValueChange={(v: any) => setAccountId(v)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={(v: any) => setCategoryId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>Registrar</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Historial</CardTitle>
            <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" /> Filtrar</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{t.description || '-'}</TableCell>
                    <TableCell>{t.category?.name || 'S/C'}</TableCell>
                    <TableCell>{t.account?.name}</TableCell>
                    <TableCell className={`text-right font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'INCOME' ? '+' : '-'} {new Intl.NumberFormat('es-CL', { style: 'currency', currency: t.currency }).format(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {transactions.length === 0 && (
              <p className="text-gray-500 text-center py-10">No hay transacciones registradas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
