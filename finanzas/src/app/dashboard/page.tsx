'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Pie, PieChart, Cell, Tooltip } from 'recharts';
import { Wallet, ArrowDownRight, ArrowUpRight, TrendingUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#F43F5E', '#8B5CF6', '#14B8A6'];

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

function StatCard({ icon: Icon, iconBg, iconColor, label, value, subtitle }: any) {
  return (
    <div className="zen-stat-card animate-zen-in">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <TrendingUp className="h-4 w-4 text-stone-300" />
      </div>
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-serif text-3xl text-stone-900 tracking-tight leading-none">{value}</p>
      {subtitle && <p className="text-xs text-stone-400 mt-2">{subtitle}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-sm shadow-xl">
      <p className="font-semibold text-stone-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name === 'ingresos' ? 'Ingresos' : 'Gastos'}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-sm shadow-xl">
      <p className="font-semibold text-stone-700">{payload[0].name}</p>
      <p className="text-stone-500">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function DashboardPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('personal');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHouseholds(); }, []);
  useEffect(() => { fetchStats(); }, [selectedHousehold]);

  const fetchHouseholds = async () => {
    const res = await fetch('/api/households');
    if (res.ok) setHouseholds(await res.json());
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const query = selectedHousehold === 'personal' ? '' : `?householdId=${selectedHousehold}`;
      const res = await fetch(`/api/stats${query}`);
      if (res.ok) {
        setStats(await res.json());
      } else {
        toast.error("Error al cargar estadísticas");
      }
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const currentMonth = stats?.evolution?.[stats.evolution.length - 1];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-zen-in">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Panel Principal</span>
          </div>
          <h1 className="font-serif text-4xl text-stone-900 tracking-tight">Resumen Financiero</h1>
          <p className="text-stone-400 mt-1.5 text-sm">Tu situación actual de un vistazo.</p>
        </div>
        <Select value={selectedHousehold} onValueChange={(v) => setSelectedHousehold(v || 'personal')}>
          <SelectTrigger className="w-[180px] rounded-2xl border-stone-200 bg-white shadow-sm h-10 text-sm">
            <SelectValue placeholder="Vista" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-stone-200 shadow-xl">
            <SelectItem value="personal" className="rounded-xl">Personal</SelectItem>
            {households.map(h => (
              <SelectItem key={h.id} value={h.id} className="rounded-xl">{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="zen-stat-card animate-pulse">
              <div className="h-12 w-12 rounded-2xl bg-stone-100 mb-4" />
              <div className="h-3 w-20 rounded bg-stone-100 mb-2" />
              <div className="h-8 w-32 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* KPIs */}
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard
              icon={Wallet}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-500"
              label="Balance Total"
              value={fmt(stats.totalBalance)}
              subtitle="En todas tus cuentas"
            />
            <StatCard
              icon={ArrowDownRight}
              iconBg="bg-rose-50"
              iconColor="text-rose-500"
              label="Gastos del Mes"
              value={fmt(currentMonth?.gastos || 0)}
              subtitle={currentMonth?.month}
            />
            <StatCard
              icon={ArrowUpRight}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-500"
              label="Ingresos del Mes"
              value={fmt(currentMonth?.ingresos || 0)}
              subtitle={currentMonth?.month}
            />
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-5 gap-4">
            {/* Bar chart – wider */}
            <div className="md:col-span-3 glass-card p-6">
              <p className="font-serif text-xl text-stone-800 mb-1">Evolución Mensual</p>
              <p className="text-xs text-stone-400 mb-5">Ingresos vs gastos por mes</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.evolution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#A8A29E', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A8A29E', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F5F4', radius: 8 }} />
                  <Bar dataKey="ingresos" fill="#10B981" radius={[6, 6, 2, 2]} maxBarSize={28} />
                  <Bar dataKey="gastos" fill="#F43F5E" radius={[6, 6, 2, 2]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-stone-500"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />Ingresos</span>
                <span className="flex items-center gap-1.5 text-xs text-stone-500"><span className="h-2 w-2 rounded-full bg-rose-400 inline-block" />Gastos</span>
              </div>
            </div>

            {/* Pie chart – narrower */}
            <div className="md:col-span-2 glass-card p-6 flex flex-col">
              <p className="font-serif text-xl text-stone-800 mb-1">Por Categoría</p>
              <p className="text-xs text-stone-400 mb-4">Distribución de gastos</p>
              {stats.expensesByCategory?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.expensesByCategory}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={3}
                        strokeWidth={2}
                        stroke="#FAFAF9"
                      >
                        {stats.expensesByCategory.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {stats.expensesByCategory.slice(0, 4).map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-stone-600 font-medium">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          {c.name}
                        </span>
                        <span className="text-stone-400">{fmt(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-stone-300 text-sm">Sin datos</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card p-16 text-center">
          <p className="text-stone-400">No se pudieron cargar los datos.</p>
        </div>
      )}
    </div>
  );
}
