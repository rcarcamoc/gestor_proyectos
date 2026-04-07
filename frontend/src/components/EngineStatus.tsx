import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const EngineStatus: React.FC = () => {
  const [engineInfo, setEngineInfo] = useState<any>(null);

  useEffect(() => {
    api.get('/engine/status')
      .then(res => setEngineInfo(res.data))
      .catch(err => console.error(err));
  }, []);

  if (!engineInfo) return null;

  const { motor_confidence, improvement_suggestions } = engineInfo;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'FULL': return 'bg-green-100 text-green-800 border-green-200';
      case 'HIGH': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'BASIC': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <div className={`p-4 rounded-xl border ${getLevelColor(motor_confidence.level)} mb-6`}>
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-sm uppercase tracking-wider">Confianza del motor: {motor_confidence.level}</h4>
        <span className="text-xs font-bold">{motor_confidence.percentage}%</span>
      </div>
      <p className="text-xs italic mb-4">"{motor_confidence.label}"</p>

      {improvement_suggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-inherit">
          <p className="text-xs font-semibold mb-2">¿Cómo mejorar la precisión?</p>
          <ul className="text-[10px] space-y-1 opacity-75">
            {improvement_suggestions.map((s: string, idx: number) => (
              <li key={idx}>• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EngineStatus;
