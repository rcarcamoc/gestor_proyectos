import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import TimerWidget from '../components/TimerWidget';
import EngineStatus from '../components/EngineStatus';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/member')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="p-12 text-center text-gray-500">Cargando tu dashboard...</div>;
  if (!data) return (
    <div className="p-12 text-center text-gray-500">
      <p className="text-lg font-semibold mb-2">No se pudo cargar el dashboard.</p>
      <p className="text-sm">Intenta recargar la página.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col lg:flex-row lg:space-x-8">
      <div className="flex-1 space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Hola 👋</h1>
            <p className="text-gray-500 mt-1">Este es tu resumen para hoy.</p>
          </div>
          <button
            onClick={() => window.location.href = '/emergency'}
            className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold border border-red-100 hover:bg-red-100 transition-colors"
          >
            Modo Emergencia
          </button>
        </header>

        {/* Widgets superiores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Carga Semanal</h3>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-4xl font-bold text-blue-600">{data.projected_load_hours}h</span>
                <span className="text-gray-400 text-sm ml-1">estimadas</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Capacidad: {data.daily_capacity_hours * 5}h</p>
                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: `${(data.projected_load_hours / (data.daily_capacity_hours * 5)) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-2xl border shadow-sm ${data.overdue_tasks_count > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Tareas Atrasadas</h3>
            <div className="flex items-center space-x-3">
              <span className={`text-4xl font-bold ${data.overdue_tasks_count > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                {data.overdue_tasks_count}
              </span>
              <p className="text-gray-600 font-medium">Tareas requieren atención inmediata</p>
            </div>
          </div>
        </div>

        {/* Lista de tareas */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Tareas para hoy</h2>
            <button onClick={() => window.location.href = '/projects'} className="text-blue-600 text-sm font-semibold hover:underline">Ver todo</button>
          </div>

          <div className="space-y-3">
            {data.tasks_today?.map((t: any) => (
              <div key={t.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-blue-200 transition-colors">
                <div className="flex items-center space-x-4">
                  <input type="checkbox" className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <p className="font-bold text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">Proyecto: {t.project_id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                   <span className="text-xs px-2 py-1 bg-gray-50 text-gray-400 rounded-lg">{t.priority}</span>
                   <span className="text-xs text-gray-400 font-medium">{t.estimated_hours}h</span>
                </div>
              </div>
            ))}
            {data.tasks_today?.length === 0 && (
              <div className="py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400">¡Libre de tareas para hoy!</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Sidebar de control */}
      <div className="w-full lg:w-72 mt-8 lg:mt-0 space-y-6">
        <TimerWidget taskId={data.tasks_today?.[0]?.id || 1} taskName={data.tasks_today?.[0]?.name || "Tarea demo"} />
        <EngineStatus />

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Atajos rápidos</h3>
          <ul className="space-y-2">
             <li><button className="w-full text-left p-3 text-sm rounded-lg hover:bg-gray-50 transition-colors">Registrar tiempo manual</button></li>
             <li><button className="w-full text-left p-3 text-sm rounded-lg hover:bg-gray-50 transition-colors">Solicitar ausencia</button></li>
             <li><button className="w-full text-left p-3 text-sm rounded-lg text-blue-600 font-bold hover:bg-blue-50 transition-colors">Actualizar mis skills</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
