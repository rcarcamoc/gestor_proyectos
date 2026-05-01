'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from "@/components/ui/progress";
import { Users, Scale } from 'lucide-react';

export default function DistributionPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchHouseholds();
  }, []);

  useEffect(() => {
    if (selectedHousehold) fetchDistribution();
  }, [selectedHousehold]);

  const fetchHouseholds = async () => {
    const res = await fetch('/api/households');
    if (res.ok) {
      const d = await res.json();
      setHouseholds(d);
      if (d.length > 0) setSelectedHousehold(d[0].id);
    }
  };

  const fetchDistribution = async () => {
    const res = await fetch(`/api/distribution?householdId=\${selectedHousehold}`);
    if (res.ok) setData(await res.json());
  };

  if (!selectedHousehold) return <div className="p-10 text-center">Debes pertenecer a un hogar para ver la distribución.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Distribución Proporcional</h1>
        <Select value={selectedHousehold} onValueChange={(v: string | null) => setSelectedHousehold(v || "")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Seleccionar Hogar" />
          </SelectTrigger>
          <SelectContent>
            {households.map(h => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data && (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500 uppercase">Gasto Total del Hogar (Mes)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500 uppercase">Ingreso Total Combinado</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-green-600">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.totalIncome)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" /> Reparto Sugerido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Ingresos</TableHead>
                    <TableHead>% Aporte</TableHead>
                    <TableHead className="text-right">Aporte Sugerido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.distribution.map((d: any) => (
                    <TableRow key={d.userId}>
                      <TableCell className="font-semibold">{d.name}</TableCell>
                      <TableCell>{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(d.income)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span>{(d.percentage * 100).toFixed(1)}%</span>
                          <Progress value={d.percentage * 100} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(d.suggestedContribution)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-gray-500 mt-4 italic">
                * El cálculo se basa en los ingresos registrados individualmente durante el mes en curso.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
