'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, UserPlus, Users } from 'lucide-react';

export default function HouseholdPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchHouseholds();
  }, []);

  const fetchHouseholds = async () => {
    const res = await fetch('/api/households');
    if (res.ok) {
      const data = await res.json();
      setHouseholds(data);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        toast.success('Hogar creado');
        setNewName('');
        fetchHouseholds();
      } else {
        toast.error('Error al crear hogar');
      }
    } catch (error) {
      toast.error('Error de red');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      });
      if (res.ok) {
        toast.success('Te has unido al hogar');
        setJoinCode('');
        fetchHouseholds();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Error al unirse');
      }
    } catch (error) {
      toast.error('Error de red');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Gestión de Hogar</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> Crear Nuevo Hogar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Hogar</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Casa Central"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                Crear
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Unirse a un Hogar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de Invitación</Label>
                <Input
                  id="code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="ABC123XY"
                  required
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full" disabled={isLoading}>
                Unirse
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Mis Hogares
          </CardTitle>
        </CardHeader>
        <CardContent>
          {households.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No perteneces a ningún hogar todavía.</p>
          ) : (
            <div className="space-y-4">
              {households.map((h) => (
                <div key={h.id} className="p-4 border rounded-lg flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{h.name}</h3>
                    <p className="text-sm text-gray-500">
                      {h.users.length} miembros
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => {/* TODO: Manage household */}}>
                    Administrar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
