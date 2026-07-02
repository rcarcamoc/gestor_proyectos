'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type ScopeContextType = {
  selectedScope: string;
  setSelectedScope: (scope: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
};

const ScopeContext = createContext<ScopeContextType>({
  selectedScope: 'personal',
  setSelectedScope: () => {},
  selectedPeriod: '',
  setSelectedPeriod: () => {},
});

export const useScope = () => useContext(ScopeContext);

export const ScopeProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedScope, setSelectedScope] = useState<string>('personal');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedScope = localStorage.getItem('zen_finanzas_scope');
    if (savedScope) {
      setSelectedScope(savedScope);
    }

    const savedPeriod = localStorage.getItem('zen_finanzas_period');
    if (savedPeriod) {
      setSelectedPeriod(savedPeriod);
    } else {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setSelectedPeriod(`${now.getFullYear()}-${month}`);
    }
    setMounted(true);
  }, []);

  const handleSetScope = (scope: string) => {
    setSelectedScope(scope);
    localStorage.setItem('zen_finanzas_scope', scope);
  };

  const handleSetPeriod = (period: string) => {
    setSelectedPeriod(period);
    localStorage.setItem('zen_finanzas_period', period);
  };

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center zen-bg opacity-0" />;
  }

  return (
    <ScopeContext.Provider value={{ 
      selectedScope, 
      setSelectedScope: handleSetScope, 
      selectedPeriod, 
      setSelectedPeriod: handleSetPeriod 
    }}>
      {children}
    </ScopeContext.Provider>
  );
};
