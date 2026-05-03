'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type ScopeContextType = {
  selectedScope: string;
  setSelectedScope: (scope: string) => void;
};

const ScopeContext = createContext<ScopeContextType>({
  selectedScope: 'personal',
  setSelectedScope: () => {},
});

export const useScope = () => useContext(ScopeContext);

export const ScopeProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedScope, setSelectedScope] = useState<string>('personal');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('zen_finanzas_scope');
    if (saved) {
      setSelectedScope(saved);
    }
    setMounted(true);
  }, []);

  const handleSetScope = (scope: string) => {
    setSelectedScope(scope);
    localStorage.setItem('zen_finanzas_scope', scope);
  };

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center zen-bg opacity-0" />;
  }

  return (
    <ScopeContext.Provider value={{ selectedScope, setSelectedScope: handleSetScope }}>
      {children}
    </ScopeContext.Provider>
  );
};
