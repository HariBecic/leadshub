import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPaymentLink } from '@/lib/stripe'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  try {
    const { invoice_id } = await request.json()

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id erforderlich' }, { status: 400 })
    }

    // Rechnung mit Broker laden
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, broker:brokers(*)')
      .eq('id', invoice_id)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    if (!invoice.broker?.email) {
      return NextResponse.json({ error: 'Broker hat keine E-Mail' }, { status: 400 })
    }

    // Prüfen ob bereits ein Stripe Link existiert
    if (invoice.stripe_payment_link) {
      return NextResponse.json({
        success: true,
        payment_link: invoice.stripe_payment_link,
        message: 'Payment Link bereits vorhanden'
      })
    }

    const typeLabels: Record<string, string> = {
      single: 'Einzelkauf Lead',
      fixed: 'Fixpreis Lead',
      subscription: 'Monatsabo',
      commission: 'Provisionsabrechnung',
      package: 'Lead-Paket'
    }

    // Stripe Payment Link erstellen
    const { paymentLink, paymentLinkId } = await createPaymentLink({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amount: Number(invoice.amount),
      description: typeLabels[invoice.type] || `Rechnung ${invoice.invoice_number}`,
      customerEmail: invoice.broker.email,
    })

    // Payment Link in Datenbank speichern
    await supabase
      .from('invoices')
      .update({
        stripe_payment_link: paymentLink,
        stripe_payment_id: paymentLinkId,
      })
      .eq('id', invoice_id)

    return NextResponse.json({
      success: true,
      payment_link: paymentLink,
      payment_link_id: paymentLinkId,
    })

  } catch (err) {
    console.error('Stripe Payment Link Error:', err)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Payment Links' },
      { status: 500 }
    )
  }
}
