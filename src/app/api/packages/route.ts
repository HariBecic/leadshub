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
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', broker_id)
      .single()

    if (brokerError || !broker) {
      return NextResponse.json({ error: 'Broker nicht gefunden' }, { status: 404 })
    }

    // Create package
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
        status: 'pending'
      })
      .select()
      .single()

    if (pkgError) {
      return NextResponse.json({ error: 'Package error', details: pkgError.message }, { status: 500 })
    }

    // Generate invoice number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
    
    const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Create invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        broker_id,
        type: 'package',
        amount: price || 0,
        status: 'pending',
        due_date: dueDate.toISOString(),
        package_id: pkg.id
      })
      .select()
      .single()

    if (invError) {
      return NextResponse.json({ 
        success: true, 
        package: pkg,
        invoice_error: invError.message,
        email_sent: false 
      })
    }

    // Update package with invoice_id
    await supabase
      .from('lead_packages')
      .update({ invoice_id: invoice.id })
      .eq('id', pkg.id)

    // Send email with glassmorphism design
    let emailSent = false
    if (broker.email) {
      const packageName = name || `${total_leads}er Paket`
      const formattedDate = new Date().toLocaleDateString('de-CH')
      const formattedDueDate = dueDate.toLocaleDateString('de-CH')
      
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
        <div style="font-size:48px;margin-bottom:16px;">📦</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:white;">Lead-Paket bestellt</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);">${packageName}</p>
      </div>
      
      <!-- Content -->
      <div style="padding:32px;">
        <p style="color:rgba(255,255,255,0.9);font-size:16px;line-height:1.6;margin:0 0 24px;">
          Hallo ${broker.contact_person || broker.name},<br><br>
          Vielen Dank für Ihre Bestellung! Nach Zahlungseingang werden Ihre Leads automatisch zugestellt.
        </p>
        
        <!-- Invoice Details Card -->
        <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:24px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;">Rechnung</td>
              <td style="padding:12px 0;color:white;font-weight:600;text-align:right;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Datum</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Fällig bis</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${formattedDueDate}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Paket</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${packageName}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Anzahl Leads</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${total_leads}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Lieferart</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${distribution_type === 'instant' ? 'Sofort' : `Verteilt (${leads_per_day || 2}/Tag)`}</td>
            </tr>
          </table>
        </div>
        
        <!-- Amount Box -->
        <div style="background:linear-gradient(135deg,rgba(249,115,22,0.3) 0%,rgba(234,88,12,0.2) 100%);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;border:1px solid rgba(249,115,22,0.3);">
          <div style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:8px;">Zu zahlen</div>
          <div style="color:white;font-size:42px;font-weight:700;">CHF ${Number(price).toFixed(2)}</div>
        </div>
        
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
              <td style="color:white;padding:4px 0;font-size:14px;font-weight:600;">${invoiceNumber}</td>
            </tr>
          </table>
        </div>
        
        <!-- Info Box -->
        <div style="background:rgba(251,191,36,0.15);border-radius:12px;padding:16px;border:1px solid rgba(251,191,36,0.3);">
          <div style="color:#fde047;font-size:14px;">
            <strong>⚡ Hinweis:</strong> Ihre Leads werden automatisch nach Zahlungseingang per E-Mail zugestellt.
          </div>
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

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
          to: broker.email,
          subject: `📦 Rechnung ${invoiceNumber} - ${packageName}`,
          html: emailHtml
        })
        emailSent = true
        
        await supabase
          .from('invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', invoice.id)
      } catch (e: any) {
        console.error('Email error:', e)
      }
    }

    return NextResponse.json({ 
      success: true, 
      package: pkg,
      invoice: invoice,
      email_sent: emailSent 
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
