'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  UserPlus, 
  Key, 
  Mail, 
  Shield, 
  CheckCircle2, 
  Copy, 
  Trash2,
  Loader2 
} from 'lucide-react';
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

export default function HouseholdsPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || '';

  const [households, setHouseholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');

  useEffect(() => {
    fetchHouseholds();
  }, []);

  const handleCreateHousehold = async () => {
    if (!newHouseholdName) return;
    setLoading(true);
    try {
        const res = await fetch('/finanzas/api/households', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newHouseholdName })
        });
        if (res.ok) {
            toast.success("Hogar creado con éxito");
            setIsCreateModalOpen(false);
            setNewHouseholdName('');
            fetchHouseholds();
        } else {
            toast.error("Error al crear hogar");
        }
    } catch (err) {
        toast.error("Error de conexión");
    } finally {
        setLoading(false);
    }
  };

  const fetchHouseholds = async () => {
    try {
      const res = await fetch('/finanzas/api/households');
      if (res.ok) {
        setHouseholds(await res.json());
      } else if (res.status === 401) {
        toast.error("Sesión expirada");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setLoading(true);
    try {
        const res = await fetch('/finanzas/api/households/join', {
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
    const res = await fetch('/finanzas/api/households/invite', {
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
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Mi Hogar</h1>
          <p className="text-stone-500 mt-1.5 font-medium">Gestiona tus finanzas compartidas y miembros de la familia.</p>
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={() => setShowJoinForm(!showJoinForm)} className="rounded-full border-stone-200/60 shadow-sm hover:bg-stone-50 transition-all duration-300">
                <Key className="h-4 w-4 mr-2" />
                Unirse con Código
            </Button>
            <Button 
                className="bg-stone-800 hover:bg-stone-900 rounded-full shadow-sm hover:shadow-md transition-all duration-300"
                onClick={() => setIsCreateModalOpen(true)}
            >
                <UserPlus className="h-4 w-4 mr-2" />
                Crear Nuevo Hogar
            </Button>
        </div>
      </div>

      {showJoinForm && (
          <Card className="border-amber-200/60 bg-amber-50/50 backdrop-blur-sm shadow-sm rounded-3xl animate-in fade-in zoom-in duration-300">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-5 w-full sm:w-auto">
                      <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-amber-500 shrink-0">
                          <Key className="h-6 w-6" />
                      </div>
                      <div>
                          <h3 className="font-semibold text-stone-800 text-lg">Unirse a un hogar</h3>
                          <p className="text-sm text-stone-500 mt-0.5">Ingresa el código de 8 caracteres que te enviaron.</p>
                      </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto flex-1 max-w-sm">
                      <Input 
                        placeholder="ABC-12345" 
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="bg-white border-amber-200/60 rounded-full font-mono uppercase h-11 text-center tracking-widest shadow-inner focus-visible:ring-amber-200"
                        maxLength={10}
                      />
                      <Button onClick={handleJoin} className="bg-amber-500 hover:bg-amber-600 rounded-full px-8 h-11 shadow-sm transition-all" disabled={loading}>
                          {loading ? '...' : 'Unirme'}
                      </Button>
                  </div>
              </CardContent>
          </Card>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {households.map(h => (
          <div key={h.id} className="space-y-6">
            <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden hover:shadow-md transition-shadow duration-300">
              <CardHeader className="bg-stone-50/30 border-b border-stone-100/60 p-6">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl font-serif text-stone-800 tracking-tight">{h.name}</CardTitle>
                    <div className="flex -space-x-3">
                        {h.users.map((u: any) => (
                            <div key={u.id} className="h-10 w-10 rounded-full bg-stone-200 border-2 border-white flex items-center justify-center text-sm font-bold text-stone-600 shadow-sm" title={u.user.name}>
                                {u.user.name.charAt(0).toUpperCase()}
                            </div>
                        ))}
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-5">Integrantes</h4>
                <div className="space-y-4">
                    {h.users.map((u: any) => (
                        <div key={u.id} className="flex justify-between items-center group">
                            <div className="flex items-center">
                                <div className="h-11 w-11 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                                    <Users className="h-5 w-5 text-stone-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-stone-800">{u.user.name}</p>
                                    <p className="text-xs text-stone-500">{u.user.email}</p>
                                </div>
                            </div>
                            {u.role === 'ADMIN' ? (
                                <div className="flex items-center text-xs font-semibold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-full">
                                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                                    Admin
                                </div>
                            ) : (
                                <button className="text-stone-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-all">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Vincular App Móvil */}
                <div className="mt-6 pt-6 border-t border-stone-100/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex-1">
                    <h5 className="font-semibold text-stone-800 text-sm">Sincronización Móvil</h5>
                    <p className="text-xs text-stone-400 mt-1 font-medium leading-relaxed">
                      Vincula la app Android con este hogar. Pulsa el botón si estás en tu móvil o escanea el QR con tu cámara.
                    </p>
                    <div className="mt-3">
                      <a 
                        href={`controlfinanzas://sync?email=${encodeURIComponent(userEmail)}&householdId=${h.id}`}
                        className="inline-flex items-center text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200/80 px-4 py-2 rounded-full transition-all duration-300 shadow-sm"
                      >
                        Vincular esta App
                      </a>
                    </div>
                  </div>
                  {userEmail && (
                    <div className="shrink-0 p-2 bg-stone-50/50 border border-stone-100 rounded-2xl flex flex-col items-center">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`controlfinanzas://sync?email=${userEmail}&householdId=${h.id}`)}`}
                        alt="QR Vincular App" 
                        className="w-20 h-20 rounded-lg shadow-sm"
                      />
                      <span className="text-[10px] text-stone-400 mt-1.5 font-bold tracking-tight">Escanear QR</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="bg-stone-50/30 border-t border-stone-100/60 flex flex-col items-stretch p-6 space-y-5">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm font-medium text-stone-600">
                          <Key className="h-4 w-4 mr-2 text-stone-400" />
                          Invitaciones Activas
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-stone-500 hover:text-stone-900 rounded-full font-medium"
                        onClick={() => generateInviteCode(h.id)}
                      >
                          Generar Nuevo
                      </Button>
                  </div>
                  
                  <div className="space-y-3">
                      {h.invitations && h.invitations.map((inv: any) => (
                          <div key={inv.id} className="bg-white border border-stone-200/60 rounded-2xl p-4 flex items-center justify-between group shadow-sm">
                              <div className="flex items-center gap-4">
                                  <div className="text-xl font-mono font-bold text-stone-800 tracking-wider bg-stone-50 px-3 py-1 rounded-lg">{inv.code}</div>
                                  <div className="text-xs text-stone-400 uppercase font-semibold">
                                      Vence el {new Date(inv.expiresAt).toLocaleDateString()}
                                  </div>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(inv.code)} className="rounded-xl h-10 w-10 text-stone-400 hover:text-stone-700 bg-stone-50 opacity-0 group-hover:opacity-100 transition-all">
                                  <Copy className="h-4 w-4" />
                              </Button>
                          </div>
                      ))}
                      {(!h.invitations || h.invitations.length === 0) && (
                          <p className="text-center text-sm text-stone-400 py-4 italic font-medium">No hay códigos activos.</p>
                      )}
                  </div>
              </CardFooter>
            </Card>

            <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-stone-50/50 p-6 sm:p-8">
                <div className="flex items-center mb-5">
                    <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center mr-3">
                        <Mail className="h-5 w-5 text-stone-400" />
                    </div>
                    <h4 className="font-semibold text-stone-800 text-lg tracking-tight">Invitación por Email</h4>
                </div>
                <div className="flex gap-3">
                    <Input placeholder="correo@familia.com" className="bg-white border-stone-200/60 rounded-full h-11 focus-visible:ring-stone-200 shadow-sm" />
                    <Button variant="outline" className="rounded-full h-11 px-6 border-stone-200/60 shadow-sm hover:bg-stone-50">Enviar</Button>
                </div>
            </Card>
          </div>
        ))}
        </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="rounded-[2rem] border-stone-100 shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-stone-800">Crear Nuevo Hogar</DialogTitle>
            <DialogDescription>
                Crea un espacio compartido para gestionar gastos con tu pareja o familia.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
                <Label>Nombre del Hogar</Label>
                <Input 
                    placeholder="Ej: Hogar Pérez-García" 
                    className="rounded-xl border-stone-200"
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
            <Button 
                className="bg-stone-800 hover:bg-stone-900 rounded-full px-8" 
                onClick={handleCreateHousehold} 
                disabled={loading || !newHouseholdName}
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Crear Hogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
