'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
import { Wallet, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('personal');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchHouseholds();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedHousehold]);

  const fetchHouseholds = async () => {
    const res = await fetch('/api/households');
    if (res.ok) setHouseholds(await res.json());
  };

  const fetchStats = async () => {
    const query = selectedHousehold === 'personal' ? '' : `?householdId=\${selectedHousehold}`;
    const res = await fetch(`/api/stats\${query}`);
    if (res.ok) setStats(await res.json());
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Resumen Financiero</h1>
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

      {stats && (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance Total</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(stats.totalBalance)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos del Mes</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(stats.evolution[5]?.gastos || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(stats.evolution[5]?.ingresos || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Evolución Mensual</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.evolution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Gastos por Categoría</CardTitle></CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.expensesByCategory}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {stats.expensesByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-\${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
