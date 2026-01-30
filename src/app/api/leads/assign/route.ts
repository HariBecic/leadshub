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
    const { lead_id, broker_id, pricing_model, price_charged, revenue_share_percent } = body

    console.log('Assign request:', body)

    if (!lead_id || !broker_id) {
      return NextResponse.json({ error: 'lead_id und broker_id erforderlich' }, { status: 400 })
    }

    // Get lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, category:lead_categories(name)')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      console.error('Lead error:', leadError)
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })
    }

    // Get broker
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', broker_id)
      .single()

    if (brokerError || !broker) {
      console.error('Broker error:', brokerError)
      return NextResponse.json({ error: 'Broker nicht gefunden' }, { status: 404 })
    }

    // Create assignment
    const { data: assignment, error: assignError } = await supabase
      .from('lead_assignments')
      .insert({
        lead_id,
        broker_id,
        pricing_model: pricing_model || 'single',
        price_charged: price_charged || 0,
        revenue_share_percent: revenue_share_percent || null,
        status: pricing_model === 'commission' ? 'sent' : 'pending' // commission = sofort, sonst warten auf Zahlung
      })
      .select()
      .single()

    if (assignError) {
      console.error('Assignment error:', assignError)
      return NextResponse.json({ error: assignError.message }, { status: 500 })
    }

    // For fixed/single: Create invoice, leads sent after payment
    // For commission: Send leads immediately (free), invoice at end of month
    let invoiceCreated = false
    let emailSent = false

    if (pricing_model === 'fixed' || pricing_model === 'single') {
      // Create invoice
      const year = new Date().getFullYear()
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`)
      
      const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`
      const categoryName = lead.category?.name || 'Lead'

      await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        broker_id,
        type: pricing_model,
        amount: price_charged || 0,
        description: `${categoryName}: ${lead.first_name} ${lead.last_name}`,
        status: 'pending',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assignment_id: assignment.id
      })

      invoiceCreated = true

      // Send invoice email (not lead details yet)
      if (broker.email) {
        const emailHtml = `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
              <h1 style="margin:0;font-size:24px;">📄 Neuer Lead verfügbar</h1>
            </div>
            <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
              <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
              <p style="color:#64748b;line-height:1.6;">
                Ein neuer ${categoryName}-Lead ist für Sie verfügbar. Nach Zahlungseingang erhalten Sie die vollständigen Kontaktdaten.
              </p>
              
              <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
                <div style="font-size:14px;color:#64748b;margin-bottom:8px;">Betrag</div>
                <div style="font-size:32px;font-weight:700;color:#1e293b;">CHF ${Number(price_charged).toFixed(2)}</div>
                <div style="font-size:14px;color:#64748b;margin-top:8px;">Rechnung: ${invoiceNumber}</div>
              </div>

              <div style="background:#fef3c7;border-radius:8px;padding:16px;margin:24px 0;">
                <div style="color:#92400e;font-size:14px;">
                  <strong>Hinweis:</strong> Die Lead-Daten werden Ihnen nach Zahlungseingang automatisch per E-Mail zugestellt.
                </div>
              </div>

              <div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0;">
                <div style="color:#1e40af;font-size:14px;">
                  <strong>Zahlungsdetails:</strong><br>
                  IBAN: CH00 0000 0000 0000 0000 0<br>
                  Empfänger: LeadsHub GmbH<br>
                  Referenz: ${invoiceNumber}
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
            subject: `Neuer ${categoryName}-Lead verfügbar - CHF ${Number(price_charged).toFixed(2)}`,
            html: emailHtml
          })
          emailSent = true
        } catch (e) {
          console.error('Email error:', e)
        }
      }
    } else {
      // Commission/Subscription: Send lead immediately
      // Update lead status
      await supabase
        .from('leads')
        .update({ 
          status: 'assigned',
          assignment_count: (lead.assignment_count || 0) + 1
        })
        .eq('id', lead_id)

      // Send email to broker with lead details
      if (broker.email) {
        const categoryName = lead.category?.name || 'Lead'
        
        const emailHtml = `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
              <h1 style="margin:0;font-size:24px;">🎯 Neuer Lead</h1>
            </div>
            <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
              <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
              <p style="color:#64748b;line-height:1.6;">
                Sie haben einen neuen ${categoryName}-Lead erhalten:
              </p>
              
              <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;">
                <table style="width:100%;font-size:14px;">
                  <tr><td style="color:#64748b;padding:8px 0;">Name:</td><td style="color:#1e293b;font-weight:600;">${lead.first_name} ${lead.last_name}</td></tr>
                  ${lead.email ? `<tr><td style="color:#64748b;padding:8px 0;">E-Mail:</td><td style="color:#1e293b;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>` : ''}
                  ${lead.phone ? `<tr><td style="color:#64748b;padding:8px 0;">Telefon:</td><td style="color:#1e293b;"><a href="tel:${lead.phone}">${lead.phone}</a></td></tr>` : ''}
                  ${lead.plz || lead.ort ? `<tr><td style="color:#64748b;padding:8px 0;">Standort:</td><td style="color:#1e293b;">${lead.plz || ''} ${lead.ort || ''}</td></tr>` : ''}
                </table>
              </div>

              ${pricing_model === 'commission' ? `
              <div style="background:#f3e8ff;border-radius:8px;padding:16px;margin:24px 0;">
                <div style="color:#7c3aed;font-size:14px;">
                  <strong>Beteiligungsmodell:</strong> Bei erfolgreichem Abschluss wird eine Provision von ${revenue_share_percent}% fällig.
                  Wir fragen in einigen Tagen nach dem Status.
                </div>
              </div>
              ` : ''}
              
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
            subject: `Neuer ${categoryName}-Lead: ${lead.first_name} ${lead.last_name}`,
            html: emailHtml
          })
          emailSent = true
        } catch (e) {
          console.error('Email error:', e)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      assignment,
      invoice_created: invoiceCreated,
      email_sent: emailSent 
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
