import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'match-make',
  description: 'ピックルボール コート割り振りアプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
