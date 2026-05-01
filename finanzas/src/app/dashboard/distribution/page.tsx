'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Wallet, Scale, Users, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DistributionPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHouseholds();
  }, []);

  useEffect(() => {
    if (selectedHousehold) {
      fetchDistribution();
    }
  }, [selectedHousehold]);

  const fetchHouseholds = async () => {
    const res = await fetch('/api/households');
    if (res.ok) {
      const list = await res.json();
      setHouseholds(list);
      if (list.length > 0) setSelectedHousehold(list[0].id);
    }
  };

  const fetchDistribution = async () => {
    setLoading(true);
    const res = await fetch(`/api/distribution?householdId=\${selectedHousehold}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif text-stone-800">Distribución de Gastos</h1>
          <p className="text-stone-500 mt-1">Cálculo proporcional basado en los ingresos de la pareja.</p>
        </div>
        <Select value={selectedHousehold} onValueChange={setSelectedHousehold}>
          <SelectTrigger className="w-[220px] bg-white border-stone-200 rounded-xl">
            <SelectValue placeholder="Seleccionar Hogar" />
          </SelectTrigger>
          <SelectContent>
            {households.map(h => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!data && !loading && (
        <Card className="border-stone-200 shadow-sm rounded-2xl bg-white/50 backdrop-blur-sm">
          <CardContent className="py-20 text-center">
            <Scale className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">Selecciona un hogar para ver la distribución.</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-stone-200 shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardHeader className="bg-stone-50/50 border-b border-stone-100">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Users className="h-5 w-5 mr-2 text-stone-600" />
                  Reparto por Integrante
                </CardTitle>
                <CardDescription>Basado en los ingresos registrados este mes.</CardDescription>
              </CardHeader>
              <CardContent className="pt-8 space-y-10">
                {data.distribution.map((m: any) => (
                  <div key={m.userId} className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-stone-900 font-medium text-lg">{m.name}</span>
                        <div className="text-stone-400 text-sm flex items-center mt-1">
                          <Wallet className="h-3 w-3 mr-1" />
                          Ingreso: {formatCurrency(m.income)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-serif text-stone-800">{m.percentage.toFixed(1)}%</span>
                        <div className="text-stone-400 text-xs uppercase tracking-wider">Aporte Sugerido</div>
                      </div>
                    </div>
                    <Progress value={m.percentage} className="h-3 bg-stone-100 rounded-full" />
                    <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Contribución ideal</span>
                        <span className="text-stone-800 font-semibold">{formatCurrency(m.suggestedContribution)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-stone-200 shadow-sm rounded-2xl bg-white">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase tracking-widest text-stone-400">Total Gastos Hogar</CardDescription>
                        <CardTitle className="text-2xl font-serif text-stone-800">{formatCurrency(data.totalExpenses)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-stone-400 w-full" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-stone-200 shadow-sm rounded-2xl bg-white">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs uppercase tracking-widest text-stone-400">Total Ingresos</CardDescription>
                        <CardTitle className="text-2xl font-serif text-stone-800">{formatCurrency(data.totalIncome)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-400 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none bg-stone-800 text-white shadow-xl rounded-3xl p-4 overflow-hidden relative">
                <TrendingUp className="absolute -right-4 -top-4 h-32 w-32 text-white/5" />
                <CardHeader>
                    <CardTitle className="text-xl font-serif">Análisis Zen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                        <p className="text-sm text-stone-300 leading-relaxed italic">
                            "La justicia financiera no es dividir por dos, es equilibrar según la capacidad de cada uno para mantener la serenidad del hogar."
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-stone-400 uppercase tracking-wider">Ahorro Estimado</h4>
                        <p className="text-3xl font-serif">{formatCurrency(data.totalIncome - data.totalExpenses)}</p>
                        <p className="text-xs text-stone-500">Saldo remanente del mes</p>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="border-stone-200 shadow-sm rounded-2xl bg-white p-6">
                <h4 className="text-sm font-semibold text-stone-900 mb-4">¿Cómo funciona?</h4>
                <ul className="space-y-4 text-sm text-stone-600">
                    <li className="flex items-start">
                        <div className="h-5 w-5 rounded-full bg-stone-100 flex items-center justify-center text-[10px] mr-2 mt-0.5">1</div>
                        Sumamos los ingresos de todos los miembros del hogar este mes.
                    </li>
                    <li className="flex items-start">
                        <div className="h-5 w-5 rounded-full bg-stone-100 flex items-center justify-center text-[10px] mr-2 mt-0.5">2</div>
                        Calculamos qué porcentaje del total aporta cada persona.
                    </li>
                    <li className="flex items-start">
                        <div className="h-5 w-5 rounded-full bg-stone-100 flex items-center justify-center text-[10px] mr-2 mt-0.5">3</div>
                        Aplicamos ese porcentaje al gasto total para sugerir el aporte justo.
                    </li>
                </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
