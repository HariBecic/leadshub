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

    // Get invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, broker:brokers(*)')
      .eq('id', invoice_id)
      .single()

    if (!invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    // Mark invoice as paid
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoice_id)

    let leadsDelivered = 0
    let emailSent = false

    // Check if it's a package invoice
    if (invoice.package_id) {
      // Get package
      const { data: pkg } = await supabase
        .from('lead_packages')
        .select('*')
        .eq('id', invoice.package_id)
        .single()

      if (pkg) {
        // Activate package
        await supabase
          .from('lead_packages')
          .update({ status: 'active', paid_at: new Date().toISOString() })
          .eq('id', pkg.id)

        // For instant delivery, assign leads now
        if (pkg.distribution_type === 'instant') {
          const result = await deliverPackageLeads(pkg, invoice.broker)
          leadsDelivered = result.delivered
          emailSent = result.emailSent
        } else {
          // For distributed, send confirmation
          if (invoice.broker?.email) {
            const emailHtml = `
              <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
                  <h1 style="margin:0;font-size:24px;">✅ Zahlung erhalten</h1>
                </div>
                <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
                  <p style="font-size:16px;color:#1e293b;">Hallo ${invoice.broker.contact_person || invoice.broker.name},</p>
                  <p style="color:#64748b;line-height:1.6;">
                    Vielen Dank! Ihre Zahlung für "${pkg.name}" ist eingegangen.
                  </p>
                  <p style="color:#64748b;line-height:1.6;">
                    Sie erhalten ab sofort täglich ${pkg.leads_per_day} Leads per E-Mail, bis alle ${pkg.total_leads} Leads geliefert sind.
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
                from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
                to: invoice.broker.email,
                subject: `✅ Zahlung erhalten - ${pkg.name} aktiviert`,
                html: emailHtml
              })
              emailSent = true
            } catch (e) {
              console.error('Email error:', e)
            }
          }
        }
      }
    }

    // Check if it's a single lead invoice
    if (invoice.assignment_id) {
      const { data: assignment } = await supabase
        .from('lead_assignments')
        .select('*, lead:leads(*, category:lead_categories(name))')
        .eq('id', invoice.assignment_id)
        .single()

      if (assignment && assignment.lead) {
        // Update assignment status
        await supabase
          .from('lead_assignments')
          .update({ status: 'sent' })
          .eq('id', assignment.id)

        // Update lead status
        await supabase
          .from('leads')
          .update({ status: 'assigned' })
          .eq('id', assignment.lead.id)

        leadsDelivered = 1

        // Send lead details to broker
        if (invoice.broker?.email) {
          const lead = assignment.lead
          const categoryName = lead.category?.name || 'Lead'
          
          const emailHtml = `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
                <h1 style="margin:0;font-size:24px;">🎯 Ihr Lead ist da!</h1>
              </div>
              <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
                <p style="font-size:16px;color:#1e293b;">Hallo ${invoice.broker.contact_person || invoice.broker.name},</p>
                <p style="color:#64748b;line-height:1.6;">
                  Vielen Dank für Ihre Zahlung! Hier sind die Kontaktdaten Ihres ${categoryName}-Leads:
                </p>
                
                <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;">
                  <table style="width:100%;font-size:14px;">
                    <tr><td style="color:#64748b;padding:8px 0;">Name:</td><td style="color:#1e293b;font-weight:600;">${lead.first_name} ${lead.last_name}</td></tr>
                    ${lead.email ? `<tr><td style="color:#64748b;padding:8px 0;">E-Mail:</td><td style="color:#1e293b;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>` : ''}
                    ${lead.phone ? `<tr><td style="color:#64748b;padding:8px 0;">Telefon:</td><td style="color:#1e293b;"><a href="tel:${lead.phone}">${lead.phone}</a></td></tr>` : ''}
                    ${lead.plz || lead.ort ? `<tr><td style="color:#64748b;padding:8px 0;">Standort:</td><td style="color:#1e293b;">${lead.plz || ''} ${lead.ort || ''}</td></tr>` : ''}
                  </table>
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
              to: invoice.broker.email,
              subject: `🎯 Ihr ${categoryName}-Lead: ${lead.first_name} ${lead.last_name}`,
              html: emailHtml
            })
            emailSent = true
          } catch (e) {
            console.error('Email error:', e)
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      leads_delivered: leadsDelivered,
      email_sent: emailSent
    })

  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

// Helper function to deliver package leads
async function deliverPackageLeads(pkg: any, broker: any) {
  const leadsNeeded = pkg.total_leads - (pkg.delivered_leads || 0)
  if (leadsNeeded <= 0) return { delivered: 0, emailSent: false }

  // Find available leads
  let query = supabase
    .from('leads')
    .select('*, category:lead_categories(name)')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(leadsNeeded)

  if (pkg.category_id) {
    query = query.eq('category_id', pkg.category_id)
  }

  const { data: leads } = await query

  if (!leads || leads.length === 0) {
    return { delivered: 0, emailSent: false }
  }

  // Create assignments
  const assignments = leads.map(lead => ({
    lead_id: lead.id,
    broker_id: pkg.broker_id,
    package_id: pkg.id,
    pricing_model: 'package',
    price_charged: pkg.price / pkg.total_leads,
    status: 'sent'
  }))

  await supabase.from('lead_assignments').insert(assignments)

  // Update leads status
  const leadIds = leads.map(l => l.id)
  await supabase
    .from('leads')
    .update({ status: 'assigned' })
    .in('id', leadIds)

  // Update package
  const newDelivered = (pkg.delivered_leads || 0) + leads.length
  await supabase
    .from('lead_packages')
    .update({ 
      delivered_leads: newDelivered,
      status: newDelivered >= pkg.total_leads ? 'completed' : 'active'
    })
    .eq('id', pkg.id)

  // Send email
  let emailSent = false
  if (broker?.email && leads.length > 0) {
    const leadRows = leads.map(lead => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:500;">${lead.first_name} ${lead.last_name}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${lead.email || '-'}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${lead.phone || '-'}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${lead.plz || ''} ${lead.ort || ''}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${lead.category?.name || '-'}</td>
      </tr>
    `).join('')

    const emailHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
          <h1 style="margin:0;font-size:24px;">📦 Ihre Leads sind da!</h1>
          <p style="margin:8px 0 0;opacity:0.9;">${pkg.name}</p>
        </div>
        <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
          <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
          <p style="color:#64748b;line-height:1.6;">
            ${leads.length === pkg.total_leads 
              ? `Alle ${leads.length} Leads aus Ihrem Paket sind jetzt verfügbar:` 
              : `${leads.length} von ${pkg.total_leads} Leads wurden geliefert. Die restlichen folgen sobald verfügbar:`}
          </p>
          
          <div style="overflow-x:auto;margin:24px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Name</th>
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">E-Mail</th>
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Telefon</th>
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Standort</th>
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Kategorie</th>
                </tr>
              </thead>
              <tbody>
                ${leadRows}
              </tbody>
            </table>
          </div>

          <div style="background:#d1fae5;border-radius:8px;padding:16px;margin:24px 0;">
            <div style="color:#065f46;font-size:14px;">
              <strong>Status:</strong> ${newDelivered} von ${pkg.total_leads} Leads geliefert
              ${newDelivered >= pkg.total_leads ? ' ✅ Paket vollständig!' : ''}
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
        subject: `📦 ${leads.length} Leads geliefert - ${pkg.name}`,
        html: emailHtml
      })
      emailSent = true
    } catch (e) {
      console.error('Email error:', e)
    }
  }

  return { delivered: leads.length, emailSent }
}
