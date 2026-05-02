'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/sonner';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/finanzas/api/auth">
      {children}
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
