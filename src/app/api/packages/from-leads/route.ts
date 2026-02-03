import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createPaymentLink } from '@/lib/stripe'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lead_ids, broker_id, name, price, distribution_type, leads_per_day } = body

    if (!broker_id || !lead_ids || lead_ids.length === 0) {
      return NextResponse.json({ error: 'broker_id und lead_ids erforderlich' }, { status: 400 })
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

    // Get all leads to verify they exist
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id')
      .in('id', lead_ids)

    if (leadsError || !leads || leads.length === 0) {
      return NextResponse.json({ error: 'Leads nicht gefunden' }, { status: 404 })
    }

    const totalLeads = leads.length
    const packageName = name || `${totalLeads}er Paket`
    const packagePrice = price || 0

    // Create package with status='pending' (will be activated after payment)
    const { data: pkg, error: pkgError } = await supabase
      .from('lead_packages')
      .insert({
        name: packageName,
        broker_id,
        category_id: null,
        total_leads: totalLeads,
        delivered_leads: 0,
        price: packagePrice,
        distribution_type: distribution_type || 'instant',
        leads_per_day: distribution_type === 'distributed' ? (leads_per_day || 2) : null,
        status: 'pending'
      })
      .select()
      .single()

    if (pkgError) {
      return NextResponse.json({ error: 'Package error', details: pkgError.message }, { status: 500 })
    }

    // Mark leads as reserved (will be assigned after payment)
    await supabase
      .from('leads')
      .update({ status: 'reserved' })
      .in('id', lead_ids)
    console.log(`${lead_ids.length} Leads als reserviert markiert`)

    // Generate invoice number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)

    const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Create invoice - store lead_ids in description as JSON for later retrieval
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        broker_id,
        type: 'package',
        amount: packagePrice,
        status: 'pending',
        due_date: dueDate.toISOString(),
        package_id: pkg.id,
        description: JSON.stringify({ lead_ids: lead_ids, package_name: packageName })
      })
      .select()
      .single()

    if (invError) {
      console.error('Invoice error:', invError)
      return NextResponse.json({
        success: true,
        package: pkg,
        invoice_error: invError.message
      })
    }

    // Update package with invoice_id
    await supabase
      .from('lead_packages')
      .update({ invoice_id: invoice.id })
      .eq('id', pkg.id)

    // Create Stripe Payment Link
    let stripePaymentLink = null
    console.log(`Erstelle Stripe Payment Link für Preis: ${packagePrice}`)

    if (packagePrice > 0) {
      try {
        const { paymentLink, paymentLinkId } = await createPaymentLink({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: packagePrice,
          description: `Lead-Paket: ${packageName} (${totalLeads} Leads)`,
          customerEmail: broker.email
        })

        stripePaymentLink = paymentLink
        console.log(`Stripe Payment Link erstellt: ${paymentLink}`)

        // Save payment link to invoice
        await supabase
          .from('invoices')
          .update({
            stripe_payment_link: paymentLink,
            stripe_payment_id: paymentLinkId
          })
          .eq('id', invoice.id)
      } catch (stripeErr: any) {
        console.error('Stripe error:', stripeErr?.message || stripeErr)
      }
    } else {
      console.log('Kein Stripe Link erstellt - Preis ist 0')
    }

    // Send email with Stripe payment button
    let emailSent = false
    let emailError: string | null = null
    console.log(`Sende E-Mail an: ${broker.email}, Payment Link: ${stripePaymentLink ? 'vorhanden' : 'FEHLT'}`)

    if (broker.email) {
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
        <h1 style="margin:0;font-size:24px;font-weight:700;color:white;">Lead-Paket reserviert</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);">${packageName} - ${totalLeads} Leads</p>
      </div>

      <!-- Content -->
      <div style="padding:32px;">
        <p style="color:rgba(255,255,255,0.9);font-size:16px;line-height:1.6;margin:0 0 24px;">
          Hallo ${broker.contact_person || broker.name},<br><br>
          Wir haben <strong>${totalLeads} Leads</strong> für Sie reserviert! Nach Zahlungseingang werden Ihnen die Lead-Daten automatisch per E-Mail zugestellt.
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
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Paket</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${packageName}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Anzahl Leads</td>
              <td style="padding:12px 0;color:white;font-weight:600;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${totalLeads}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Preis pro Lead</td>
              <td style="padding:12px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">CHF ${(packagePrice / totalLeads).toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Amount Box -->
        <div style="background:linear-gradient(135deg,rgba(249,115,22,0.3) 0%,rgba(234,88,12,0.2) 100%);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;border:1px solid rgba(249,115,22,0.3);">
          <div style="color:rgba(255,255,255,0.7);font-size:14px;margin-bottom:8px;">Gesamtbetrag</div>
          <div style="color:white;font-size:42px;font-weight:700;">CHF ${Number(packagePrice).toFixed(2)}</div>
        </div>

        ${stripePaymentLink ? `
        <!-- Stripe Payment Button -->
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${stripePaymentLink}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);color:white;padding:16px 48px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;">
            💳 Jetzt bezahlen
          </a>
        </div>
        ` : ''}

        <!-- Info Box -->
        <div style="background:rgba(34,197,94,0.15);border-radius:12px;padding:16px;border:1px solid rgba(34,197,94,0.3);">
          <div style="color:#86efac;font-size:14px;">
            <strong>✓ Sofortige Lieferung:</strong> Nach erfolgreicher Zahlung erhalten Sie sofort eine E-Mail mit allen Lead-Daten (Name, E-Mail, Telefon, etc.).
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
        console.log('Sende E-Mail...')
        const emailResult = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
          to: broker.email,
          subject: `📦 ${packageName} - ${totalLeads} Leads reserviert`,
          html: emailHtml
        })
        console.log('E-Mail gesendet:', emailResult)
        emailSent = true

        await supabase
          .from('invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', invoice.id)
      } catch (e: any) {
        emailError = e?.message || String(e)
        console.error('Email error:', emailError)
      }
    } else {
      emailError = 'Broker hat keine E-Mail-Adresse'
      console.log('Keine E-Mail gesendet - broker.email fehlt')
    }

    console.log(`Paket erstellt: ${pkg.id}, E-Mail gesendet: ${emailSent}, Broker E-Mail: ${broker.email || 'KEINE'}`)

    return NextResponse.json({
      success: true,
      package: pkg,
      invoice: invoice,
      payment_link: stripePaymentLink,
      reserved_leads: totalLeads,
      email_sent: emailSent,
      email_error: emailError,
      broker_email: broker.email || null,
      debug: {
        price: packagePrice,
        broker_has_email: !!broker.email,
        stripe_link_created: !!stripePaymentLink
      }
    })

  } catch (err: any) {
    console.error('Server error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
