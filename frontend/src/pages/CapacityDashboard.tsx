import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

interface MemberCapacity {
  id: number;
  name: string;
  projects: string[];
  horas_comprometidas: number;
  horas_disponibles: number;
  porcentaje_carga: number;
  estado: "LIBRE" | "NORMAL" | "CARGADO" | "SOBRECARGADO";
}

const CapacityDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<MemberCapacity[]>([]);
  const [loading, setLoading] = useState(true);

  if (user?.role !== 'owner' && user?.role !== 'leader') {
    return <Navigate to="/" />;
  }

  useEffect(() => {
    const fetchCapacity = async () => {
      try {
        const response = await axios.get('/dashboard/capacity');
        setData(response.data);
      } catch (error) {
        console.error("Error fetching capacity data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCapacity();
  }, []);

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'LIBRE': return 'bg-green-100 text-green-800 border-green-200';
      case 'NORMAL': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CARGADO': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'SOBRECARGADO': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProgressBarColor = (estado: string) => {
    switch (estado) {
      case 'LIBRE': return 'bg-green-500';
      case 'NORMAL': return 'bg-blue-500';
      case 'CARGADO': return 'bg-yellow-500';
      case 'SOBRECARGADO': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Capacity Dashboard</h1>
        <p className="text-gray-500 mt-2">Visión global de carga por miembro de equipo (Cross-Project)</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((member) => (
            <div key={member.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-full hover:shadow-md transition-shadow">
              
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate">{member.name}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(member.estado)}`}>
                  {member.estado}
                </span>
              </div>

              <div className="mb-6 flex-grow">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Proyectos Activos</p>
                <div className="flex flex-wrap gap-2">
                  {member.projects.length > 0 ? (
                    member.projects.map((p, idx) => (
                      <span key={idx} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-xs">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm italic">Sin proyectos asignados</span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Carga Activa</span>
                  <span className="font-bold text-gray-700 dark:text-gray-200">
                    {member.horas_comprometidas}h / {member.horas_disponibles}h
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full ${getProgressBarColor(member.estado)}`} 
                    style={{ width: `${Math.min(member.porcentaje_carga, 100)}%` }}
                  ></div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {member.porcentaje_carga}% Ocupación
                  </span>
                </div>
              </div>

            </div>
          ))}

          {data.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-500">
              No se encontraron miembros activos en la organización.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CapacityDashboard;
