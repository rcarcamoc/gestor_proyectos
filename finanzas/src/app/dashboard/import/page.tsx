'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function ImportPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('personal');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [fileData, setFileData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ date: '', amount: '', description: '' });
  const [isLoading, setIsLoading] = useState(false);

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
    const query = selectedHousehold === 'personal' ? '' : `?householdId=\${selectedHousehold}`;
    const res = await fetch(`/api/accounts\${query}`);
    if (res.ok) {
      const data = await res.json();
      setAccounts(data);
      if (data.length > 0) setSelectedAccount(data[0].id);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length > 0) {
        setFileData(data);
        setHeaders(Object.keys(data[0] as object));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!selectedAccount) return toast.error('Selecciona una cuenta');
    setIsLoading(true);
    try {
      const res = await fetch('/api/import/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: fileData,
          mapping,
          accountId: selectedAccount,
          householdId: selectedHousehold === 'personal' ? null : selectedHousehold
        })
      });
      if (res.ok) {
        const result = await res.json();
        toast.success(`Importación terminada: \${result.imported} nuevos, \${result.flagged} por revisar, \${result.skipped} duplicados.`);
        setFileData([]);
      }
    } catch (error) {
      toast.error('Error en la importación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Importar Excel/CSV</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Entidad</Label>
              <Select value={selectedHousehold} onValueChange={(v: string | null) => setSelectedHousehold(v || "")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  {households.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cuenta de Destino</Label>
              <Select value={selectedAccount} onValueChange={(v: any) => setSelectedAccount(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Archivo</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Mapeo de Columnas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {headers.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Select value={mapping.date} onValueChange={v => setMapping({...mapping, date: v || ""})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Select value={mapping.amount} onValueChange={v => setMapping({...mapping, amount: v || ""})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Select value={mapping.description} onValueChange={v => setMapping({...mapping, description: v || ""})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleImport} className="w-full" disabled={isLoading || !mapping.date || !mapping.amount}>
                  {isLoading ? 'Importando...' : 'Confirmar Importación'}
                </Button>

                <div className="mt-6">
                  <Label>Vista previa (5 filas)</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers.map(h => <TableHead key={h}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {headers.map(h => <TableCell key={h}>{row[h]}</TableCell>)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-10">Sube un archivo para configurar el mapeo.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
