'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { Suspense } from 'react'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const invoiceNumber = searchParams.get('invoice')

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Success Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500/30 to-emerald-500/20 p-8 text-center border-b border-white/10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-4">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Zahlung erfolgreich!</h1>
            <p className="text-white/70">Vielen Dank für Ihre Zahlung</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {invoiceNumber && (
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <p className="text-white/60 text-sm mb-1">Rechnungsnummer</p>
                <p className="text-white font-semibold text-lg">{invoiceNumber}</p>
              </div>
            )}

            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 mb-6">
              <p className="text-blue-200 text-sm">
                <strong>Was passiert jetzt?</strong><br />
                Ihre Lead-Daten werden Ihnen in Kürze per E-Mail zugestellt.
              </p>
            </div>

            <p className="text-white/60 text-sm text-center">
              Bei Fragen kontaktieren Sie uns unter<br />
              <a href="mailto:info@leadshub.ch" className="text-purple-400 hover:text-purple-300">
                info@leadshub.ch
              </a>
            </p>
          </div>

          {/* Footer */}
          <div className="bg-black/20 px-8 py-4 border-t border-white/10">
            <p className="text-white/40 text-xs text-center">
              Sie können dieses Fenster jetzt schliessen.
            </p>
          </div>
        </div>

        {/* Logo */}
        <div className="text-center mt-8">
          <img
            src="/logo.png"
            alt="LeadsHub"
            className="h-8 mx-auto opacity-60"
          />
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950 flex items-center justify-center">
        <div className="text-white">Laden...</div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
