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

    const formattedDate = new Date(invoice.created_at).toLocaleDateString('de-CH')
    const formattedDueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-CH') : '30 Tage'

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%);min-height:100vh;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <img src="https://leadshub2.vercel.app/logo.png" alt="LeadsHub" style="height:48px;width:auto;" />
    </div>
    
    <!-- Main Card -->
    <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:24px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;">
      
      <!-- Header -->
      <div style="background:rgba(255,255,255,0.05);padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:48px;margin-bottom:16px;">📄</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:white;">Rechnung ${invoice.invoice_number}</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);">${typeLabels[invoice.type] || invoice.type}</p>
      </div>
      
      <!-- Content -->
      <div style="padding:32px;">
        <p style="color:rgba(255,255,255,0.9);font-size:16px;line-height:1.6;margin:0 0 24px;">
          Hallo ${invoice.broker.contact_person || invoice.broker.name},<br><br>
          Anbei erhalten Sie Ihre Rechnung.
        </p>
        
        <!-- Invoice Details Card -->
        <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;">Rechnungsnr.</td>
              <td style="padding:12px 0;color:white;font-weight:600;text-align:right;">${invoice.invoice_number}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Datum</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Fällig bis</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${formattedDueDate}</td>
            </tr>
          </table>
        </div>
        
        <!-- Amount Box -->
        <div style="background:linear-gradient(135deg,rgba(249,115,22,0.3) 0%,rgba(234,88,12,0.2) 100%);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;border:1px solid rgba(249,115,22,0.3);">
          <div style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:8px;">Zu zahlen</div>
          <div style="color:white;font-size:42px;font-weight:700;">CHF ${Number(invoice.amount).toFixed(2)}</div>
        </div>
        
        ${invoice.description ? `
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;margin-bottom:24px;">
          <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:4px;">Beschreibung</div>
          <div style="color:white;">${invoice.description}</div>
        </div>
        ` : ''}
        
        <!-- Payment Details -->
        <div style="background:rgba(99,102,241,0.2);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid rgba(99,102,241,0.3);">
          <div style="color:#a5b4fc;font-weight:600;margin-bottom:12px;">💳 Zahlungsdetails</div>
          <table style="width:100%;">
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">IBAN:</td>
              <td style="color:white;padding:4px 0;font-size:14px;">CH93 0076 2011 6238 5295 7</td>
            </tr>
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">Bank:</td>
              <td style="color:white;padding:4px 0;font-size:14px;">Raiffeisenbank</td>
            </tr>
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">Empfänger:</td>
              <td style="color:white;padding:4px 0;font-size:14px;">LeadsHub, 8957 Spreitenbach</td>
            </tr>
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">Referenz:</td>
              <td style="color:white;padding:4px 0;font-size:14px;font-weight:600;">${invoice.invoice_number}</td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background:rgba(0,0,0,0.2);padding:24px 32px;border-top:1px solid rgba(255,255,255,0.1);">
        <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;">
          Freundliche Grüsse<br>
          <strong style="color:white;">LeadsHub</strong><br>
          <span style="font-size:12px;">Sandäckerstrasse 10, 8957 Spreitenbach</span>
        </p>
      </div>
      
    </div>
    
    <!-- Footer Links -->
    <div style="text-align:center;margin-top:24px;">
      <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;">
        © 2026 LeadsHub. Alle Rechte vorbehalten.
      </p>
    </div>
    
  </div>
</body>
</html>
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
