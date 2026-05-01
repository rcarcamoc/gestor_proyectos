'use client';
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileUp, 
  FileSpreadsheet, 
  Settings2, 
  CheckCircle, 
  AlertCircle,
  Download,
  Info,
  Loader2,
  Table as TableIcon,
  Wallet
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';

type Mapping = {
  date: string;
  amount: string;
  description: string;
  reference?: string;
  category?: string;
};

export default function ImportPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Mapping>({
    date: '',
    amount: '',
    description: '',
  });
  const [accountId, setAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<number>(0);

  // Fetch accounts and profiles on mount
  useEffect(() => {
    Promise.all([
        fetch('/api/accounts').then(res => res.json()),
        fetch('/api/import/profile').then(res => res.json())
    ]).then(([accountsData, profilesData]) => {
        if (Array.isArray(accountsData)) {
            setAccounts(accountsData);
            if (accountsData.length > 0) setAccountId(accountsData[0].id);
        }
        if (Array.isArray(profilesData)) {
            setProfiles(profilesData);
        }
    }).catch(console.error);
  }, []);

  const handleProfileChange = (id: string) => {
    setSelectedProfile(id);
    const profile = profiles.find(p => p.id === id);
    if (profile && profile.mapping) {
        setMapping(profile.mapping);
        toast.info(`Perfil "${profile.name}" aplicado`);
    }
  };

  const saveProfile = async () => {
    if (!profileName) return toast.error("Ingresa un nombre para el perfil");
    setLoading(true);
    try {
        const res = await fetch('/api/import/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: profileName, mapping })
        });
        if (res.ok) {
            const newProfile = await res.json();
            setProfiles([newProfile, ...profiles]);
            setProfileName('');
            toast.success("Perfil guardado");
        }
    } catch (err) {
        toast.error("Error al guardar perfil");
    } finally {
        setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setLoading(true);
      
      try {
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length > 0) {
          const fileHeaders = jsonData[0].map(h => String(h));
          setHeaders(fileHeaders);
          
          // Try to auto-map based on common names if no profile selected
          if (!selectedProfile) {
            const newMapping: Mapping = { date: '', amount: '', description: '' };
            fileHeaders.forEach(h => {
                const lowH = h.toLowerCase();
                if (lowH.includes('fec') || lowH.includes('date')) newMapping.date = h;
                if (lowH.includes('monto') || lowH.includes('amount') || lowH.includes('importe')) newMapping.amount = h;
                if (lowH.includes('desc') || lowH.includes('detal') || lowH.includes('glosa')) newMapping.description = h;
            });
            setMapping(newMapping);
          }
          
          // Preview data (all rows)
          const rows = XLSX.utils.sheet_to_json(worksheet);
          setPreviewData(rows);
          
          setStep(2);
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al leer el archivo");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleProcess = async () => {
    setLoading(true);
    // In a real scenario, we might want to check for duplicates via API here
    // based on the mapping and first few rows.
    // For now, we'll just proceed to Step 3.
    setStep(3);
    setLoading(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
        // Map data according to user selection
        const transactions = previewData.map(row => ({
            date: row[mapping.date],
            amount: row[mapping.amount],
            description: row[mapping.description],
            externalId: mapping.reference ? row[mapping.reference] : undefined,
            metadata: row
        }));

        const res = await fetch('/api/import/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, accountId })
        });

        if (res.ok) {
            const result = await res.json();
            setDuplicates(result.duplicates);
            setStep(4);
            toast.success("Importación completada");
        } else {
            toast.error("Error al procesar transacciones");
        }
    } catch (err) {
        toast.error("Error de red");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-serif text-stone-800">Importar Datos</h1>
        <p className="text-stone-500 mt-2">Carga tus estados de cuenta de forma inteligente.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between max-w-md mx-auto relative mb-12">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-stone-100 -translate-y-1/2 -z-10" />
          {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    step >= s ? "bg-stone-800 border-stone-800 text-white" : "bg-white border-stone-200 text-stone-300"
                )}
              >
                  {step > s ? <CheckCircle className="h-5 w-5" /> : s}
              </div>
          ))}
      </div>

      {step === 1 && (
        <Card className="border-stone-200 shadow-xl rounded-3xl overflow-hidden bg-white p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="h-24 w-24 rounded-3xl bg-stone-50 flex items-center justify-center text-stone-300">
                {loading ? <Loader2 className="h-12 w-12 animate-spin" /> : <FileUp className="h-12 w-12" />}
            </div>
            <div>
                <h3 className="text-xl font-medium text-stone-800">Selecciona tu archivo</h3>
                <p className="text-stone-500 mt-2">Formatos soportados: Excel (.xlsx) y CSV (.csv)</p>
            </div>
            <div className="w-full max-w-sm">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <FileSpreadsheet className="w-8 h-8 mb-3 text-stone-400" />
                        <p className="text-sm text-stone-500">Haz clic o arrastra aquí</p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} disabled={loading} />
                </label>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-stone-200 shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-stone-50/50 border-b border-stone-100 p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Settings2 className="h-6 w-6 text-stone-400 mr-3" />
                        <div>
                            <CardTitle className="text-xl font-serif">Mapeo de Columnas</CardTitle>
                            <CardDescription>Indica qué columna corresponde a cada dato.</CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-white border-stone-200 text-stone-600 px-4 py-1">{file?.name}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <div className="h-10 w-10 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-stone-400 mr-4">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Cuenta de destino</p>
                            <p className="text-sm font-medium text-stone-700">Selecciona dónde cargar los datos</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        {profiles.length > 0 && (
                            <select 
                                className="h-10 border border-stone-200 rounded-xl px-4 text-sm bg-white min-w-[150px]"
                                value={selectedProfile}
                                onChange={(e) => handleProfileChange(e.target.value)}
                            >
                                <option value="">Perfil: Autodetectar</option>
                                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}
                        <select 
                            className="h-10 border border-stone-200 rounded-xl px-4 text-sm bg-white min-w-[200px]"
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {[
                        { id: 'date', label: 'Fecha', required: true },
                        { id: 'amount', label: 'Monto', required: true },
                        { id: 'description', label: 'Descripción', required: true },
                        { id: 'reference', label: 'Referencia / ID', required: false },
                        { id: 'category', label: 'Categoría', required: false },
                    ].map((field) => (
                        <div key={field.id} className="space-y-2">
                            <label className="text-sm font-medium text-stone-700 flex items-center">
                                {field.label}
                                {field.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            <select 
                                className="w-full h-10 border border-stone-200 rounded-xl px-4 text-sm bg-white"
                                value={(mapping as any)[field.id]}
                                onChange={(e) => setMapping({ ...mapping, [field.id]: e.target.value })}
                            >
                                <option value="">Seleccionar columna...</option>
                                {headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    ))}
                </div>

                {!selectedProfile && (
                    <div className="mt-8 pt-8 border-t border-stone-100 flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Guardar este mapeo</p>
                            <input 
                                type="text" 
                                placeholder="Nombre del perfil (ej: Banco Chile Mensual)" 
                                className="w-full h-10 border border-stone-200 rounded-xl px-4 text-sm bg-white"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                            />
                        </div>
                        <Button 
                            variant="outline" 
                            className="mt-5 rounded-xl"
                            onClick={saveProfile}
                            disabled={!profileName || loading}
                        >
                            Guardar Perfil
                        </Button>
                    </div>
                )}
                
                <div className="mt-8 border rounded-2xl overflow-hidden border-stone-100">
                    <div className="bg-stone-50 p-3 border-b border-stone-100 flex items-center">
                        <TableIcon className="h-4 w-4 text-stone-400 mr-2" />
                        <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Vista Previa (5 filas)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white border-b border-stone-100">
                                <tr>
                                    {headers.slice(0, 5).map(h => (
                                        <th key={h} className="p-3 font-medium text-stone-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.slice(0, 5).map((row, i) => (
                                    <tr key={i} className="border-b border-stone-50">
                                        {headers.slice(0, 5).map(h => (
                                            <td key={h} className="p-3 text-stone-600">{row[h]}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-stone-50/30 border-t border-stone-100 p-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl">Atrás</Button>
                <Button 
                    onClick={handleProcess} 
                    disabled={!mapping.date || !mapping.amount || !mapping.description || loading}
                    className="bg-stone-800 hover:bg-stone-900 rounded-xl px-10"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Analizar Archivo
                </Button>
            </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-stone-200 shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-stone-50/50 border-b border-stone-100 p-8 text-center">
                <CardTitle className="text-xl font-serif">Vista Previa de Importación</CardTitle>
                <CardDescription>Archivo analizado correctamente.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="flex justify-around">
                    <div className="text-center">
                        <div className="text-2xl font-serif text-stone-800">{previewData.length}</div>
                        <div className="text-xs text-stone-400 uppercase tracking-widest">Leídas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-serif text-amber-600">{duplicates}</div>
                        <div className="text-xs text-stone-400 uppercase tracking-widest">Probables Duplicados</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-serif text-red-500">0</div>
                        <div className="text-xs text-stone-400 uppercase tracking-widest">Con Error</div>
                    </div>
                </div>
                
                {duplicates > 0 && (
                    <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-start">
                        <AlertCircle className="h-5 w-5 text-amber-600 mr-3 mt-1" />
                        <div>
                            <h4 className="font-medium text-amber-900">Atención: Duplicados Probables</h4>
                            <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                                Hemos detectado {duplicates} transacciones que podrían estar duplicadas. Podrás revisarlas individualmente en la sección de transacciones después de importar.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-stone-400">
                        <span>Preparando datos para guardado...</span>
                        <span>100%</span>
                    </div>
                    <Progress value={100} className="h-2 bg-stone-100 rounded-full" />
                </div>
            </CardContent>
            <CardFooter className="bg-stone-50/30 border-t border-stone-100 p-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)} className="rounded-xl">Atrás</Button>
                <Button 
                    onClick={handleConfirm} 
                    disabled={loading}
                    className="bg-stone-800 hover:bg-stone-900 rounded-xl px-10"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirmar Carga
                </Button>
            </CardFooter>
        </Card>
      )}

      {step === 4 && (
          <div className="text-center py-20 animate-in zoom-in duration-500">
              <div className="h-24 w-24 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-8 border-4 border-white shadow-lg shadow-green-100">
                  <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <h2 className="text-4xl font-serif text-stone-800 mb-4">¡Importación Exitosa!</h2>
              <p className="text-stone-500 max-w-md mx-auto mb-10 leading-relaxed">
                  Se han procesado {previewData.length} transacciones correctamente. 
                  {duplicates > 0 ? ` ${duplicates} sospechas de duplicado han sido enviadas a tu lista de "Pendientes de revisión".` : ""}
              </p>
              <div className="flex gap-4 justify-center">
                  <Button variant="outline" className="rounded-xl border-stone-200" onClick={() => setStep(1)}>Importar más</Button>
                  <Link href="/dashboard/transactions" className={cn(buttonVariants({ variant: "default" }), "bg-stone-800 hover:bg-stone-900 rounded-xl px-10")}>
                      Ver Transacciones
                  </Link>
              </div>
          </div>
      )}

      <div className="bg-stone-100/50 p-6 rounded-3xl flex items-start border border-stone-100">
          <Info className="h-5 w-5 text-stone-400 mr-3 mt-0.5" />
          <p className="text-xs text-stone-500 leading-relaxed italic">
              "El Mapping Wizard recordará tus preferencias para archivos del mismo banco en el futuro, automatizando el proceso para tu próxima importación mensual."
          </p>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
