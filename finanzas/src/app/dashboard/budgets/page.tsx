'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Save, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  PieChart
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BudgetsPage() {
  const [date, setDate] = useState(new Date());
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catsRes, budgetsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch(`/api/budgets?month=${month}&year=${year}`)
      ]);

      if (catsRes.ok && budgetsRes.ok) {
        const cats = await catsRes.json();
        const buds = await budgetsRes.json();
        setCategories(cats);
        setBudgets(buds);
        
        // Initialize edit values
        const vals: Record<string, string> = {};
        buds.forEach((b: any) => {
            vals[b.categoryId] = String(b.limit);
        });
        setEditValues(vals);
      }
    } catch (err) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (categoryId: string) => {
    const limit = editValues[categoryId];
    if (!limit) return;

    setSaving(categoryId);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          month,
          year,
          limit: parseFloat(limit)
        })
      });

      if (res.ok) {
        toast.success("Presupuesto guardado");
        fetchData();
      } else {
        toast.error("Error al guardar");
      }
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setSaving(null);
    }
  };

  const nextMonth = () => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    setDate(d);
  };

  const prevMonth = () => {
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    setDate(d);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Presupuestos Mensuales</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Controla tus límites de gasto por categoría.</p>
        </div>
        
        <div className="flex items-center bg-white border border-stone-100 shadow-sm rounded-full p-1.5">
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-stone-400 hover:text-stone-800" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="px-6 font-serif text-stone-800 font-bold capitalize min-w-[160px] text-center">
            {monthName}
          </div>
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-stone-400 hover:text-stone-800" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Presupuestado</p>
                      <p className="text-2xl font-serif text-stone-800 mt-1">
                          {formatCurrency(budgets.reduce((acc, b) => acc + Number(b.limit), 0))}
                      </p>
                  </div>
              </CardContent>
          </Card>
          
          <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-600">
                      <PieChart className="h-6 w-6" />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Categorías con límite</p>
                      <p className="text-2xl font-serif text-stone-800 mt-1">{budgets.length} / {categories.length}</p>
                  </div>
              </CardContent>
          </Card>

          <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-emerald-800 text-white overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Estado</p>
                      <p className="text-2xl font-serif mt-1">En control</p>
                  </div>
              </CardContent>
          </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat) => {
          const budget = budgets.find(b => b.categoryId === cat.id);
          const isSaving = saving === cat.id;
          const currentLimit = editValues[cat.id] || '';
          
          return (
            <Card key={cat.id} className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden group hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div 
                            className="p-2.5 rounded-xl transition-transform group-hover:scale-110" 
                            style={{ backgroundColor: `${cat.color || '#ccc'}15`, color: cat.color || '#999' }}
                          >
                             {/* Placeholder icon if not found */}
                             <div className="h-5 w-5 bg-current opacity-50 rounded-full" />
                          </div>
                          <CardTitle className="text-lg font-serif text-stone-800 tracking-tight">{cat.name}</CardTitle>
                      </div>
                      {budget && (
                          <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </div>
                      )}
                  </div>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Límite mensual</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-serif font-bold">$</span>
                            <Input 
                                type="number"
                                placeholder="0"
                                className="pl-8 bg-stone-50 border-stone-100 rounded-2xl h-12 focus-visible:ring-stone-200"
                                value={currentLimit}
                                onChange={(e) => setEditValues({ ...editValues, [cat.id]: e.target.value })}
                            />
                        </div>
                        <Button 
                            className="rounded-2xl h-12 w-12 bg-stone-800 hover:bg-stone-900 shadow-sm transition-all"
                            onClick={() => handleSave(cat.id)}
                            disabled={isSaving || !currentLimit}
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        </Button>
                      </div>
                  </div>
                  
                  {budget && (
                      <div className="space-y-3 pt-2">
                          <div className="flex justify-between text-xs font-bold text-stone-400 uppercase tracking-widest">
                              <span>Consumo (estimado)</span>
                              <span>0%</span>
                          </div>
                          <Progress value={0} className="h-2 bg-stone-100 rounded-full overflow-hidden" />
                      </div>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {categories.length === 0 && !loading && (
          <div className="text-center py-20 bg-stone-50 rounded-[3rem] border border-dashed border-stone-200">
              <AlertCircle className="h-12 w-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-xl font-serif text-stone-800">No hay categorías configuradas</h3>
              <p className="text-stone-500 mt-2">
                Ve a la <Link href="/dashboard/categories" className="text-stone-800 font-bold underline hover:text-stone-600 transition-colors">sección de categorías</Link> para empezar.
              </p>
          </div>
      )}

      {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-stone-300" />
              <p className="text-stone-400 font-serif italic">Preparando tu plan financiero...</p>
          </div>
      )}
    </div>
  );
}
