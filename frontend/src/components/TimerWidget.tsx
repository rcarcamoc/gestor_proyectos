import React, { useState, useEffect } from 'react';
import api from '../api/axios';

const TimerWidget: React.FC<{ taskId: number, taskName: string }> = ({ taskId, taskName }) => {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
  };

  const handleStart = async () => {
    try {
      await api.post(`/time/start/${taskId}`);
      setIsActive(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error al iniciar timer");
    }
  };

  const handleStop = async () => {
    try {
      await api.post('/time/stop');
      setIsActive(false);
      setSeconds(0);
      alert("Tiempo registrado correctamente");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error al detener timer");
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-400 font-bold uppercase">Timer Activo</p>
        <p className="text-sm font-semibold text-gray-700 truncate max-w-[150px]">{taskName}</p>
      </div>
      <div className="flex items-center space-x-4">
        <span className={`text-xl font-mono font-bold ${isActive ? 'text-blue-600' : 'text-gray-300'}`}>
          {formatTime(seconds)}
        </span>
        {!isActive ? (
          <button onClick={handleStart} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full shadow-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        ) : (
          <button onClick={handleStop} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default TimerWidget;
