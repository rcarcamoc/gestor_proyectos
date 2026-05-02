'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Brain, Sparkles, Tag, RefreshCw, CheckCircle, Zap,
  AlertTriangle, TrendingUp, Database, Cpu, Loader2, HelpCircle
} from 'lucide-react';

type Stats = {
  total: number;
  needsReview: number;
  trainingDataSize: number;
  bySource: Record<string, number>;
};

type PendingTx = {
  id: string;
  description: string;
  amount: number;
  date: string;
  categorySource: string | null;
};

const SOURCE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  keyword: { label: 'Reglas', icon: <Zap className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  ml:      { label: 'ML',     icon: <Cpu className="h-3 w-3" />, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  groq:    { label: 'IA',     icon: <Brain className="h-3 w-3" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  manual:  { label: 'Manual', icon: <Tag className="h-3 w-3" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  needs_review: { label: 'Revisar', icon: <HelpCircle className="h-3 w-3" />, color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function SourceBadge({ source }: { source: string | null }) {
  const s = source ?? 'needs_review';
  const meta = SOURCE_META[s] ?? SOURCE_META.needs_review;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-full ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

export default function ClassifyPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [statsRes, pendingRes, catRes] = await Promise.all([
        fetch('/finanzas/api/classify'),
        fetch('/finanzas/api/transactions?uncategorized=true'),
        fetch('/finanzas/api/categories'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (pendingRes.ok) {
        const txs = await pendingRes.json();
        setPending(txs.filter((t: any) => !t.categoryId || t.categorySource === 'needs_review'));
      }
      if (catRes.ok) setCategories(await catRes.json());
    } catch (err) {
      toast.error('Error cargando datos');
    }
  };

  const runClassifyAll = async () => {
    setClassifying(true);
    try {
      const res = await fetch('/finanzas/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 100 }),
      });
      if (res.ok) {
        const r = await res.json();
        toast.success(
          `Clasificadas: ${r.keyword} reglas · ${r.ml} ML · ${r.groq} IA · ${r.needs_review} necesitan tu revisión`
        );
        fetchAll();
      }
    } catch {
      toast.error('Error al clasificar');
    } finally {
      setClassifying(false);
    }
  };

  const assignCategory = async (transactionId: string, categoryId: string) => {
    setLoadingId(transactionId);
    try {
      const res = await fetch('/finanzas/api/classify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, categoryId }),
      });
      if (res.ok) {
        toast.success('Categoría guardada · El modelo aprenderá de esta corrección');
        setPending(prev => prev.filter(t => t.id !== transactionId));
        setStats(prev => prev ? { ...prev, needsReview: Math.max(0, prev.needsReview - 1), trainingDataSize: prev.trainingDataSize + 1 } : prev);
      }
    } catch {
      toast.error('Error al guardar');
    } finally {
      setLoadingId(null);
    }
  };

  const coverage = stats ? Math.round(((stats.total - stats.needsReview) / Math.max(stats.total, 1)) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-5 w-5 text-violet-500" />
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Inteligencia Artificial</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Clasificación Automática</h1>
          <p className="text-stone-500 mt-1.5 font-medium">El modelo aprende de tus correcciones para reducir consultas a la IA.</p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-sm hover:shadow-md transition-all duration-300 px-6"
          onClick={runClassifyAll}
          disabled={classifying}
        >
          {classifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {classifying ? 'Clasificando...' : 'Clasificar Todo'}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total transacciones', value: stats.total, icon: <Database className="h-5 w-5 text-stone-400" />, color: 'text-stone-800' },
            { label: 'Datos de entrenamiento', value: stats.trainingDataSize, icon: <TrendingUp className="h-5 w-5 text-violet-400" />, color: 'text-violet-700' },
            { label: 'Cobertura automática', value: `${coverage}%`, icon: <CheckCircle className="h-5 w-5 text-emerald-400" />, color: 'text-emerald-700' },
            { label: 'Necesitan tu revisión', value: stats.needsReview, icon: <AlertTriangle className="h-5 w-5 text-rose-400" />, color: 'text-rose-700' },
          ].map((stat) => (
            <Card key={stat.label} className="border-stone-100/50 shadow-sm rounded-3xl bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  {stat.icon}
                  <span className={`text-2xl font-serif font-bold ${stat.color}`}>{stat.value}</span>
                </div>
                <p className="text-xs text-stone-400 font-medium leading-tight">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cascade diagram */}
      <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100/60 p-6">
          <CardTitle className="font-serif text-xl text-stone-800">Cascada de Clasificación</CardTitle>
          <CardDescription className="text-stone-500 font-medium">Cada capa evita llamadas innecesarias a la IA. Groq solo actúa como último recurso.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-0">
            {[
              {
                step: '1', title: 'Reglas / Keywords', icon: <Zap className="h-5 w-5 text-blue-500" />,
                desc: 'Coincidencias exactas con comercios conocidos (Jumbo, Uber, Netflix…). Instantáneo, sin IA.',
                count: stats?.bySource?.keyword ?? 0, color: 'bg-blue-50 border-blue-200/60'
              },
              {
                step: '2', title: 'Naive Bayes ML', icon: <Cpu className="h-5 w-5 text-violet-500" />,
                desc: 'Aprende del historial clasificado por ti. Mejora con cada corrección. Sin costos de API.',
                count: stats?.bySource?.ml ?? 0, color: 'bg-violet-50 border-violet-200/60'
              },
              {
                step: '3', title: 'Groq LLM', icon: <Brain className="h-5 w-5 text-amber-500" />,
                desc: 'Solo se usa si los pasos anteriores tienen baja confianza. llama-3.1-8b-instant en batch.',
                count: stats?.bySource?.groq ?? 0, color: 'bg-amber-50 border-amber-200/60'
              },
              {
                step: '!', title: 'Tu Revisión', icon: <HelpCircle className="h-5 w-5 text-rose-500" />,
                desc: 'Si ninguna capa clasifica con suficiente confianza, te pedimos ayuda. Tu respuesta entrena el ML.',
                count: stats?.needsReview ?? 0, color: 'bg-rose-50 border-rose-200/60'
              },
            ].map((layer, i) => (
              <div key={layer.step} className="flex-1 relative">
                {i < 3 && (
                  <div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 z-10 text-stone-300 text-xl font-light">›</div>
                )}
                <div className={`border ${layer.color} rounded-2xl p-4 m-1 h-full`}>
                  <div className="flex items-center gap-2 mb-2">
                    {layer.icon}
                    <span className="font-semibold text-stone-700 text-sm">{layer.title}</span>
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed font-medium mb-3">{layer.desc}</p>
                  <div className="text-xl font-serif font-bold text-stone-800">{layer.count}</div>
                  <div className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">clasificadas</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Review Queue */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-serif text-stone-800">Cola de Revisión</h2>
            <p className="text-stone-500 text-sm font-medium mt-0.5">Transacciones donde el modelo necesita tu ayuda. Cada corrección mejora las predicciones futuras.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchAll} className="rounded-full text-stone-400 hover:text-stone-700">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Actualizar
          </Button>
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-stone-200 rounded-[3rem] bg-stone-50/50 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-300 mb-4" />
            <p className="text-stone-500 font-semibold text-lg font-serif">¡Todo clasificado!</p>
            <p className="text-stone-400 text-sm mt-1 font-medium">No hay transacciones pendientes de revisión.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((tx) => (
              <Card key={tx.id} className="border-stone-100/50 shadow-sm rounded-2xl bg-white hover:shadow-md transition-all duration-300">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SourceBadge source={tx.categorySource} />
                      <p className="font-semibold text-stone-800 truncate">{tx.description || '(sin descripción)'}</p>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 font-medium">
                      {new Date(tx.date).toLocaleDateString('es-CL')} · {' '}
                      <span className={Number(tx.amount) < 0 ? 'text-rose-500 font-bold' : 'text-emerald-600 font-bold'}>
                        {Number(tx.amount) < 0 ? '-' : '+'}
                        {Math.abs(Number(tx.amount)).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select
                      onValueChange={(catId: string | null) => { if (catId) assignCategory(tx.id, catId); }}
                      disabled={loadingId === tx.id}
                    >
                      <SelectTrigger className="w-full sm:w-[200px] rounded-xl border-stone-200 h-10 text-sm bg-white shadow-sm">
                        <SelectValue placeholder="Asignar categoría..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-stone-200 shadow-xl">
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              {c.color && (
                                <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              )}
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {loadingId === tx.id && <Loader2 className="h-4 w-4 animate-spin text-stone-400 flex-shrink-0" />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
