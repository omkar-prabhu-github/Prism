import { createContext, useContext } from 'react';

export interface DashboardContextType {
  shop: string;
  token: string;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardContext');
  return ctx;
}
