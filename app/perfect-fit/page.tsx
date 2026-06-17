import type { Metadata } from 'next'
import PerfectFitClient from './PerfectFitClient'

export const metadata: Metadata = {
  title: 'Perfect Fit',
  robots: { index: false, follow: false },
}

export default function PerfectFitPage() {
  return (
    <main className="min-h-screen bg-background">
      <PerfectFitClient />
    </main>
  )
}
