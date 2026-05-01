'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, UserPlus, Key, Mail, Shield, CheckCircle2, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function HouseholdsPage() {
  const [households, setHouseholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  useEffect(() => {
    fetchHouseholds();
  }, []);

  const fetchHouseholds = async () => {
    const res = await fetch('/api/households');
    if (res.ok) setHouseholds(await res.json());
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setLoading(true);
    try {
        const res = await fetch('/api/households/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: joinCode.toUpperCase() })
        });
        const data = await res.json();
        if (res.ok) {
            toast.success(`Te has unido a ${data.household.name}`);
            setJoinCode('');
            setShowJoinForm(false);
            fetchHouseholds();
        } else {
            toast.error(data.message || 'Error al unirse');
        }
    } catch (err) {
        toast.error('Error de red');
    } finally {
        setLoading(false);
    }
  };

  const generateInviteCode = async (householdId: string) => {
    const res = await fetch('/api/households/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId })
    });
    if (res.ok) {
        toast.success('Código de invitación generado');
        fetchHouseholds(); // Refresh to show new invite
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif text-stone-800">Mi Hogar</h1>
          <p className="text-stone-500 mt-1">Gestiona tus finanzas compartidas y miembros de la familia.</p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={() => setShowJoinForm(!showJoinForm)} className="rounded-xl border-stone-200">
                <Key className="h-4 w-4 mr-2" />
                Unirse con Código
            </Button>
            <Button className="bg-stone-800 hover:bg-stone-900 rounded-xl">
                <UserPlus className="h-4 w-4 mr-2" />
                Crear Nuevo Hogar
            </Button>
        </div>
      </div>

      {showJoinForm && (
          <Card className="border-amber-200 bg-amber-50/30 shadow-sm rounded-2xl animate-in fade-in zoom-in duration-300">
              <CardContent className="p-6 flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                          <Key className="h-6 w-6" />
                      </div>
                      <div>
                          <h3 className="font-medium text-stone-800">Unirse a un hogar</h3>
                          <p className="text-xs text-stone-500">Ingresa el código de 8 caracteres que te enviaron.</p>
                      </div>
                  </div>
                  <div className="flex gap-2 flex-1 max-w-sm">
                      <Input 
                        placeholder="ABC-12345" 
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="bg-white border-amber-200 rounded-xl font-mono uppercase"
                        maxLength={10}
                      />
                      <Button onClick={handleJoin} className="bg-amber-600 hover:bg-amber-700 rounded-xl px-8" disabled={loading}>
                          {loading ? '...' : 'Unirme'}
                      </Button>
                  </div>
              </CardContent>
          </Card>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {households.map(h => (
          <div key={h.id} className="space-y-6">
            <Card className="border-stone-200 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="bg-stone-50/50 border-b border-stone-100">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-serif">{h.name}</CardTitle>
                    <div className="flex -space-x-2">
                        {h.users.map((u: any) => (
                            <div key={u.id} className="h-8 w-8 rounded-full bg-stone-200 border-2 border-white flex items-center justify-center text-xs font-bold text-stone-600" title={u.user.name}>
                                {u.user.name.charAt(0)}
                            </div>
                        ))}
                    </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-stone-400 uppercase tracking-widest mb-4">Integrantes</h4>
                <div className="space-y-4">
                    {h.users.map((u: any) => (
                        <div key={u.id} className="flex justify-between items-center">
                            <div className="flex items-center">
                                <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center mr-3">
                                    <Users className="h-5 w-5 text-stone-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-stone-800">{u.user.name}</p>
                                    <p className="text-xs text-stone-400">{u.user.email}</p>
                                </div>
                            </div>
                            {u.role === 'ADMIN' ? (
                                <div className="flex items-center text-xs font-medium text-stone-500 bg-stone-50 px-2 py-1 rounded-md">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                </div>
                            ) : (
                                <button className="text-stone-300 hover:text-red-500 transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
              </CardContent>
              <CardFooter className="bg-stone-50/30 border-t border-stone-50 mt-4 flex flex-col items-stretch p-6 space-y-4">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-stone-600">
                          <Key className="h-4 w-4 mr-2 text-stone-400" />
                          Invitaciones Activas
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-stone-500 hover:text-stone-900"
                        onClick={() => generateInviteCode(h.id)}
                      >
                          Generar Nuevo
                      </Button>
                  </div>
                  
                  <div className="space-y-2">
                      {h.invitations && h.invitations.map((inv: any) => (
                          <div key={inv.id} className="bg-white border border-stone-100 rounded-xl p-3 flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                  <div className="text-lg font-mono font-bold text-stone-800">{inv.code}</div>
                                  <div className="text-[10px] text-stone-400 uppercase font-medium">
                                      Vence el {new Date(inv.expiresAt).toLocaleDateString()}
                                  </div>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(inv.code)} className="rounded-lg h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Copy className="h-4 w-4" />
                              </Button>
                          </div>
                      ))}
                      {(!h.invitations || h.invitations.length === 0) && (
                          <p className="text-center text-xs text-stone-400 py-2">No hay códigos activos.</p>
                      )}
                  </div>
              </CardFooter>
            </Card>

            <Card className="border-stone-200 shadow-sm rounded-2xl bg-stone-50/50 p-6">
                <div className="flex items-center mb-4">
                    <Mail className="h-5 w-5 text-stone-400 mr-2" />
                    <h4 className="font-medium text-stone-800">Invitación por Email</h4>
                </div>
                <div className="flex gap-2">
                    <Input placeholder="correo@familia.com" className="bg-white border-stone-200 rounded-xl" />
                    <Button variant="outline" className="rounded-xl">Enviar</Button>
                </div>
            </Card>
          </div>
        ))}

        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/20 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-white shadow-sm flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-stone-300" />
            </div>
            <div>
                <h3 className="font-serif text-xl text-stone-700">Privacidad y Control</h3>
                <p className="text-sm text-stone-400 max-w-xs mt-2">
                    Las cuentas compartidas solo son visibles para los miembros autorizados de tu hogar. Tus cuentas personales permanecen privadas.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
