'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Smartphone, 
  RefreshCw, 
  AlertTriangle, 
  Check, 
  Loader2,
  Lock,
  ArrowRightLeft,
  Trash2
} from 'lucide-react';

export default function LinkDevicePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [migrationType, setMigrationType] = useState<'merge' | 'overwrite_server'>('merge');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pre-fill email and household from search query if provided
  const emailFromUrl = searchParams.get('email') || '';
  const householdIdFromUrl = searchParams.get('householdId') || '';
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
    } else if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, [session, emailFromUrl]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/dashboard/link-device?householdId=${householdIdFromUrl}&email=${emailFromUrl}`)}`);
      return;
    }
    if (status === 'authenticated') {
      fetchHouseholds();
    }
  }, [status]);

  const fetchHouseholds = async () => {
    try {
      const res = await fetch('/finanzas/api/households');
      if (res.ok) {
        const data = await res.json();
        setHouseholds(data);
        if (data.length > 0) {
          const matched = data.find((h: any) => h.id === householdIdFromUrl);
          setSelectedHouseholdId(matched ? matched.id : data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar hogares');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouseholdId) {
      toast.error('Por favor, selecciona un hogar');
      return;
    }
    if (!password) {
      toast.error('Introduce tu contraseña para confirmar la vinculación');
      return;
    }

    setVerifying(true);
    try {
      // Validate credentials against the server
      const checkRes = await fetch('/finanzas/api/sync/verify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password })
      });

      if (!checkRes.ok) {
        const errData = await checkRes.json();
        toast.error(errData.message || 'Contraseña incorrecta');
        setVerifying(false);
        return;
      }

      // Fetch selected household name to pass in the deep link
      const selectedHousehold = households.find(h => h.id === selectedHouseholdId);
      const householdNameParam = selectedHousehold ? `&householdName=${encodeURIComponent(selectedHousehold.name)}` : '';

      // Build the deep link URL with action and credentials
      const redirectUri = `controlfinanzas://sync?email=${encodeURIComponent(email)}&householdId=${selectedHouseholdId}&password=${encodeURIComponent(password)}&action=${migrationType}${householdNameParam}`;
      
      toast.success('¡Credenciales válidas! Redirigiendo a la aplicación...');
      
      // Redirect to the Android app deep link
      window.location.href = redirectUri;
    } catch (err) {
      toast.error('Error al verificar credenciales');
    } finally {
      setVerifying(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-stone-500" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif text-stone-800 tracking-tight flex items-center gap-3">
          <Smartphone className="h-8 w-8 text-stone-700" />
          Vincular Dispositivo Móvil
        </h1>
        <p className="text-stone-500 mt-1.5 font-medium">Asistente guiado de sincronización para tu App Android.</p>
      </div>

      <form onSubmit={handleLink}>
        <Card className="border-stone-150 shadow-md rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-stone-50/40 border-b border-stone-100 p-6">
            <CardTitle className="text-xl font-serif text-stone-800">Paso 1: Configurar la Sincronización</CardTitle>
            <CardDescription>Selecciona cómo sincronizar los datos de tu teléfono con el portal web.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* Paso 1: Seleccionar Hogar */}
            <div className="space-y-2.5">
              <Label className="text-stone-700 font-semibold">1. Selecciona el Hogar Compartido</Label>
              {households.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm">
                  No tienes ningún hogar creado. Primero debes crear un hogar en la sección "Mi Hogar" para poder sincronizar.
                </div>
              ) : (
                <select
                  value={selectedHouseholdId}
                  onChange={(e) => setSelectedHouseholdId(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-2xl h-11 px-4 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-500/20"
                >
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Paso 2: Tipo de Migración */}
            <div className="space-y-3">
              <Label className="text-stone-700 font-semibold">2. ¿Cómo deseas tratar los datos actuales?</Label>
              
              <div className="grid gap-3">
                {/* Opción A: Fusión */}
                <div 
                  onClick={() => setMigrationType('merge')}
                  className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-start gap-4 ${
                    migrationType === 'merge' 
                      ? 'border-stone-800 bg-stone-50/50 shadow-sm' 
                      : 'border-stone-200 hover:bg-stone-50/30'
                  }`}
                >
                  <div className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                    migrationType === 'merge' ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300'
                  }`}>
                    {migrationType === 'merge' && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <div className="font-semibold text-stone-800 text-sm flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4" />
                      Fusión Inteligente Bidireccional (Recomendado)
                    </div>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Mezcla los datos de tu teléfono y los que ya existen en la web. No se borra nada de ningún lado y se actualizan los registros modificados.
                    </p>
                  </div>
                </div>

                {/* Opción B: Sobrescribir Web */}
                <div 
                  onClick={() => setMigrationType('overwrite_server')}
                  className={`p-4 border rounded-2xl cursor-pointer transition-all flex items-start gap-4 ${
                    migrationType === 'overwrite_server' 
                      ? 'border-rose-500 bg-rose-50/20 shadow-sm' 
                      : 'border-stone-200 hover:bg-stone-50/30'
                  }`}
                >
                  <div className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                    migrationType === 'overwrite_server' ? 'border-rose-500 bg-rose-500 text-white' : 'border-stone-300'
                  }`}>
                    {migrationType === 'overwrite_server' && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <div className="font-semibold text-stone-800 text-sm flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-rose-500" />
                      Mantener datos de la App y borrar datos actuales de la Web
                    </div>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Limpia por completo las transacciones, sueldos, deudas y presupuestos en el servidor para este hogar, y los reemplaza únicamente con los datos que tienes actualmente en tu teléfono.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {migrationType === 'overwrite_server' && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 text-rose-800 text-xs">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <span className="font-bold">¡Atención!</span> Esta acción eliminará permanentemente todos los datos actuales del hogar seleccionado en la web. Solo debe usarse si deseas que tu celular sea la única fuente de verdad inicial.
                </div>
              </div>
            )}

            {/* Paso 3: Confirmación de Correo y Contraseña */}
            <div className="space-y-3 pt-2">
              <Label className="text-stone-700 font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-stone-400" />
                3. Confirma tus Datos de Acceso
              </Label>

              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500 font-semibold">Correo Electrónico</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  readOnly={!!session?.user?.email}
                  className={`rounded-2xl h-11 border-stone-200 shadow-sm ${
                    session?.user?.email ? 'bg-stone-50 text-stone-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500 font-semibold">Contraseña del Portal</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce tu contraseña"
                  className="rounded-2xl h-11 border-stone-200 shadow-sm"
                />
              </div>

              <p className="text-[10px] text-stone-400 font-medium">
                Esto es necesario para verificar tu identidad y configurar de forma segura la autenticación automática en la app.
              </p>
            </div>

          </CardContent>
          <CardFooter className="bg-stone-50/20 border-t border-stone-100 p-6 flex justify-between items-center">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => router.back()}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={verifying || households.length === 0}
              className={`rounded-full px-8 h-11 font-medium transition-all ${
                migrationType === 'overwrite_server' 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                  : 'bg-stone-800 hover:bg-stone-900 text-white'
              }`}
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verificando...
                </>
              ) : (
                'Vincular y Abrir App'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
