'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Pie, PieChart, Cell, Tooltip } from 'recharts';
import { 
  Wallet, 
  ArrowDownRight, 
  ArrowUpRight, 
  TrendingUp, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  PieChart as PieChartIcon 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); fetchHouseholds(); }, []);
  useEffect(() => { fetchStats(); }, [selectedHousehold]);

  const fetchHouseholds = async () => {
    const res = await fetch('/api/households');
    if (res.ok) setHouseholds(await res.json());
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const query = selectedHousehold === 'personal' ? '' : `&householdId=${selectedHousehold}`;
      const now = new Date();
      const res = await fetch(`/api/reports/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}${query}`);
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
        {mounted ? (
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
        ) : (
            <div className="w-[180px] h-10 bg-stone-50 rounded-2xl animate-pulse" />
        )}
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
              value={fmt(stats.totalExpenses)}
              subtitle={`${stats.budgetVsActual.filter((b: any) => b.isOverBudget).length} categorías excedidas`}
            />
            <StatCard
              icon={ArrowUpRight}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-500"
              label="Ingresos del Mes"
              value={fmt(stats.totalIncome)}
              subtitle={`Meta de ahorro: ${fmt(Math.max(0, stats.totalIncome - stats.totalBudget))}`}
            />
          </div>

          {/* Charts & Insights */}
          <div className="grid md:grid-cols-6 gap-6">
            {/* Evolution chart */}
            <div className="md:col-span-4 glass-card p-6 lg:p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="font-serif text-2xl text-stone-800 tracking-tight">Evolución Mensual</p>
                  <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Ingresos vs Gastos</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.evolution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F4" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#A8A29E', fontSize: 11, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A8A29E', fontSize: 11, fontWeight: 600 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB', radius: 12 }} />
                  <Bar dataKey="ingresos" fill="#10B981" radius={[8, 8, 2, 2]} maxBarSize={32} />
                  <Bar dataKey="gastos" fill="#F43F5E" radius={[8, 8, 2, 2]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-6 mt-6 pt-6 border-t border-stone-50">
                <span className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest"><span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm" />Ingresos</span>
                <span className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-widest"><span className="h-3 w-3 rounded-full bg-rose-400 shadow-sm" />Gastos</span>
              </div>
            </div>

            {/* Insights and Alerts */}
            <div className="md:col-span-2 space-y-6">
                <div className="glass-card bg-stone-900 text-white p-6 border-none shadow-xl relative overflow-hidden group">
                    <TrendingUp className="absolute -right-8 -top-8 h-40 w-40 text-white/5 group-hover:text-white/10 transition-all duration-700" />
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Análisis Zen</p>
                        {stats.insights.length > 0 ? (
                            <div className="space-y-4">
                                {stats.insights.map((insight: string, i: number) => (
                                    <p key={i} className="font-serif text-lg leading-snug italic text-stone-100">
                                        "{insight}"
                                    </p>
                                ))}
                            </div>
                        ) : (
                            <p className="text-stone-500 italic">No hay suficientes datos para generar insights aún.</p>
                        )}
                        <div className="mt-8 pt-6 border-t border-white/10">
                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.2em]">Salud Financiera</p>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" 
                                        style={{ width: `${Math.min(100, (stats.totalIncome > 0 ? (1 - stats.totalExpenses / stats.totalIncome) * 100 : 0))}%` }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-emerald-400">{Math.max(0, Math.round(stats.totalIncome > 0 ? (1 - stats.totalExpenses / stats.totalIncome) * 100 : 0))}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-6 bg-white shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Alertas Presupuesto</p>
                        <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    </div>
                    {stats.alerts.length > 0 ? (
                        <div className="space-y-4">
                            {stats.alerts.slice(0, 3).map((alert: string, i: number) => (
                                <div key={i} className="flex gap-3 p-3 rounded-2xl bg-rose-50/50 border border-rose-100/50">
                                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                                    <p className="text-xs font-medium text-rose-800 leading-relaxed">{alert}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-20" />
                            <p className="text-xs text-stone-400 font-medium italic">Todo bajo control este mes.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Expenses by Category (Pie replacement with improved design) */}
            <div className="md:col-span-6 glass-card p-8 lg:p-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <p className="font-serif text-2xl text-stone-800 tracking-tight">Presupuesto por Categoría</p>
                        <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Estado de tus límites mensuales</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-100 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-stone-300" />
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Presupuestado</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-100 shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Gastado</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
                    {stats.budgetVsActual.length > 0 ? (
                        stats.budgetVsActual.map((item: any, i: number) => (
                            <div key={i} className="space-y-4 group">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm font-bold text-stone-800 tracking-tight group-hover:text-stone-600 transition-colors">{item.categoryName}</p>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">{fmt(item.actualAmount)} / {fmt(item.budgetedAmount)}</p>
                                    </div>
                                    <span className={cn(
                                        "text-sm font-serif font-bold tracking-tight",
                                        item.isOverBudget ? "text-rose-500" : "text-emerald-600"
                                    )}>
                                        {Math.round(item.percentUsed)}%
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className={cn(
                                            "h-full rounded-full transition-all duration-1000 shadow-sm",
                                            item.isOverBudget ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                        )}
                                        style={{ width: `${Math.min(100, item.percentUsed)}%` }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-stone-50/50 rounded-[2rem] border border-dashed border-stone-200">
                            <PieChartIcon className="h-10 w-10 text-stone-200 mx-auto mb-3" />
                            <p className="text-sm text-stone-400 font-medium italic">Configura presupuestos para ver el seguimiento aquí.</p>
                        </div>
                    )}
                </div>
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
