import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import EngineStatus from '../../components/EngineStatus';
import TimerWidget from '../../components/TimerWidget';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/projects/')
      .then(res => setProjects(res.data))
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="p-8 text-center">Cargando proyectos...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col lg:flex-row lg:space-x-8">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Proyectos</h1>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold shadow-lg">Nuevo Proyecto</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map(p => (
            <div key={p.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  {p.priority}
                </span>
                <span className="text-gray-400 text-xs">{p.status}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{p.name}</h3>
              <p className="text-gray-500 text-sm mb-6 line-clamp-2">{p.description || 'Sin descripción'}</p>
              
              <div className="flex justify-between items-center text-xs text-gray-400 border-t pt-4">
                <span>Inicio: {p.start_date}</span>
                {p.deadline && <span>Vence: {p.deadline}</span>}
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full py-12 text-center bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-gray-500">No hay proyectos activos.</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="w-full lg:w-72 mt-8 lg:mt-0 space-y-6">
        <TimerWidget taskId={1} taskName="Tarea Demo" />
        <EngineStatus />
      </div>
    </div>
  );
};

export default ProjectList;
