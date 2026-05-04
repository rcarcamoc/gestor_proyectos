'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Brain, Sparkles, Tag, RefreshCw, CheckCircle, Zap,
  AlertTriangle, TrendingUp, Database, Cpu, Loader2, HelpCircle,
  Trash2, ChevronLeft, ChevronRight, Edit2, X, ArrowLeft
} from 'lucide-react';

type Stats = { total: number; needsReview: number; trainingDataSize: number; bySource: Record<string, number> };
type PendingTx = { id: string; description: string; amount: number; date: string; categorySource: string | null };
type Category = { id: string; name: string; color: string | null };

const SOURCE_META: Record<string, { label: string; color: string }> = {
  keyword: { label: 'Reglas', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  ml:      { label: 'ML',     color: 'bg-violet-100 text-violet-700 border-violet-200' },
  groq:    { label: 'IA',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  manual:  { label: 'Manual', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  needs_review: { label: 'Revisar', color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

// ─── Swipe Card Component ────────────────────────────────────────────────────
function SwipeCard({
  tx, categories, onConfirm, onSkip, onDelete, onChangeCategory, isTop
}: {
  tx: PendingTx; categories: Category[];
  onConfirm: () => void; onSkip: () => void;
  onDelete: () => void; onChangeCategory: (catId: string) => void;
  isTop: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const [showEdit, setShowEdit] = useState(false);
  const [exiting, setExiting] = useState<'right'|'left'|null>(null);

  const triggerExit = useCallback((dir: 'right'|'left') => {
    setExiting(dir);
    setTimeout(() => { dir === 'right' ? onConfirm() : onSkip(); }, 350);
  }, [onConfirm, onSkip]);

  // Keyboard shortcuts (only for top card)
  useEffect(() => {
    if (!isTop) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') triggerExit('right');
      if (e.key === 'ArrowLeft')  triggerExit('left');
      if (e.key === 'e' || e.key === 'E') setShowEdit(v => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isTop, triggerExit]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!isTop) return;
    setDrag({ x: 0, y: 0, dragging: true, startX: e.clientX, startY: e.clientY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.dragging) return;
    setDrag(d => ({ ...d, x: e.clientX - d.startX, y: e.clientY - d.startY }));
  };
  const onMouseUp = () => {
    if (!drag.dragging) return;
    const { x } = drag;
    setDrag(d => ({ ...d, dragging: false }));
    if (x > 80)       triggerExit('right');
    else if (x < -80) triggerExit('left');
    else setDrag({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  };

  const rotation = drag.x / 20;
  const opacity  = Math.max(0, 1 - Math.abs(drag.x) / 300);
  const showRight = drag.x > 30;
  const showLeft  = drag.x < -30;

  let exitStyle = {};
  if (exiting === 'right') exitStyle = { transform: 'translateX(120%) rotate(20deg)', opacity: 0, transition: 'all 0.35s ease' };
  if (exiting === 'left')  exitStyle = { transform: 'translateX(-120%) rotate(-20deg)', opacity: 0, transition: 'all 0.35s ease' };

  const amt = Number(tx.amount);
  const isIncome = amt >= 0;
  const src = SOURCE_META[tx.categorySource ?? 'needs_review'] ?? SOURCE_META.needs_review;

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 select-none"
      style={{
        transform: exiting ? undefined : `translate(${drag.x}px, ${drag.y}px) rotate(${rotation}deg)`,
        transition: drag.dragging ? 'none' : 'transform 0.3s ease',
        cursor: drag.dragging ? 'grabbing' : 'grab',
        zIndex: isTop ? 20 : 10,
        ...exitStyle,
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className={`w-full h-full rounded-[2rem] bg-white shadow-2xl border overflow-hidden flex flex-col ${isTop ? 'border-stone-200' : 'border-stone-100'}`}>

        {/* Swipe overlays */}
        {showRight && (
          <div className="absolute inset-0 bg-emerald-400/20 rounded-[2rem] flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-emerald-500 text-white font-bold text-2xl px-8 py-4 rounded-2xl rotate-[-8deg] shadow-lg">
              ✓ CONFIRMAR
            </div>
          </div>
        )}
        {showLeft && (
          <div className="absolute inset-0 bg-rose-400/20 rounded-[2rem] flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-rose-500 text-white font-bold text-2xl px-8 py-4 rounded-2xl rotate-[8deg] shadow-lg">
              ✕ OMITIR
            </div>
          </div>
        )}

        {/* Card body */}
        <div className="flex-1 flex flex-col p-8 gap-6">
          {/* Badge */}
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-widest border px-2.5 py-1 rounded-full ${src.color}`}>
              {src.label}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              {new Date(tx.date).toLocaleDateString('es-CL')}
            </span>
          </div>

          {/* Amount */}
          <div className={`text-5xl font-serif font-bold tracking-tight ${isIncome ? 'text-emerald-600' : 'text-stone-900'}`}>
            {isIncome ? '+' : '-'}
            {Math.abs(amt).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
          </div>

          {/* Description */}
          <div>
            <p className="text-stone-800 font-semibold text-xl leading-snug">{tx.description || '(sin descripción)'}</p>
          </div>

          {/* Category selector (edit mode) */}
          {showEdit ? (
            <div className="mt-auto space-y-2" onMouseDown={e => e.stopPropagation()}>
              <p className="text-xs text-stone-400 font-semibold uppercase tracking-widest">Cambiar categoría</p>
              <Select onValueChange={(v: string | null) => { if (v) { onChangeCategory(v); setShowEdit(false); } }}>
                <SelectTrigger className="w-full rounded-2xl border-stone-200 h-12 text-sm bg-stone-50">
                  <SelectValue placeholder="Seleccionar categoría..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl max-h-[250px]">
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.color && <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: c.color }} />}
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="w-full rounded-xl" onClick={() => setShowEdit(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="mt-auto flex items-center justify-between pt-4 border-t border-stone-100">
              <span className="text-xs text-stone-400 font-medium">Arrastra o usa los botones</span>
              <div className="flex gap-1" onMouseDown={e => e.stopPropagation()}>
                <button onClick={() => setShowEdit(true)} className="p-2 rounded-xl text-stone-400 hover:text-violet-600 hover:bg-violet-50 transition-all" title="Editar categoría (E)">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={onDelete} className="p-2 rounded-xl text-stone-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Swipe Mode ──────────────────────────────────────────────────────────────
function SwipeMode({ pending, categories, onExit, onUpdate }: {
  pending: PendingTx[]; categories: Category[];
  onExit: () => void; onUpdate: (id: string, action: 'confirm'|'skip'|'delete'|'change', catId?: string) => void;
}) {
  const [queue, setQueue] = useState([...pending]);
  const [confirmed, setConfirmed] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loadingId, setLoadingId] = useState<string|null>(null);
  const total = pending.length;

  const current = queue[0];
  const next    = queue[1];

  const handleConfirm = async () => {
    if (!current) return;
    setLoadingId(current.id);
    await onUpdate(current.id, 'confirm');
    setQueue(q => q.slice(1));
    setConfirmed(c => c + 1);
    setStreak(s => s + 1);
    setLoadingId(null);
  };

  const handleSkip = async () => {
    if (!current) return;
    setQueue(q => q.slice(1));
    setSkipped(s => s + 1);
    setStreak(0);
    onUpdate(current.id, 'skip');
  };

  const handleDelete = async () => {
    if (!current) return;
    setLoadingId(current.id);
    await onUpdate(current.id, 'delete');
    setQueue(q => q.slice(1));
    setLoadingId(null);
    setStreak(0);
  };

  const handleChange = async (catId: string) => {
    if (!current) return;
    setLoadingId(current.id);
    await onUpdate(current.id, 'change', catId);
    setQueue(q => q.slice(1));
    setConfirmed(c => c + 1);
    setStreak(s => s + 1);
    setLoadingId(null);
  };

  const done = queue.length === 0;
  const progress = Math.round(((total - queue.length) / total) * 100);

  return (
    <div className="fixed inset-0 bg-stone-100 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <Button variant="ghost" size="sm" onClick={onExit} className="rounded-full gap-2 text-stone-500">
          <ArrowLeft className="h-4 w-4" /> Salir
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-stone-700">{total - queue.length} / {total}</p>
          {streak >= 3 && (
            <p className="text-xs text-amber-600 font-bold animate-bounce">🔥 ¡Racha de {streak}!</p>
          )}
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <span className="text-emerald-600">✓ {confirmed}</span>
          <span className="text-stone-400">⏭ {skipped}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 mb-4">
        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full bg-stone-800 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-6">
        {done ? (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-serif text-stone-800">¡Todo listo!</h2>
            <p className="text-stone-500 font-medium">
              Confirmaste <span className="text-emerald-600 font-bold">{confirmed}</span> y omitiste <span className="font-bold">{skipped}</span>
            </p>
            <Button onClick={onExit} className="rounded-full px-8 bg-stone-800 hover:bg-stone-900">
              Volver al resumen
            </Button>
          </div>
        ) : (
          <div className="relative w-full max-w-sm" style={{ height: '420px' }}>
            {/* Next card (peeking behind) */}
            {next && (
              <div className="absolute inset-0 scale-95 translate-y-3 opacity-60 pointer-events-none" style={{ zIndex: 10 }}>
                <div className="w-full h-full rounded-[2rem] bg-white border border-stone-200 shadow-lg" />
              </div>
            )}
            {/* Current card */}
            {loadingId === current?.id ? (
              <div className="absolute inset-0 rounded-[2rem] bg-white flex items-center justify-center shadow-2xl" style={{ zIndex: 20 }}>
                <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
              </div>
            ) : current ? (
              <SwipeCard
                key={current.id}
                tx={current}
                categories={categories}
                onConfirm={handleConfirm}
                onSkip={handleSkip}
                onDelete={handleDelete}
                onChangeCategory={handleChange}
                isTop={true}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Bottom action buttons */}
      {!done && current && (
        <div className="flex items-center justify-center gap-6 px-6 py-8">
          <button
            onClick={handleSkip}
            className="h-14 w-14 rounded-full bg-white shadow-lg border border-stone-200 flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:scale-110 transition-all duration-200"
            title="Omitir (←)"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <div className="text-center text-xs text-stone-400 font-medium">
            <p>← Omitir</p>
            <p className="mt-1">Confirmar →</p>
          </div>
          <button
            onClick={handleConfirm}
            className="h-14 w-14 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center text-white hover:bg-emerald-600 hover:scale-110 transition-all duration-200"
            title="Confirmar (→)"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ClassifyPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [swipeMode, setSwipeMode] = useState(false);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      fetch('/finanzas/api/ai/status').then(r => r.json()).then(setAiStatus).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
    } catch { toast.error('Error cargando datos'); }
  };

  const runClassifyAll = async () => {
    setClassifying(true);
    try {
      const res = await fetch('/finanzas/api/classify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 100 }),
      });
      if (res.ok) {
        const r = await res.json();
        toast.success(`Clasificadas: ${r.keyword} reglas · ${r.ml} ML · ${r.groq} IA · ${r.needs_review} para revisar`);
        fetchAll();
      }
    } catch { toast.error('Error al clasificar'); }
    finally { setClassifying(false); }
  };

  const handleSwipeUpdate = async (id: string, action: 'confirm'|'skip'|'delete'|'change', catId?: string) => {
    if (action === 'confirm') {
      // Already confirmed by AI — just mark as manual
      await fetch(`/finanzas/api/classify`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: id, categoryId: pending.find(t => t.id === id)?.categorySource }),
      }).catch(() => {});
      setPending(p => p.filter(t => t.id !== id));
    } else if (action === 'change' && catId) {
      const res = await fetch('/finanzas/api/classify', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: id, categoryId: catId }),
      });
      if (res.ok) { toast.success('Categoría guardada'); setPending(p => p.filter(t => t.id !== id)); }
      else toast.error('Error al guardar');
    } else if (action === 'delete') {
      const res = await fetch(`/finanzas/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Transacción eliminada'); setPending(p => p.filter(t => t.id !== id)); }
      else toast.error('Error al eliminar');
    }
    // skip: no API call needed
  };

  const coverage = stats ? Math.round(((stats.total - stats.needsReview) / Math.max(stats.total, 1)) * 100) : 0;

  if (swipeMode) {
    return (
      <SwipeMode
        pending={pending}
        categories={categories}
        onExit={() => { setSwipeMode(false); fetchAll(); }}
        onUpdate={handleSwipeUpdate}
      />
    );
  }

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

          {aiStatus?.status !== 'idle' && (
            <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${aiStatus?.status === 'rate_limited' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
              {aiStatus?.status === 'rate_limited' ? <><AlertTriangle className="h-3.5 w-3.5" /><span>Límite alcanzado · Esperando...</span></> : <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>IA trabajando · {aiStatus?.queueSize} en cola</span></>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-full px-6" onClick={runClassifyAll} disabled={classifying}>
            {classifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {classifying ? 'Clasificando...' : 'Clasificar Todo'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total transacciones', value: stats.total, icon: <Database className="h-5 w-5 text-stone-400" />, color: 'text-stone-800' },
            { label: 'Datos de entrenamiento', value: stats.trainingDataSize, icon: <TrendingUp className="h-5 w-5 text-violet-400" />, color: 'text-violet-700' },
            { label: 'Cobertura automática', value: `${coverage}%`, icon: <CheckCircle className="h-5 w-5 text-emerald-400" />, color: 'text-emerald-700' },
            { label: 'Necesitan revisión', value: stats.needsReview, icon: <AlertTriangle className="h-5 w-5 text-rose-400" />, color: 'text-rose-700' },
          ].map(stat => (
            <Card key={stat.label} className="border-stone-100/50 shadow-sm rounded-3xl bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">{stat.icon}<span className={`text-2xl font-serif font-bold ${stat.color}`}>{stat.value}</span></div>
                <p className="text-xs text-stone-400 font-medium leading-tight">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Start Swipe CTA */}
      {pending.length > 0 && (
        <Card className="border-none bg-gradient-to-br from-stone-800 to-stone-950 text-white shadow-xl rounded-3xl overflow-hidden">
          <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-2">Cola de revisión</p>
              <h2 className="text-2xl font-serif font-bold">{pending.length} transacciones esperan tu revisión</h2>
              <p className="text-stone-400 mt-1.5 font-medium text-sm">Desliza para confirmar o cambiar la categoría sugerida por la IA.</p>
            </div>
            <Button
              onClick={() => setSwipeMode(true)}
              className="bg-white text-stone-900 hover:bg-stone-100 rounded-full px-8 h-12 font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex-shrink-0"
            >
              <Sparkles className="h-4 w-4 mr-2 text-violet-600" />
              Iniciar Clasificación
            </Button>
          </CardContent>
        </Card>
      )}

      {pending.length === 0 && stats && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-stone-200 rounded-[3rem] bg-stone-50/50 text-center">
          <CheckCircle className="h-16 w-16 text-emerald-300 mb-4" />
          <p className="text-stone-500 font-semibold text-lg font-serif">¡Todo clasificado!</p>
          <p className="text-stone-400 text-sm mt-1 font-medium">No hay transacciones pendientes de revisión.</p>
        </div>
      )}

      {/* Refresh button */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={fetchAll} className="rounded-full text-stone-400 hover:text-stone-700">
          <RefreshCw className="h-4 w-4 mr-1.5" /> Actualizar
        </Button>
      </div>
    </div>
  );
}
