import React from 'react';
import { AppShell } from './AppShell';

interface DashboardViewProps {
  shop: string;
  token: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ shop, token }) => {
  return <AppShell shop={shop} token={token} />;
};
