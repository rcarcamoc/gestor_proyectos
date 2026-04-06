import React, { useState } from 'react';
import api from '../api/axios';

const EmergencyMode: React.FC = () => {
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'preview' | 'applied' | 'rollback'>('idle');

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const res = await api.post('/emergency/preview', { reason });
      setPreview(res.data);
      setStatus('preview');
    } catch (err: any) {
      alert("Error al generar el preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    setIsLoading(true);
    try {
      await api.post('/emergency/apply', { plan_id: preview.plan_id });
      setStatus('applied');
      alert("Plan de emergencia aplicado correctamente.");
    } catch (err: any) {
      alert("Error al aplicar cambios");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = async () => {
    setIsLoading(true);
    try {
      await api.post(`/emergency/rollback/${preview.plan_id}`);
      setStatus('rollback');
      alert("Rollback ejecutado con éxito. El equipo ha vuelto a su estado original.");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error al realizar rollback");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-12">
      <div className="bg-white p-12 rounded-3xl shadow-2xl border border-gray-100 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-red-600"></div>
        
        <header className="mb-8">
          <div className="flex items-center space-x-2 text-red-600 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-bold uppercase tracking-widest text-xs">Situación de Crisis</span>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-800">Modo Emergencia</h1>
          <p className="text-gray-500 mt-2">Reprograma masivamente para mitigar riesgos operacionales.</p>
        </header>

        {status === 'idle' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">¿Cuál es el motivo de la emergencia?</label>
              <textarea 
                className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 focus:border-red-500 outline-none transition-all h-32"
                placeholder="Ej: Ausencia de desarrollador senior por 3 días."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <button 
              onClick={handlePreview}
              disabled={!reason || isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl hover:shadow-red-200 disabled:opacity-50"
            >
              {isLoading ? 'Analizando impacto...' : 'Analizar Impacto y Generar Preview'}
            </button>
          </div>
        )}

        {status === 'preview' && preview && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
              <h3 className="font-bold text-red-800 mb-2">Resumen de Impacto</h3>
              <p className="text-red-700 italic text-sm">"{preview.impact_summary}"</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-2xl">
              <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase">Cambios Propuestos</h4>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {preview.changes.map((c: any) => (
                  <div key={c.task_id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-sm font-medium text-gray-700">{c.task_name}</span>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-400 line-through">{c.old_start_date}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-red-600 font-bold">{c.new_start_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-4">
               <button onClick={() => setStatus('idle')} className="flex-1 px-6 py-4 rounded-2xl font-bold border border-gray-200 text-gray-500 hover:bg-gray-50">Cancelar</button>
               <button onClick={handleApply} disabled={isLoading} className="flex-2 px-8 py-4 rounded-2xl font-bold bg-red-600 text-white shadow-xl hover:bg-red-700">Confirmar y Aplicar Cambios</button>
            </div>
          </div>
        )}

        {status === 'applied' && (
          <div className="text-center py-8 animate-in zoom-in duration-500">
             <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
             </div>
             <h2 className="text-3xl font-bold text-gray-800 mb-2">Cambios Aplicados</h2>
             <p className="text-gray-500 mb-8">El equipo ha sido reprogramado con éxito.</p>
             
             <div className="p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase mb-4">¿Quieres deshacer los cambios?</p>
                <button 
                  onClick={handleRollback}
                  disabled={isLoading}
                  className="bg-white border-2 border-red-500 text-red-500 px-8 py-3 rounded-2xl font-bold hover:bg-red-50 transition-colors shadow-sm"
                >
                  Ejecutar Rollback Ahora (Ventana 2h)
                </button>
                <p className="mt-4 text-[10px] text-gray-400 italic">Un rollback restaurará todas las fechas y estados al momento previo de la emergencia.</p>
             </div>
          </div>
        )}

        {status === 'rollback' && (
          <div className="text-center py-8">
             <h2 className="text-2xl font-bold text-blue-600 mb-4">Rollback Completado</h2>
             <p className="text-gray-600 mb-8">El sistema ha vuelto a su estado original previo a la crisis.</p>
             <button onClick={() => window.location.href = '/'} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg">Volver al Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergencyMode;
