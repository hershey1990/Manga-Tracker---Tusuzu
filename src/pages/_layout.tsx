import '../styles.css';

import type { ReactNode } from 'react';
import { AppShell } from '../components/app-shell';

export default function RootLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export const getConfig = async () => {
  return { render: 'static' } as const;
};
