import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

interface TimerContextType {
  isActive: boolean;
  seconds: number;
  taskId: number | null;
  taskName: string | null;
  startTimer: (id: number, name: string) => Promise<void>;
  stopTimer: () => Promise<void>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskName, setTaskName] = useState<string | null>(null);

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

  const startTimer = async (id: number, name: string) => {
    try {
      if (isActive && taskId && taskId !== id) {
        await stopTimer(); // Stop the previous one first
      }
      await api.post(`/time/start/${id}`);
      setTaskId(id);
      setTaskName(name);
      setSeconds(0);
      setIsActive(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error al iniciar timer");
    }
  };

  const stopTimer = async () => {
    try {
      await api.post('/time/stop');
      setIsActive(false);
      setSeconds(0);
      setTaskId(null);
      setTaskName(null);
      alert("Tiempo registrado correctamente");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Error al detener timer");
    }
  };

  return (
    <TimerContext.Provider value={{ isActive, seconds, taskId, taskName, startTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
