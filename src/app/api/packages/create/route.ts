import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .single()

  if (data?.invoice_number) {
    const lastNum = parseInt(data.invoice_number.split('-')[1])
    return `${year}-${String(lastNum + 1).padStart(4, '0')}`
  }
  return `${year}-0001`
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { broker_id, category_id, name, total_leads, price, distribution_type, leads_per_day } = body

  if (!broker_id || !name || !total_leads || !price) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
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

  // Create invoice first
  const invoiceNumber = await getNextInvoiceNumber()
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert([{
      invoice_number: invoiceNumber,
      broker_id,
      type: 'single',
      status: 'pending',
      amount: price,
      due_date: dueDate.toISOString().split('T')[0]
    }])
    .select()
    .single()

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  // Create package
  const { data: pkg, error: pkgError } = await supabase
    .from('lead_packages')
    .insert([{
      broker_id,
      category_id: category_id || null,
      name,
      total_leads,
      delivered_leads: 0,
      price,
      distribution_type,
      leads_per_day: leads_per_day || 1,
      status: 'pending',
      invoice_id: invoice.id
    }])
    .select()
    .single()

  if (pkgError) {
    return NextResponse.json({ error: pkgError.message }, { status: 500 })
  }

  // Add invoice item
  await supabase
    .from('invoice_items')
    .insert([{
      invoice_id: invoice.id,
      description: `Lead-Paket: ${name} (${total_leads} Leads)`,
      quantity: 1,
      unit_price: price,
      total: price
    }])

  // Send payment email
  let emailSent = false
  if (broker.email) {
    const baseUrl = request.nextUrl.origin
    const pricePerLead = (price / total_leads).toFixed(2)
    const deliveryText = distribution_type === 'instant' 
      ? 'Alle Leads werden sofort nach Zahlungseingang geliefert.'
      : `Die Leads werden über ${Math.ceil(total_leads / (leads_per_day || 1))} Arbeitstage verteilt geliefert (${leads_per_day || 1} Lead(s) pro Tag).`

    const emailHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#F26444 0%,#D94E30 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
          <h1 style="margin:0;font-size:24px;">📦 Ihr Lead-Paket</h1>
        </div>
        <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
          <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
          <p style="color:#64748b;line-height:1.6;">
            Vielen Dank für Ihre Bestellung! Hier sind die Details zu Ihrem Lead-Paket:
          </p>
          
          <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;">
            <div style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:12px;">${name}</div>
            <table style="width:100%;font-size:14px;">
              <tr><td style="color:#64748b;padding:4px 0;">Anzahl Leads:</td><td style="color:#1e293b;font-weight:600;">${total_leads}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0;">Preis pro Lead:</td><td style="color:#1e293b;">CHF ${pricePerLead}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0;">Lieferung:</td><td style="color:#1e293b;">${distribution_type === 'instant' ? 'Sofort' : 'Verteilt'}</td></tr>
            </table>
          </div>

          <div style="background:#fef3c7;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
            <div style="font-size:14px;color:#92400e;margin-bottom:4px;">Gesamtbetrag</div>
            <div style="font-size:36px;font-weight:700;color:#92400e;">CHF ${Number(price).toFixed(2)}</div>
          </div>

          <p style="color:#64748b;line-height:1.6;font-size:14px;">
            ${deliveryText}
          </p>

          <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;">
            <div style="font-weight:600;margin-bottom:12px;color:#1e293b;">Zahlungsinformationen</div>
            <div style="color:#64748b;font-size:14px;">
              <div style="margin-bottom:4px;"><strong>Bank:</strong> PostFinance</div>
              <div style="margin-bottom:4px;"><strong>IBAN:</strong> CH00 0000 0000 0000 0000 0</div>
              <div><strong>Referenz:</strong> ${invoiceNumber}</div>
            </div>
          </div>
          
          <p style="color:#64748b;font-size:14px;">
            Sobald die Zahlung eingegangen ist, werden Ihre Leads freigeschaltet.
          </p>
          
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
        from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
        to: broker.email,
        subject: `Lead-Paket: ${name} - Rechnung ${invoiceNumber}`,
        html: emailHtml
      })
      emailSent = true
    } catch (e) {
      console.error('Email error:', e)
    }
  }

  return NextResponse.json({ success: true, package: pkg, invoice, email_sent: emailSent })
}
