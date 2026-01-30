import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, broker_id, category_id, total_leads, price, distribution_type, leads_per_day } = body

    if (!broker_id || !total_leads) {
      return NextResponse.json({ error: 'broker_id und total_leads erforderlich' }, { status: 400 })
    }

    // Get broker
    const { data: broker } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', broker_id)
      .single()

    if (!broker) {
      return NextResponse.json({ error: 'Broker nicht gefunden' }, { status: 404 })
    }

    // Create package (status: pending until paid)
    const { data: pkg, error: pkgError } = await supabase
      .from('lead_packages')
      .insert({
        name: name || `${total_leads}er Paket`,
        broker_id,
        category_id: category_id || null,
        total_leads,
        delivered_leads: 0,
        price: price || 0,
        distribution_type: distribution_type || 'instant',
        leads_per_day: distribution_type === 'distributed' ? (leads_per_day || 2) : null,
        status: 'pending' // Wait for payment
      })
      .select()
      .single()

    if (pkgError) {
      console.error('Package error:', pkgError)
      return NextResponse.json({ error: pkgError.message }, { status: 500 })
    }

    // Create invoice
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
    
    const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`

    const { data: invoice, error: invError } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      broker_id,
      type: 'package',
      amount: price || 0,
      description: `Lead-Paket: ${name || `${total_leads}er Paket`} (${total_leads} Leads)`,
      status: 'pending',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      package_id: pkg.id
    }).select().single()

    if (invError) {
      console.error('Invoice error:', invError)
    }

    // Update package with invoice_id
    if (invoice) {
      await supabase
        .from('lead_packages')
        .update({ invoice_id: invoice.id })
        .eq('id', pkg.id)
    }

    // Send invoice email
    let emailSent = false
    if (broker.email && invoice) {
      const emailHtml = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
            <h1 style="margin:0;font-size:24px;">📦 Lead-Paket bestellt</h1>
            <p style="margin:8px 0 0;opacity:0.9;">${name || `${total_leads}er Paket`}</p>
          </div>
          <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
            <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
            <p style="color:#64748b;line-height:1.6;">
              Vielen Dank für Ihre Bestellung! Nach Zahlungseingang werden Ihre Leads automatisch zugestellt.
            </p>
            
            <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;">
              <table style="width:100%;font-size:14px;">
                <tr><td style="color:#64748b;padding:8px 0;">Paket:</td><td style="color:#1e293b;font-weight:600;">${name || `${total_leads}er Paket`}</td></tr>
                <tr><td style="color:#64748b;padding:8px 0;">Anzahl Leads:</td><td style="color:#1e293b;font-weight:600;">${total_leads}</td></tr>
                <tr><td style="color:#64748b;padding:8px 0;">Lieferart:</td><td style="color:#1e293b;">${distribution_type === 'instant' ? 'Sofort (alle auf einmal)' : `Verteilt (${leads_per_day || 2} pro Tag)`}</td></tr>
                <tr><td style="color:#64748b;padding:8px 0;">Rechnung:</td><td style="color:#1e293b;">${invoiceNumber}</td></tr>
              </table>
            </div>

            <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
              <div style="font-size:14px;color:#64748b;margin-bottom:8px;">Zu zahlen</div>
              <div style="font-size:36px;font-weight:700;color:#1e293b;">CHF ${Number(price).toFixed(2)}</div>
            </div>

            <div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0;">
              <div style="color:#1e40af;font-size:14px;">
                <strong>Zahlungsdetails:</strong><br>
                IBAN: CH00 0000 0000 0000 0000 0<br>
                Empfänger: LeadsHub GmbH<br>
                Referenz: ${invoiceNumber}
              </div>
            </div>

            <div style="background:#fef3c7;border-radius:8px;padding:16px;margin:24px 0;">
              <div style="color:#92400e;font-size:14px;">
                <strong>Hinweis:</strong> Ihre Leads werden automatisch nach Zahlungseingang versendet.
              </div>
            </div>
            
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
            
            <p style="color:#64748b;font-size:14px;margin:0;">
              Freundliche Grüsse<br>
              <strong style="color:#1e293b;">LeadsHub</strong>
            </p>
          </div>
        </div>
      `

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
          to: broker.email,
          subject: `📦 Lead-Paket bestellt - Rechnung ${invoiceNumber}`,
          html: emailHtml
        })
        emailSent = true

        // Update invoice status to sent
        await supabase
          .from('invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', invoice.id)
      } catch (e) {
        console.error('Email error:', e)
      }
    }

    return NextResponse.json({ 
      success: true, 
      package: pkg,
      invoice: invoice,
      email_sent: emailSent 
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
