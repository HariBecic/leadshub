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
        status: 'sent',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (assignError) {
      console.error('Assignment error:', assignError)
      return NextResponse.json({ error: assignError.message }, { status: 500 })
    }

    // Update lead status
    await supabase
      .from('leads')
      .update({ 
        status: 'assigned',
        assignment_count: (lead.assignment_count || 0) + 1
      })
      .eq('id', lead_id)

    // Send email to broker
    let emailSent = false
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

            ${pricing_model === 'commission' || pricing_model === 'revenue_share' ? `
            <div style="background:#f3e8ff;border-radius:8px;padding:16px;margin:24px 0;">
              <div style="color:#7c3aed;font-size:14px;">
                <strong>Beteiligungsmodell:</strong> Bitte melden Sie uns den Status dieses Leads.
                Bei erfolgreichem Abschluss wird eine Provision von ${revenue_share_percent}% fällig.
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
        console.log('Email sent to:', broker.email)
      } catch (e) {
        console.error('Email error:', e)
      }
    }

    return NextResponse.json({ 
      success: true, 
      assignment,
      email_sent: emailSent 
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
