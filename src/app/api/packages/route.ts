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
        status: 'active',
        start_date: new Date().toISOString()
      })
      .select()
      .single()

    if (pkgError) {
      console.error('Package error:', pkgError)
      return NextResponse.json({ error: pkgError.message }, { status: 500 })
    }

    let emailSent = false
    let assignedLeads: any[] = []

    // For instant delivery, assign leads immediately
    if (distribution_type === 'instant') {
      // Find available leads
      let query = supabase
        .from('leads')
        .select('*, category:lead_categories(name)')
        .eq('status', 'new')
        .order('created_at', { ascending: true })
        .limit(total_leads)

      if (category_id) {
        query = query.eq('category_id', category_id)
      }

      const { data: leads } = await query

      if (leads && leads.length > 0) {
        assignedLeads = leads

        // Create assignments
        const assignments = leads.map(lead => ({
          lead_id: lead.id,
          broker_id,
          package_id: pkg.id,
          pricing_model: 'package',
          price_charged: price / total_leads,
          status: 'sent'
        }))

        await supabase.from('lead_assignments').insert(assignments)

        // Update leads status
        const leadIds = leads.map(l => l.id)
        await supabase
          .from('leads')
          .update({ status: 'assigned' })
          .in('id', leadIds)

        // Update package delivered count
        await supabase
          .from('lead_packages')
          .update({ 
            delivered_leads: leads.length,
            status: leads.length >= total_leads ? 'completed' : 'active'
          })
          .eq('id', pkg.id)

        // Send email with all leads
        if (broker.email && leads.length > 0) {
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
                <h1 style="margin:0;font-size:24px;">📦 Ihr Lead-Paket ist bereit!</h1>
                <p style="margin:8px 0 0;opacity:0.9;">${name || `${total_leads}er Paket`}</p>
              </div>
              <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
                <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
                <p style="color:#64748b;line-height:1.6;">
                  Ihr Paket mit ${leads.length} Leads wurde soeben aktiviert. Hier sind Ihre Leads:
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

                <div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0;">
                  <div style="color:#1e40af;font-size:14px;">
                    <strong>Paket-Details:</strong><br>
                    ${leads.length} von ${total_leads} Leads geliefert<br>
                    Gesamtpreis: CHF ${Number(price).toFixed(2)}
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
              subject: `📦 Ihr Lead-Paket: ${leads.length} Leads bereit - LeadsHub`,
              html: emailHtml
            })
            emailSent = true
          } catch (e) {
            console.error('Email error:', e)
          }
        }
      }
    } else {
      // For distributed delivery, send confirmation email
      if (broker.email) {
        const emailHtml = `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
              <h1 style="margin:0;font-size:24px;">📦 Lead-Paket aktiviert</h1>
            </div>
            <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
              <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
              <p style="color:#64748b;line-height:1.6;">
                Ihr Lead-Paket wurde aktiviert:
              </p>
              
              <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;">
                <table style="width:100%;font-size:14px;">
                  <tr><td style="color:#64748b;padding:8px 0;">Paket:</td><td style="color:#1e293b;font-weight:600;">${name || `${total_leads}er Paket`}</td></tr>
                  <tr><td style="color:#64748b;padding:8px 0;">Leads:</td><td style="color:#1e293b;font-weight:600;">${total_leads} Stück</td></tr>
                  <tr><td style="color:#64748b;padding:8px 0;">Lieferung:</td><td style="color:#1e293b;font-weight:600;">${leads_per_day || 2} Leads pro Tag</td></tr>
                  <tr><td style="color:#64748b;padding:8px 0;">Preis:</td><td style="color:#1e293b;font-weight:600;">CHF ${Number(price).toFixed(2)}</td></tr>
                </table>
              </div>

              <p style="color:#64748b;line-height:1.6;">
                Sie erhalten ab sofort täglich ${leads_per_day || 2} Leads per E-Mail, bis Ihr Paket vollständig geliefert ist.
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
            to: broker.email,
            subject: `📦 Lead-Paket aktiviert: ${total_leads} Leads - LeadsHub`,
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
      package: pkg,
      assigned_leads: assignedLeads.length,
      email_sent: emailSent 
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
