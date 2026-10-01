import { DatasetProvider } from './components/DatasetProvider'
// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: '4th & Sim',
  description: 'NFL strategy simulation app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <DatasetProvider>{children}</DatasetProvider>
        <Analytics />
        </body>
    </html>
  )
}
