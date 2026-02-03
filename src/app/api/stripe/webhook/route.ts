import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature, getStripe } from '@/lib/stripe'
import { Resend } from 'resend'
import Stripe from 'stripe'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

// Hilfsfunktion: Label formatieren
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Keine Stripe-Signatur' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET nicht konfiguriert')
      return NextResponse.json({ error: 'Webhook nicht konfiguriert' }, { status: 500 })
    }

    // Webhook-Event verifizieren
    let event: Stripe.Event
    try {
      event = verifyWebhookSignature(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook Signatur ungültig:', err)
      return NextResponse.json({ error: 'Ungültige Signatur' }, { status: 400 })
    }

    console.log(`Stripe Webhook Event empfangen: ${event.type}`)

    // Nur checkout.session.completed und payment_intent.succeeded behandeln
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      console.log('Checkout Session Details:', {
        id: session.id,
        payment_link: session.payment_link,
        metadata: session.metadata,
        payment_status: session.payment_status
      })

      // Bei Payment Links: Metadata kann in Session oder Payment Link sein
      let invoiceId = session.metadata?.invoice_id

      // Fallback: Wenn keine invoice_id in Session, über payment_link_id in DB suchen
      if (!invoiceId && session.payment_link) {
        const paymentLinkId = typeof session.payment_link === 'string'
          ? session.payment_link
          : session.payment_link.id

        console.log(`Suche Invoice mit stripe_payment_id: ${paymentLinkId}`)

        // Invoice über stripe_payment_id (Payment Link ID) finden
        const { data: invoiceFromDb, error: dbError } = await supabase
          .from('invoices')
          .select('id')
          .eq('stripe_payment_id', paymentLinkId)
          .single()

        if (dbError) {
          console.error('DB Fehler beim Suchen der Invoice:', dbError)
        }

        if (invoiceFromDb) {
          invoiceId = invoiceFromDb.id
          console.log(`Invoice ID via Payment Link gefunden: ${invoiceId}`)
        } else {
          console.log('Keine Invoice mit dieser Payment Link ID gefunden')
        }
      }

      if (invoiceId) {
        console.log(`Verarbeite Zahlung für Invoice: ${invoiceId}`)
        await handlePaymentSuccess(invoiceId, session.id)
      } else {
        console.error('Keine Invoice ID gefunden in Session oder via Payment Link lookup')
      }
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      // Bei Payment Links kommt das Event über payment_intent
      if (paymentIntent.metadata?.invoice_id) {
        await handlePaymentSuccess(paymentIntent.metadata.invoice_id, paymentIntent.id)
      }
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    console.error('Webhook Error:', err)
    return NextResponse.json({ error: 'Webhook Fehler' }, { status: 500 })
  }
}

async function handlePaymentSuccess(invoiceId: string | undefined, stripePaymentId: string) {
  console.log(`handlePaymentSuccess aufgerufen mit invoiceId: ${invoiceId}, stripePaymentId: ${stripePaymentId}`)

  if (!invoiceId) {
    console.error('Keine Invoice ID im Payment Event')
    return
  }

  // Rechnung mit allen Relations laden (inkl. assignment_id für Lead-Delivery)
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, broker:brokers(*), assignment_id, package_id')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    console.error('Rechnung nicht gefunden:', invoiceId, invoiceError)
    return
  }

  console.log('Invoice gefunden:', {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    type: invoice.type,
    status: invoice.status,
    package_id: invoice.package_id,
    assignment_id: invoice.assignment_id,
    broker_email: invoice.broker?.email
  })

  // Bereits bezahlt? Dann nichts tun
  if (invoice.status === 'paid') {
    console.log('Rechnung bereits bezahlt:', invoice.invoice_number)
    return
  }

  // Rechnung als bezahlt markieren
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: 'stripe',
      stripe_payment_id: stripePaymentId,
    })
    .eq('id', invoiceId)

  if (updateError) {
    console.error('Fehler beim Aktualisieren der Rechnung:', updateError)
    return
  }

  console.log(`Rechnung ${invoice.invoice_number} als bezahlt markiert (Stripe: ${stripePaymentId})`)

  // Je nach Rechnungstyp: Lead(s) freigeben
  if (invoice.type === 'single' || invoice.type === 'fixed') {
    await deliverSingleLead(invoice)
  } else if (invoice.type === 'package') {
    await activatePackage(invoice)
  }
}

// Einzelnen Lead freigeben (fixed/single)
async function deliverSingleLead(invoice: any) {
  // Lead Assignment finden (über assignment_id in der Invoice)
  if (!invoice.assignment_id) {
    console.error('Keine assignment_id in Rechnung:', invoice.id)
    return
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*, category:lead_categories(*))')
    .eq('id', invoice.assignment_id)
    .single()

  if (assignmentError || !assignment) {
    console.error('Keine Lead-Zuweisung gefunden für assignment_id:', invoice.assignment_id)
    return
  }

  // Assignment auf "sent" setzen
  await supabase
    .from('lead_assignments')
    .update({ status: 'sent', email_sent_at: new Date().toISOString() })
    .eq('id', assignment.id)

  // Lead-Status aktualisieren
  await supabase
    .from('leads')
    .update({ status: 'assigned' })
    .eq('id', assignment.lead_id)

  const lead = assignment.lead
  if (!lead || !invoice.broker?.email) return

  // E-Mail mit Lead-Daten senden
  const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unbekannt'

  // Extra-Daten HTML erstellen
  let extraDataHtml = ''
  if (lead.extra_data && Object.keys(lead.extra_data).length > 0) {
    const extraItems = Object.entries(lead.extra_data)
      .filter(([key]) => !key.startsWith('meta_'))
      .filter(([_, value]) => value && String(value).trim() !== '')
      .map(([key, value]) => `
        <tr>
          <td style="padding:12px 16px;color:rgba(255,255,255,0.6);font-size:14px;border-bottom:1px solid rgba(255,255,255,0.1);">${formatLabel(key)}</td>
          <td style="padding:12px 16px;color:white;font-weight:500;border-bottom:1px solid rgba(255,255,255,0.1);">${String(value)}</td>
        </tr>
      `).join('')

    if (extraItems) {
      extraDataHtml = `
        <div style="margin-top:24px;">
          <div style="color:rgba(255,255,255,0.5);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Zusatzangaben</div>
          <div style="background:rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;">
              ${extraItems}
            </table>
          </div>
        </div>
      `
    }
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%);min-height:100vh;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <img src="https://leadshub2.vercel.app/logo.png" alt="LeadsHub" style="height:48px;width:auto;" />
    </div>

    <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:24px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;">

      <div style="background:linear-gradient(135deg,rgba(34,197,94,0.3) 0%,rgba(22,163,74,0.2) 100%);padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:white;">Zahlung erhalten!</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);">Ihr Lead ist jetzt verfügbar</p>
      </div>

      <div style="padding:32px;">
        <p style="color:rgba(255,255,255,0.9);font-size:16px;line-height:1.6;margin:0 0 24px;">
          Hallo ${invoice.broker.contact_person || invoice.broker.name},<br><br>
          Vielen Dank für Ihre Zahlung! Hier sind die Kontaktdaten Ihres <strong>${lead.category?.name || 'Leads'}</strong>:
        </p>

        <div style="color:rgba(255,255,255,0.5);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Kontaktdaten</div>
        <div style="background:rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:12px 16px;color:rgba(255,255,255,0.6);font-size:14px;border-bottom:1px solid rgba(255,255,255,0.1);">Name</td>
              <td style="padding:12px 16px;color:white;font-weight:500;border-bottom:1px solid rgba(255,255,255,0.1);">${leadName}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:rgba(255,255,255,0.6);font-size:14px;border-bottom:1px solid rgba(255,255,255,0.1);">E-Mail</td>
              <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.1);"><a href="mailto:${lead.email}" style="color:#a78bfa;text-decoration:none;">${lead.email || '-'}</a></td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:rgba(255,255,255,0.6);font-size:14px;border-bottom:1px solid rgba(255,255,255,0.1);">Telefon</td>
              <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.1);"><a href="tel:${lead.phone}" style="color:#a78bfa;text-decoration:none;">${lead.phone || '-'}</a></td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:rgba(255,255,255,0.6);font-size:14px;">PLZ / Ort</td>
              <td style="padding:12px 16px;color:white;font-weight:500;">${lead.plz || ''} ${lead.ort || ''}</td>
            </tr>
          </table>
        </div>

        ${extraDataHtml}

        <div style="margin-top:24px;background:rgba(34,197,94,0.2);border-radius:12px;padding:16px;border:1px solid rgba(34,197,94,0.3);">
          <p style="margin:0;color:#86efac;font-size:14px;">
            <strong>Tipp:</strong> Kontaktieren Sie den Lead möglichst innerhalb von 24 Stunden für die beste Conversion-Rate.
          </p>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.2);padding:24px 32px;border-top:1px solid rgba(255,255,255,0.1);">
        <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;">
          Freundliche Grüsse<br>
          <strong style="color:white;">LeadsHub</strong>
        </p>
      </div>

    </div>

  </div>
</body>
</html>
  `

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
    to: invoice.broker.email,
    subject: `🎉 Ihr Lead ist da! - ${lead.category?.name || 'Lead'}`,
    html: emailHtml
  })

  console.log(`Lead-E-Mail gesendet an ${invoice.broker.email}`)
}

// Lead-Paket aktivieren
async function activatePackage(invoice: any) {
  console.log(`activatePackage aufgerufen für Rechnung: ${invoice.id}`)

  // Paket finden - auch über package_id in der Invoice
  let pkg = null
  let pkgError = null

  // Erst über invoice_id suchen
  const result1 = await supabase
    .from('lead_packages')
    .select('*')
    .eq('invoice_id', invoice.id)
    .single()

  if (result1.data) {
    pkg = result1.data
    console.log('Paket über invoice_id gefunden:', pkg.name)
  } else if (invoice.package_id) {
    // Fallback: über package_id in der Invoice suchen
    const result2 = await supabase
      .from('lead_packages')
      .select('*')
      .eq('id', invoice.package_id)
      .single()

    if (result2.data) {
      pkg = result2.data
      console.log('Paket über package_id gefunden:', pkg.name)
    } else {
      pkgError = result2.error
    }
  } else {
    pkgError = result1.error
  }

  if (pkgError || !pkg) {
    console.error('Kein Paket gefunden für Rechnung:', invoice.id, pkgError)
    return
  }

  console.log('Paket Details:', {
    id: pkg.id,
    name: pkg.name,
    total_leads: pkg.total_leads,
    delivered_leads: pkg.delivered_leads,
    distribution_type: pkg.distribution_type,
    status: pkg.status
  })

  // Check if there are pre-reserved leads (from "from-leads" creation)
  const { data: pendingAssignments, error: assignError } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*, category:lead_categories(*))')
    .eq('package_id', pkg.id)
    .eq('status', 'pending')

  console.log(`Gefundene pending Assignments: ${pendingAssignments?.length || 0}`, assignError)

  if (pendingAssignments && pendingAssignments.length > 0) {
    // This is a package with pre-selected leads - deliver them now
    console.log(`Paket ${pkg.name} hat ${pendingAssignments.length} reservierte Leads - liefere jetzt`)

    // Update assignments to 'sent' and unlock
    const assignmentIds = pendingAssignments.map(a => a.id)
    await supabase
      .from('lead_assignments')
      .update({
        status: 'sent',
        unlocked: true,
        email_sent_at: new Date().toISOString()
      })
      .in('id', assignmentIds)

    // Update package to completed (all leads already assigned)
    await supabase
      .from('lead_packages')
      .update({
        status: 'completed',
        activated_at: new Date().toISOString(),
        delivered_leads: pendingAssignments.length
      })
      .eq('id', pkg.id)

    // Send email with all lead details
    if (invoice.broker?.email) {
      const leads = pendingAssignments.map(a => a.lead).filter(Boolean)
      await sendPackageLeadsEmail(invoice.broker, leads, pkg.name)
    }

    console.log(`Paket ${pkg.name} abgeschlossen - ${pendingAssignments.length} Leads geliefert`)
    return
  }

  // Standard package flow - no pre-reserved leads
  // Paket aktivieren
  await supabase
    .from('lead_packages')
    .update({
      status: 'active',
      activated_at: new Date().toISOString()
    })
    .eq('id', pkg.id)

  console.log(`Paket ${pkg.name} aktiviert für Broker ${invoice.broker?.name}`)

  // Bei "instant" Delivery: Leads sofort liefern via bestehenden Endpoint
  if (pkg.distribution_type === 'instant') {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      await fetch(`${baseUrl}/api/packages/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkg.id })
      })
    } catch (err) {
      console.error('Fehler beim Instant-Delivery:', err)
    }
  }
}

// Send email with package leads after payment
async function sendPackageLeadsEmail(broker: any, leads: any[], packageName: string) {
  const leadsTableRows = leads.map(lead => {
    let extraDataHtml = ''
    if (lead.extra_data && Object.keys(lead.extra_data).length > 0) {
      const extraItems = Object.entries(lead.extra_data)
        .filter(([key]) => !key.startsWith('meta_'))
        .filter(([_, value]) => value && String(value).trim() !== '')
        .slice(0, 5)
        .map(([key, value]) => `${formatLabel(key)}: ${String(value)}`)
        .join(', ')
      if (extraItems) {
        extraDataHtml = `<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">${extraItems}</div>`
      }
    }

    return `
      <tr>
        <td style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="color:white;font-weight:500;">${lead.first_name || ''} ${lead.last_name || ''}</div>
          ${extraDataHtml}
        </td>
        <td style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <a href="mailto:${lead.email}" style="color:#a78bfa;text-decoration:none;">${lead.email || '-'}</a>
        </td>
        <td style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <a href="tel:${lead.phone}" style="color:#a78bfa;text-decoration:none;">${lead.phone || '-'}</a>
        </td>
        <td style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);">
          ${lead.plz || ''} ${lead.ort || ''}
        </td>
        <td style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);">
          ${lead.category?.name || '-'}
        </td>
      </tr>
    `
  }).join('')

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%);min-height:100vh;">
  <div style="max-width:800px;margin:0 auto;padding:40px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <img src="https://leadshub2.vercel.app/logo.png" alt="LeadsHub" style="height:48px;width:auto;" />
    </div>

    <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:24px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;">

      <div style="background:linear-gradient(135deg,rgba(34,197,94,0.3) 0%,rgba(22,163,74,0.2) 100%);padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:white;">Zahlung erhalten!</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);">${packageName} - ${leads.length} Leads</p>
      </div>

      <div style="padding:32px;">
        <p style="color:rgba(255,255,255,0.9);font-size:16px;line-height:1.6;margin:0 0 24px;">
          Hallo ${broker.contact_person || broker.name},<br><br>
          Vielen Dank für Ihre Zahlung! Hier sind Ihre <strong>${leads.length} Leads</strong>:
        </p>

        <div style="background:rgba(255,255,255,0.05);border-radius:16px;overflow:hidden;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(255,255,255,0.1);">
                <th style="padding:12px 16px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">NAME</th>
                <th style="padding:12px 16px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">E-MAIL</th>
                <th style="padding:12px 16px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">TELEFON</th>
                <th style="padding:12px 16px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">ORT</th>
                <th style="padding:12px 16px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">KATEGORIE</th>
              </tr>
            </thead>
            <tbody>
              ${leadsTableRows}
            </tbody>
          </table>
        </div>

        <div style="background:rgba(34,197,94,0.15);border-radius:12px;padding:16px;border:1px solid rgba(34,197,94,0.3);">
          <p style="margin:0;color:#86efac;font-size:14px;">
            <strong>Tipp:</strong> Kontaktieren Sie die Leads möglichst innerhalb von 24 Stunden für die beste Conversion-Rate.
          </p>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.2);padding:24px 32px;border-top:1px solid rgba(255,255,255,0.1);">
        <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;">
          Freundliche Grüsse<br>
          <strong style="color:white;">LeadsHub</strong>
        </p>
      </div>

    </div>

  </div>
</body>
</html>
  `

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
      to: broker.email,
      subject: `🎉 ${packageName} - ${leads.length} Leads verfügbar`,
      html: emailHtml
    })
    console.log(`Package leads email sent to ${broker.email}`)
  } catch (e) {
    console.error('Error sending package leads email:', e)
  }
}
