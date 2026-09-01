import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './globals.css';
import { SwRegister } from './sw-register';
import { AutoSync } from './auto-sync';

export const metadata: Metadata = {
  title: 'match-make',
  description: 'コート割り振りアプリ',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'match-make',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
        <meta name="theme-color" content="#2d7a3a" />
        <link rel="apple-touch-icon" href="/app-icon.png" />
      </head>
      <body>
        <MantineProvider>
          <SwRegister />
          <AutoSync />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
