import type { Metadata } from 'next'
import CropPreviewClient from './CropPreviewClient'

export const metadata: Metadata = {
  title: 'Smart Crop Preview',
  robots: { index: false, follow: false },
}

export default function CropPreviewPage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <CropPreviewClient />
    </main>
  )
}
