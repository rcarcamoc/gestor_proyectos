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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getMonthOptions, formatBillingPeriod } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type Mapping = {
  date: string;
  amount: string;
  description: string;
  reference?: string;
  category?: string;
  cardType?: string;
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
    cardType: '',
  });
  const [accountId, setAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<number>(0);
  const [billingPeriod, setBillingPeriod] = useState<string>(formatBillingPeriod(new Date()));

  // Fetch accounts and profiles on mount
  useEffect(() => {
    Promise.all([
        fetch('/finanzas/api/accounts').then(res => res.json()),
        fetch('/finanzas/api/import/profile').then(res => res.json())
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
        const res = await fetch('/finanzas/api/import/profile', {
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
          // Detect header row (first row that looks like a header)
          let headerRowIndex = 0;
          for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
            const row = jsonData[i];
            if (row.some(c => String(c).toLowerCase().includes('fec')) && 
                row.some(c => String(c).toLowerCase().includes('mont')) &&
                (row.some(c => String(c).toLowerCase().includes('desc')) || row.some(c => String(c).toLowerCase().includes('glos')))) {
              headerRowIndex = i;
              break;
            }
          }

          const fileHeaders = jsonData[headerRowIndex].map(h => String(h));
          setHeaders(fileHeaders);
          
          // Try to auto-map based on common names if no profile selected
          if (!selectedProfile) {
            const newMapping: Mapping = { date: '', amount: '', description: '' };
            fileHeaders.forEach(h => {
                const lowH = h.toLowerCase();
                if (lowH.includes('fec') || lowH.includes('date')) newMapping.date = h;
                if (lowH.includes('monto') || lowH.includes('amount') || lowH.includes('importe')) newMapping.amount = h;
                if (lowH.includes('desc') || lowH.includes('detal') || lowH.includes('glosa')) newMapping.description = h;
                if (lowH.includes('tarjeta') || lowH.includes('card') || lowH.includes('tipo')) newMapping.cardType = h;
            });
            setMapping(newMapping);
          }
          
          // Preview data (from header row onwards)
          const rows = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
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
    if (!mapping.date || !mapping.amount || !mapping.description) {
        return toast.error("Por favor completa el mapeo de columnas obligatorias");
    }
    if (!accountId) {
        return toast.error("Debes seleccionar una cuenta de destino");
    }
    setLoading(true);
    try {
        // Map data according to user selection for dry run
        const transactions = previewData.map(row => ({
            date: row[mapping.date],
            amount: row[mapping.amount],
            description: row[mapping.description],
            externalId: mapping.reference ? row[mapping.reference] : undefined,
            cardType: mapping.cardType ? row[mapping.cardType] : undefined,
            metadata: row
        }));

        const res = await fetch('/finanzas/api/import/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions, accountId, dryRun: true })
        });

        if (res.ok) {
            const result = await res.json();
            setDuplicates(result.duplicates);
            setStep(3);
        } else {
            toast.error("Error al analizar el archivo");
        }
    } catch (err) {
        toast.error("Error de conexión");
    } finally {
        setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!accountId) return toast.error("Selecciona una cuenta de destino");
    setLoading(true);
    try {
        // Map data according to user selection
        const mappedData = previewData.map(row => ({
            date: row[mapping.date],
            amount: row[mapping.amount],
            description: row[mapping.description],
            externalId: mapping.reference ? row[mapping.reference] : undefined,
            cardType: mapping.cardType ? row[mapping.cardType] : undefined,
            metadata: row
        }));

        const res = await fetch('/finanzas/api/import/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                transactions: mappedData, 
                accountId,
                billingPeriod 
            })
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
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-serif text-stone-800 tracking-tight">Importar Datos</h1>
        <p className="text-stone-500 mt-2 font-medium">Carga tus estados de cuenta de forma inteligente.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between max-w-md mx-auto relative mb-12">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-stone-200/60 -translate-y-1/2 -z-10" />
          {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center font-bold font-serif transition-all duration-500 shadow-sm",
                    step > s ? "bg-stone-800 text-white scale-100" : step === s ? "bg-stone-800 text-white scale-110 shadow-md ring-4 ring-stone-800/20" : "bg-white border-2 border-stone-200/60 text-stone-300 scale-100"
                )}
              >
                  {step > s ? <CheckCircle className="h-6 w-6" /> : s}
              </div>
          ))}
      </div>

      {step === 1 && (
        <Card className="border-stone-100/50 shadow-sm rounded-3xl overflow-hidden bg-white p-12 hover:shadow-md transition-shadow duration-300">
          <div className="flex flex-col items-center justify-center text-center space-y-8">
            <div className="h-28 w-28 rounded-[2rem] bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400 shadow-sm transition-transform hover:scale-105 duration-300">
                {loading ? <Loader2 className="h-12 w-12 animate-spin text-stone-600" /> : <FileUp className="h-12 w-12" />}
            </div>
            <div>
                <h3 className="text-2xl font-serif text-stone-800 tracking-tight">Selecciona tu archivo</h3>
                <p className="text-stone-500 mt-2 font-medium">Formatos soportados: Excel (.xlsx) y CSV (.csv)</p>
            </div>
            <div className="w-full max-w-md mt-4">
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-stone-200/80 rounded-3xl cursor-pointer hover:bg-stone-50 hover:border-stone-300 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <FileSpreadsheet className="w-10 h-10 mb-3 text-stone-300 group-hover:text-stone-500 transition-colors" />
                        <p className="text-sm text-stone-500 font-medium">Haz clic o arrastra aquí</p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.csv,.xls" onChange={handleFileChange} disabled={loading} />
                </label>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden hover:shadow-md transition-shadow duration-300">
            <CardHeader className="bg-stone-50/50 border-b border-stone-100/60 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center">
                        <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mr-4 shrink-0">
                            <Settings2 className="h-6 w-6 text-stone-400" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-serif tracking-tight text-stone-800">Mapeo de Columnas</CardTitle>
                            <CardDescription className="text-stone-500 mt-1 font-medium">Indica qué columna corresponde a cada dato.</CardDescription>
                        </div>
                    </div>
                    <Badge variant="outline" className="bg-white border-stone-200 text-stone-600 px-4 py-1">{file?.name}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Cuenta de Destino</Label>
                    <Select value={accountId} onValueChange={(val) => val && setAccountId(val)}>
                      <SelectTrigger className="w-full rounded-xl border-stone-200 h-11 text-sm bg-white shadow-sm">
                        <SelectValue placeholder="Seleccionar cuenta" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-stone-200 shadow-xl">
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Periodo de Facturación</Label>
                    <Select value={billingPeriod} onValueChange={(val) => val && setBillingPeriod(val)}>
                      <SelectTrigger className="w-full rounded-xl border-stone-200 h-11 text-sm bg-white shadow-sm">
                        <SelectValue placeholder="Seleccionar periodo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-stone-200 shadow-xl">
                        {getMonthOptions().map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {[
                        { id: 'date', label: 'Fecha', required: true },
                        { id: 'amount', label: 'Monto', required: true },
                        { id: 'description', label: 'Descripción', required: true },
                        { id: 'cardType', label: 'Tipo de Tarjeta', required: false },
                        { id: 'reference', label: 'Referencia / ID', required: false },
                        { id: 'category', label: 'Categoría', required: false },
                    ].map((field) => (
                        <div key={field.id} className="space-y-2">
                            <label className="text-sm font-semibold text-stone-700 flex items-center tracking-tight">
                                {field.label}
                                {field.required && <span className="text-rose-400 ml-1.5">*</span>}
                            </label>
                            <select 
                                className="w-full h-11 border border-stone-200/60 rounded-xl px-4 text-sm bg-white shadow-sm focus:ring-2 focus:ring-stone-200 outline-none transition-all"
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
                    <div className="mt-10 pt-8 border-t border-stone-100/60 flex flex-col sm:flex-row items-start sm:items-end gap-4">
                        <div className="flex-1 w-full">
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Guardar este mapeo</p>
                            <input 
                                type="text" 
                                placeholder="Nombre del perfil (ej: Banco Chile Mensual)" 
                                className="w-full h-11 border border-stone-200/60 rounded-xl px-4 text-sm bg-white shadow-sm focus:ring-2 focus:ring-stone-200 outline-none transition-all"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                            />
                        </div>
                        <Button 
                            variant="outline" 
                            className="rounded-xl h-11 px-6 border-stone-200/60 shadow-sm w-full sm:w-auto mt-4 sm:mt-0"
                            onClick={saveProfile}
                            disabled={!profileName || loading}
                        >
                            Guardar Perfil
                        </Button>
                    </div>
                )}
                
                <div className="mt-10 border border-stone-100/60 rounded-3xl overflow-hidden shadow-sm">
                    <div className="bg-stone-50/50 p-4 border-b border-stone-100/60 flex items-center">
                        <TableIcon className="h-4 w-4 text-stone-400 mr-2.5" />
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Vista Previa (5 filas)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white border-b border-stone-100/60">
                                <tr>
                                    {headers.slice(0, 5).map(h => (
                                        <th key={h} className="p-4 font-semibold text-stone-500 tracking-tight">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.slice(0, 5).map((row, i) => (
                                    <tr key={i} className="border-b border-stone-50/50 hover:bg-stone-50/30 transition-colors">
                                        {headers.slice(0, 5).map(h => (
                                            <td key={h} className="p-4 text-stone-600 truncate max-w-[200px]">{row[h]}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-stone-50/30 border-t border-stone-100/60 p-6 sm:p-8 flex flex-col sm:flex-row justify-between gap-4">
                <Button variant="ghost" onClick={() => setStep(1)} className="rounded-full h-11 px-6">Atrás</Button>
                <Button 
                    onClick={handleProcess} 
                    disabled={!mapping.date || !mapping.amount || !mapping.description || loading}
                    className="bg-stone-800 hover:bg-stone-900 rounded-full h-11 px-10 shadow-sm transition-all"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Analizar Archivo
                </Button>
            </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-stone-100/50 shadow-sm rounded-3xl bg-white overflow-hidden hover:shadow-md transition-shadow duration-300">
            <CardHeader className="bg-stone-50/50 border-b border-stone-100/60 p-8 text-center">
                <CardTitle className="text-2xl font-serif text-stone-800 tracking-tight">Vista Previa de Importación</CardTitle>
                <CardDescription className="text-stone-500 mt-1 font-medium">Archivo analizado correctamente.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 sm:p-12 space-y-10">
                <div className="flex flex-col sm:flex-row justify-around gap-8">
                    <div className="text-center">
                        <div className="text-4xl font-serif text-stone-800 tracking-tight">{previewData.length}</div>
                        <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">Leídas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-serif text-amber-500 tracking-tight">{duplicates}</div>
                        <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">Probables Duplicados</div>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-serif text-rose-500 tracking-tight">0</div>
                        <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">Con Error</div>
                    </div>
                </div>
                
                {duplicates > 0 && (
                    <div className="p-6 sm:p-8 bg-amber-50/50 border border-amber-200/60 rounded-3xl flex items-start shadow-sm">
                        <AlertCircle className="h-6 w-6 text-amber-500 mr-4 mt-0.5 shrink-0" />
                        <div>
                            <h4 className="font-semibold text-amber-800 text-lg tracking-tight">Atención: Duplicados Probables</h4>
                            <p className="text-sm text-amber-700 mt-2 leading-relaxed font-medium">
                                Hemos detectado {duplicates} transacciones que podrían estar duplicadas. Podrás revisarlas individualmente en la sección de transacciones después de importar.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-3 pt-4">
                    <div className="flex justify-between text-xs font-bold text-stone-400 uppercase tracking-widest">
                        <span>Preparando datos para guardado...</span>
                        <span>100%</span>
                    </div>
                    <Progress value={100} className="h-2.5 bg-stone-100 rounded-full overflow-hidden" indicatorClassName="bg-emerald-500" />
                </div>
            </CardContent>
            <CardFooter className="bg-stone-50/30 border-t border-stone-100/60 p-6 sm:p-8 flex flex-col sm:flex-row justify-between gap-4">
                <Button variant="ghost" onClick={() => setStep(2)} className="rounded-full h-11 px-6">Atrás</Button>
                <Button 
                    onClick={handleConfirm} 
                    disabled={loading}
                    className="bg-stone-800 hover:bg-stone-900 rounded-full h-11 px-10 shadow-sm transition-all"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirmar Carga
                </Button>
            </CardFooter>
        </Card>
      )}

      {step === 4 && (
          <div className="text-center py-24 animate-in zoom-in duration-700">
              <div className="h-28 w-28 rounded-[2rem] bg-emerald-50 flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <CheckCircle className="h-14 w-14 text-emerald-500" />
              </div>
              <h2 className="text-4xl sm:text-5xl font-serif text-stone-800 mb-4 tracking-tight">¡Importación Exitosa!</h2>
              <p className="text-stone-500 max-w-lg mx-auto mb-10 leading-relaxed font-medium">
                  Se han procesado {previewData.length} transacciones correctamente. 
                  {duplicates > 0 ? ` ${duplicates} sospechas de duplicado han sido enviadas a tu lista de "Pendientes de revisión".` : ""}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="outline" className="rounded-full h-12 px-8 border-stone-200/60 shadow-sm hover:bg-stone-50" onClick={() => setStep(1)}>Importar más</Button>
                  <Link href="/dashboard/transactions" className={cn(buttonVariants({ variant: "default" }), "bg-stone-800 hover:bg-stone-900 rounded-full h-12 px-8 shadow-sm transition-all")}>
                      Ver Transacciones
                  </Link>
              </div>
          </div>
      )}

      <div className="bg-stone-50/50 p-6 sm:p-8 rounded-3xl flex items-start border border-stone-100/60 shadow-sm">
          <Info className="h-6 w-6 text-stone-400 mr-4 mt-0.5 shrink-0" />
          <p className="text-sm text-stone-500 leading-relaxed italic font-serif">
              "El Mapping Wizard recordará tus preferencias para archivos del mismo banco en el futuro, automatizando el proceso para tu próxima importación mensual."
          </p>
      </div>
    </div>
  );
}
