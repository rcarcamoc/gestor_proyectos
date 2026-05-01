'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileUp, 
  FileSpreadsheet, 
  Settings2, 
  CheckCircle, 
  AlertCircle,
  Download,
  Info
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function ImportPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStep(2);
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
                <FileUp className="h-12 w-12" />
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
                    <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleFileChange} />
                </label>
            </div>
            <div className="pt-4">
                <Button variant="ghost" className="text-stone-400 hover:text-stone-600">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Plantilla Genérica
                </Button>
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
                    <Badge className="bg-white border-stone-200 text-stone-600 px-4 py-1">{file?.name}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-8">
                    {[
                        { label: 'Fecha', required: true },
                        { label: 'Monto', required: true },
                        { label: 'Descripción', required: true },
                        { label: 'Referencia / ID', required: false },
                        { label: 'Categoría', required: false },
                    ].map((field) => (
                        <div key={field.label} className="space-y-2">
                            <label className="text-sm font-medium text-stone-700 flex items-center">
                                {field.label}
                                {field.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            <div className="h-10 border border-stone-200 rounded-xl px-4 flex items-center text-sm text-stone-400 italic">
                                Seleccionar columna...
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="bg-stone-50/30 border-t border-stone-100 p-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl">Atrás</Button>
                <Button onClick={() => setStep(3)} className="bg-stone-800 hover:bg-stone-900 rounded-xl px-10">Siguiente</Button>
            </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-stone-200 shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-stone-50/50 border-b border-stone-100 p-8 text-center">
                <CardTitle className="text-xl font-serif">Vista Previa de Importación</CardTitle>
                <CardDescription>Analizando 42 transacciones...</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="flex justify-around">
                    <div className="text-center">
                        <div className="text-2xl font-serif text-stone-800">38</div>
                        <div className="text-xs text-stone-400 uppercase tracking-widest">Válidas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-serif text-amber-600">4</div>
                        <div className="text-xs text-stone-400 uppercase tracking-widest">Probables Duplicados</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-serif text-red-500">0</div>
                        <div className="text-xs text-stone-400 uppercase tracking-widest">Con Error</div>
                    </div>
                </div>
                
                <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-start">
                    <AlertCircle className="h-5 w-5 text-amber-600 mr-3 mt-1" />
                    <div>
                        <h4 className="font-medium text-amber-900">Atención: Duplicados Probables</h4>
                        <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                            Hemos detectado 4 transacciones que podrían estar duplicadas con registros manuales o importaciones previas. Podrás revisarlas individualmente después de importar.
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-stone-400">
                        <span>Preparando datos...</span>
                        <span>85%</span>
                    </div>
                    <Progress value={85} className="h-2 bg-stone-100 rounded-full" />
                </div>
            </CardContent>
            <CardFooter className="bg-stone-50/30 border-t border-stone-100 p-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)} className="rounded-xl">Atrás</Button>
                <Button onClick={() => setStep(4)} className="bg-stone-800 hover:bg-stone-900 rounded-xl px-10">Confirmar Carga</Button>
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
                  Se han cargado 42 transacciones correctamente. Las 4 sospechas de duplicado han sido enviadas a tu lista de "Pendientes de revisión".
              </p>
              <div className="flex gap-4 justify-center">
                  <Button variant="outline" className="rounded-xl border-stone-200" onClick={() => setStep(1)}>Importar más</Button>
                  <Button className="bg-stone-800 hover:bg-stone-900 rounded-xl px-10" asChild>
                      <a href="/dashboard/transactions">Ver Transacciones</a>
                  </Button>
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
