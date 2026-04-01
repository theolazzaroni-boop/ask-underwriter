import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ask Underwriter',
  description: 'Dashboard de gestion des demandes underwriting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="fr" className="h-full">
        <body className={`${geist.className} h-full bg-gray-50 text-gray-900 antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
