'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Wallet, Scale, Users, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function DistributionPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchHouseholds();
  }, []);

  useEffect(() => {
    if (selectedHousehold) {
      fetchDistribution();
    }
  }, [selectedHousehold]);

  const fetchHouseholds = async () => {
    try {
      const res = await fetch('/finanzas/api/households');
      if (res.ok) {
        const list = await res.json();
        setHouseholds(list);
        if (list.length > 0) setSelectedHousehold(list[0].id);
      } else if (res.status === 401) {
        toast.error("Sesión expirada");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDistribution = async () => {
    setLoading(true);
    const res = await fetch(`/finanzas/api/distribution?householdId=${selectedHousehold}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Distribución de Gastos</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Cálculo proporcional basado en los ingresos de la pareja.</p>
        </div>
        {mounted ? (
          <Select value={selectedHousehold} onValueChange={(val) => setSelectedHousehold(val || '')}>
            <SelectTrigger className="w-[220px] bg-white border-stone-200/60 rounded-xl h-11 shadow-sm">
              <SelectValue placeholder="Seleccionar Hogar" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-stone-200 shadow-lg">
              {households.map(h => (
                <SelectItem key={h.id} value={h.id} className="rounded-lg">{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="w-[220px] h-11 bg-stone-50 rounded-xl border border-stone-100 animate-pulse" />
        )}
      </div>

      {!data && !loading && (
        <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white/70 backdrop-blur-md">
          <CardContent className="py-24 text-center">
            <Scale className="h-16 w-16 text-stone-300 mx-auto mb-6" />
            <p className="text-stone-500 font-medium">Selecciona un hogar para ver la distribución.</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-stone-100/50 shadow-sm rounded-3xl overflow-hidden bg-white hover:shadow-md transition-shadow duration-300">
              <CardHeader className="bg-stone-50/50 border-b border-stone-100/60 py-6 px-8">
                <CardTitle className="text-lg font-serif tracking-tight flex items-center text-stone-800">
                  <Users className="h-5 w-5 mr-3 text-stone-500" />
                  Reparto por Integrante
                </CardTitle>
                <CardDescription className="text-stone-500 mt-1 font-medium">Basado en los ingresos registrados este mes.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-12">
                {data.distribution.map((m: any, index: number) => (
                  <div key={m.userId} className="space-y-5">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-stone-900 font-semibold text-lg">{m.name}</span>
                        <div className="text-stone-500 text-sm flex items-center mt-1 font-medium">
                          <Wallet className="h-4 w-4 mr-1.5" />
                          Ingreso: <span className="text-stone-700 ml-1">{formatCurrency(m.income)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-serif text-stone-800 tracking-tight">{m.percentage.toFixed(1)}%</span>
                        <div className="text-stone-400 text-xs uppercase tracking-widest font-semibold mt-1">Aporte Sugerido</div>
                      </div>
                    </div>
                    <Progress value={m.percentage} className="h-4 bg-stone-100 rounded-full overflow-hidden" indicatorClassName={index % 2 === 0 ? "bg-emerald-500" : "bg-rose-500"} />
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-stone-100/60">
                        <span className="text-stone-500 font-medium uppercase tracking-wider text-xs">Contribución ideal</span>
                        <span className="text-stone-800 font-bold text-lg">{formatCurrency(m.suggestedContribution)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="pb-4 px-6 pt-6">
                        <CardDescription className="text-xs font-semibold uppercase tracking-widest text-stone-400">Total Gastos Hogar</CardDescription>
                        <CardTitle className="text-3xl font-serif text-stone-800 tracking-tight mt-1">{formatCurrency(data.totalExpenses)}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-400 w-full" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow duration-300">
                    <CardHeader className="pb-4 px-6 pt-6">
                        <CardDescription className="text-xs font-semibold uppercase tracking-widest text-stone-400">Total Ingresos</CardDescription>
                        <CardTitle className="text-3xl font-serif text-stone-800 tracking-tight mt-1">{formatCurrency(data.totalIncome)}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none bg-stone-800 text-white shadow-lg rounded-3xl p-6 overflow-hidden relative group hover:shadow-xl transition-shadow duration-500">
                <TrendingUp className="absolute -right-6 -top-6 h-40 w-40 text-white/5 group-hover:text-white/10 transition-colors duration-500" />
                <CardHeader className="relative z-10">
                    <CardTitle className="text-2xl font-serif tracking-tight">Análisis Zen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 relative z-10 pt-2">
                    <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-md border border-white/5">
                        <p className="text-sm text-stone-200 leading-relaxed italic font-serif">
                            "La justicia financiera no es dividir por dos, es equilibrar según la capacidad de cada uno para mantener la serenidad del hogar."
                        </p>
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Ahorro Estimado</h4>
                        <p className="text-4xl font-serif tracking-tight">{formatCurrency(data.totalIncome - data.totalExpenses)}</p>
                        <p className="text-xs text-stone-500 font-medium">Saldo remanente del mes</p>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white p-8 hover:shadow-md transition-shadow duration-300">
                <h4 className="text-sm font-bold text-stone-900 mb-5 uppercase tracking-wider">¿Cómo funciona?</h4>
                <ul className="space-y-5 text-sm text-stone-500 font-medium">
                    <li className="flex items-start">
                        <div className="h-6 w-6 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-700 mr-3 mt-0.5 shadow-sm">1</div>
                        <span className="leading-relaxed">Sumamos los ingresos de todos los miembros del hogar este mes.</span>
                    </li>
                    <li className="flex items-start">
                        <div className="h-6 w-6 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-700 mr-3 mt-0.5 shadow-sm">2</div>
                        <span className="leading-relaxed">Calculamos qué porcentaje del total aporta cada persona.</span>
                    </li>
                    <li className="flex items-start">
                        <div className="h-6 w-6 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-700 mr-3 mt-0.5 shadow-sm">3</div>
                        <span className="leading-relaxed">Aplicamos ese porcentaje al gasto total para sugerir el aporte justo.</span>
                    </li>
                </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
