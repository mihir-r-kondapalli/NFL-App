// app/layout.tsx
import './globals.css'

export const metadata = {
  title: 'Football Simulator',
  description: 'React/Next.js football simulation game',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const now = new Date()
  const hour = now.getHours()
  const isDay = true // hour >= 6 && hour < 18 // Light mode from 6am–6pm
  const theme = isDay ? 'light' : 'dark'

  return (
    <html lang="en" className={theme}>
      <body>
        {children}
      </body>
    </html>
  )
}
