'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
import { Wallet, TrendingDown, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const COLORS = ['#10B981', '#F43F5E', '#F59E0B', '#3B82F6', '#8B5CF6']; // Curated modern palette

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
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Resumen Financiero</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Una vista clara de tu estado actual.</p>
        </div>
        <Select value={selectedHousehold} onValueChange={(v: string | null) => setSelectedHousehold(v || "")}>
          <SelectTrigger className="w-[200px] bg-white border-stone-200 rounded-xl shadow-sm h-11">
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

      {stats && (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-stone-100/50 bg-white shadow-sm rounded-3xl hover:shadow-md transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Balance Total</CardTitle>
                <div className="p-2.5 bg-blue-50 text-blue-500 rounded-xl">
                    <Wallet className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-serif text-stone-800 tracking-tight mt-2">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(stats.totalBalance)}</div>
              </CardContent>
            </Card>
            <Card className="border-stone-100/50 bg-white shadow-sm rounded-3xl hover:shadow-md transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Gastos del Mes</CardTitle>
                <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
                    <ArrowDownRight className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-serif text-stone-800 tracking-tight mt-2">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(stats.evolution[5]?.gastos || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-stone-100/50 bg-white shadow-sm rounded-3xl hover:shadow-md transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Ingresos del Mes</CardTitle>
                <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
                    <ArrowUpRight className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-serif text-stone-800 tracking-tight mt-2">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(stats.evolution[5]?.ingresos || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-stone-100/50 bg-white shadow-sm rounded-3xl hover:shadow-md transition-shadow duration-300">
              <CardHeader><CardTitle className="font-serif text-xl text-stone-800">Evolución Mensual</CardTitle></CardHeader>
              <CardContent className="h-[320px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.evolution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#78716C', fontSize: 12 }} dy={10} />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={{fill: '#F5F5F4'}} />
                    <Bar dataKey="ingresos" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="gastos" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-stone-100/50 bg-white shadow-sm rounded-3xl hover:shadow-md transition-shadow duration-300">
              <CardHeader><CardTitle className="font-serif text-xl text-stone-800">Gastos por Categoría</CardTitle></CardHeader>
              <CardContent className="h-[320px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.expensesByCategory}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ name, percent }) => (percent ?? 0) > 0.05 ? `${name} (${((percent ?? 0) * 100).toFixed(0)}%)` : ''}
                      labelLine={false}
                    >
                      {stats.expensesByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-\${index}`} fill={COLORS[index % COLORS.length]} className="stroke-white stroke-2" />
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
