import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { invoice_id } = await request.json()

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id erforderlich' }, { status: 400 })
    }

    // Get invoice with broker
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

    const typeLabels: Record<string, string> = {
      single: 'Einzelkauf',
      fixed: 'Fixpreis',
      subscription: 'Monatsabo',
      commission: 'Provision',
      package: 'Lead-Paket'
    }

    const emailHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
          <h1 style="margin:0;font-size:24px;">📄 Rechnung ${invoice.invoice_number}</h1>
        </div>
        <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
          <p style="font-size:16px;color:#1e293b;">Hallo ${invoice.broker.contact_person || invoice.broker.name},</p>
          <p style="color:#64748b;line-height:1.6;">
            Anbei erhalten Sie Ihre Rechnung:
          </p>
          
          <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;">
            <table style="width:100%;font-size:14px;">
              <tr>
                <td style="color:#64748b;padding:8px 0;">Rechnungsnr.:</td>
                <td style="color:#1e293b;font-weight:600;">${invoice.invoice_number}</td>
              </tr>
              <tr>
                <td style="color:#64748b;padding:8px 0;">Typ:</td>
                <td style="color:#1e293b;">${typeLabels[invoice.type] || invoice.type}</td>
              </tr>
              <tr>
                <td style="color:#64748b;padding:8px 0;">Betrag:</td>
                <td style="color:#1e293b;font-weight:700;font-size:20px;">CHF ${Number(invoice.amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color:#64748b;padding:8px 0;">Fällig bis:</td>
                <td style="color:#1e293b;">${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-CH') : '30 Tage'}</td>
              </tr>
            </table>
          </div>

          ${invoice.description ? `
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:24px 0;">
            <div style="color:#64748b;font-size:13px;margin-bottom:4px;">Beschreibung:</div>
            <div style="color:#1e293b;">${invoice.description}</div>
          </div>
          ` : ''}

          <div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0;">
            <div style="color:#1e40af;font-size:14px;">
              <strong>Zahlungsdetails:</strong><br>
              IBAN: CH00 0000 0000 0000 0000 0<br>
              Empfänger: LeadsHub GmbH<br>
              Referenz: ${invoice.invoice_number}
            </div>
          </div>
          
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
          
          <p style="color:#64748b;font-size:14px;margin:0;">
            Freundliche Grüsse<br>
            <strong style="color:#1e293b;">LeadsHub</strong><br>
            <span style="font-size:12px;">Sandäckerstrasse 10, 8957 Spreitenbach</span>
          </p>
        </div>
      </div>
    `

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
      to: invoice.broker.email,
      subject: `Rechnung ${invoice.invoice_number} - CHF ${Number(invoice.amount).toFixed(2)}`,
      html: emailHtml
    })

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invoice_id)

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
