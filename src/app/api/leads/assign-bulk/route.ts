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
    const { lead_ids, broker_id, pricing_model, price_charged, revenue_share_percent } = body

    console.log('Bulk assign request:', body)

    if (!lead_ids || !lead_ids.length || !broker_id) {
      return NextResponse.json({ error: 'lead_ids und broker_id erforderlich' }, { status: 400 })
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

    // Get all leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*, category:lead_categories(name)')
      .in('id', lead_ids)

    if (leadsError || !leads || leads.length === 0) {
      return NextResponse.json({ error: 'Leads nicht gefunden' }, { status: 404 })
    }

    // Create assignments for all leads
    const assignments = leads.map(lead => ({
      lead_id: lead.id,
      broker_id,
      pricing_model: pricing_model || 'single',
      price_charged: price_charged || 0,
      revenue_share_percent: revenue_share_percent || null,
      status: 'sent'
    }))

    const { data: createdAssignments, error: assignError } = await supabase
      .from('lead_assignments')
      .insert(assignments)
      .select()

    if (assignError) {
      console.error('Assignment error:', assignError)
      return NextResponse.json({ error: assignError.message }, { status: 500 })
    }

    // Update all leads status
    for (const lead of leads) {
      await supabase
        .from('leads')
        .update({ 
          status: 'assigned',
          assignment_count: (lead.assignment_count || 0) + 1
        })
        .eq('id', lead.id)
    }

    // Send ONE bundled email to broker
    let emailSent = false
    if (broker.email) {
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
            <h1 style="margin:0;font-size:24px;">🎯 ${leads.length} neue Leads</h1>
          </div>
          <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
            <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
            <p style="color:#64748b;line-height:1.6;">
              Sie haben ${leads.length} neue Leads erhalten:
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

            ${pricing_model === 'commission' || pricing_model === 'revenue_share' ? `
            <div style="background:#f3e8ff;border-radius:8px;padding:16px;margin:24px 0;">
              <div style="color:#7c3aed;font-size:14px;">
                <strong>Beteiligungsmodell:</strong> Bitte melden Sie uns den Status dieser Leads.
                Bei erfolgreichem Abschluss wird eine Provision von ${revenue_share_percent}% fällig.
              </div>
            </div>
            ` : ''}

            ${pricing_model === 'fixed' || pricing_model === 'single' ? `
            <div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0;">
              <div style="color:#1e40af;font-size:14px;">
                <strong>Gesamtbetrag:</strong> CHF ${(price_charged * leads.length).toFixed(2)} (${leads.length} x CHF ${price_charged})
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
          from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
          to: broker.email,
          subject: `${leads.length} neue Leads zugewiesen - LeadsHub`,
          html: emailHtml
        })
        emailSent = true
        console.log('Bulk email sent to:', broker.email)
      } catch (e) {
        console.error('Email error:', e)
      }
    }

    return NextResponse.json({ 
      success: true, 
      assignments: createdAssignments,
      count: leads.length,
      email_sent: emailSent 
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
