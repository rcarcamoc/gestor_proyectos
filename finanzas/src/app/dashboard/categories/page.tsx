'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Tags, Plus, Search, Palette, Loader2, Home, User, ShieldCheck } from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [households, setHouseholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // New category form
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7c3aed');
  const [targetType, setTargetType] = useState('PERSONAL');
  const [selectedHousehold, setSelectedHousehold] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const [catRes, houseRes] = await Promise.all([
            fetch('/api/categories'),
            fetch('/api/households')
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (houseRes.ok) setHouseholds(await houseRes.json());
    } catch (err) {
        toast.error("Error al cargar datos");
    } finally {
        setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName) return;
    setLoading(true);
    try {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newName,
                color: newColor,
                householdId: targetType === 'HOUSEHOLD' ? selectedHousehold : null
            })
        });
        if (res.ok) {
            toast.success("Categoría creada");
            setIsCreating(false);
            setNewName('');
            fetchData();
        } else {
            toast.error("Error al crear categoría");
        }
    } catch (err) {
        toast.error("Error de conexión");
    } finally {
        setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Categorías</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Clasifica tus gastos para un mejor análisis.</p>
        </div>
        <Button 
            className="bg-stone-800 hover:bg-stone-900 rounded-full shadow-sm hover:shadow-md transition-all duration-300"
            onClick={() => setIsCreating(true)}
        >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Categoría
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-3xl border border-stone-100 shadow-sm">
        <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input 
                placeholder="Buscar categoría..." 
                className="pl-11 rounded-2xl border-stone-100 bg-white/50 focus-visible:ring-stone-200 h-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isCreating && (
            <Card className="border-stone-200 shadow-xl rounded-3xl bg-white animate-in zoom-in duration-300 overflow-hidden">
                <CardHeader className="bg-stone-50/50 border-b border-stone-100">
                    <CardTitle className="text-lg font-serif">Crear Categoría</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)} 
                            placeholder="Ej: Gimnasio" 
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex gap-2 items-center">
                            <Input 
                                type="color" 
                                value={newColor} 
                                onChange={e => setNewColor(e.target.value)} 
                                className="w-12 h-10 p-1 rounded-lg border-stone-200"
                            />
                            <span className="text-sm font-mono text-stone-500">{newColor}</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Alcance</Label>
                        <Select value={targetType} onValueChange={(v) => setTargetType(v || 'PERSONAL')}>
                            <SelectTrigger className="rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="PERSONAL">Personal</SelectItem>
                                <SelectItem value="HOUSEHOLD">De Hogar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {targetType === 'HOUSEHOLD' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <Label>Hogar</Label>
                            <Select value={selectedHousehold} onValueChange={(v) => setSelectedHousehold(v || '')}>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Seleccionar hogar..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {households.map(h => (
                                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-stone-50/50 border-t border-stone-100 flex justify-end gap-2 p-4">
                    <Button variant="ghost" className="rounded-full" onClick={() => setIsCreating(false)}>Cancelar</Button>
                    <Button className="bg-stone-800 hover:bg-stone-900 rounded-full px-6" onClick={handleCreate} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Guardar
                    </Button>
                </CardFooter>
            </Card>
        )}

        {filteredCategories.map(cat => (
            <Card key={cat.id} className="border-stone-100/50 shadow-sm rounded-3xl bg-white hover:shadow-md transition-all duration-300 group">
                <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div 
                            className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 duration-500"
                            style={{ backgroundColor: cat.color || '#stone-200' }}
                        >
                            <Tags className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-stone-800 truncate">{cat.name}</h3>
                            <div className="flex items-center mt-1">
                                {cat.isDefault ? (
                                    <span className="flex items-center text-[10px] uppercase tracking-widest font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                                        <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                                        Sistema
                                    </span>
                                ) : cat.householdId ? (
                                    <span className="flex items-center text-[10px] uppercase tracking-widest font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        <Home className="h-2.5 w-2.5 mr-1" />
                                        Hogar
                                    </span>
                                ) : (
                                    <span className="flex items-center text-[10px] uppercase tracking-widest font-bold text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full">
                                        <User className="h-2.5 w-2.5 mr-1" />
                                        Personal
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        ))}
      </div>

      {filteredCategories.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-stone-200 rounded-[3rem] bg-stone-50/50 text-center">
            <Tags className="h-16 w-16 text-stone-200 mb-4" />
            <p className="text-stone-500 font-medium">No se encontraron categorías.</p>
            <Button variant="link" className="text-stone-400" onClick={() => setSearch('')}>Limpiar búsqueda</Button>
        </div>
      )}
    </div>
  );
}
