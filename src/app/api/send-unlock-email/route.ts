import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  const { assignment_id } = await request.json()

  if (!assignment_id) {
    return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 })
  }

  // Get assignment with lead and broker
  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*), broker:brokers(*)')
    .eq('id', assignment_id)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const { lead, broker } = assignment

  if (!broker?.email) {
    return NextResponse.json({ error: 'Broker has no email' }, { status: 400 })
  }

  const emailHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
        <h1 style="margin:0;font-size:24px;">🎉 Lead freigeschaltet!</h1>
      </div>
      <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
        <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
        <p style="color:#64748b;line-height:1.6;">
          Vielen Dank für Ihre Zahlung! Hier sind die vollständigen Kontaktdaten Ihres Leads:
        </p>
        
        <div style="background:#dcfce7;border-radius:12px;padding:20px;margin:24px 0;">
          <div style="font-size:20px;font-weight:600;color:#166534;margin-bottom:12px;">
            ${lead.first_name} ${lead.last_name}
          </div>
          <table style="width:100%;font-size:14px;">
            ${lead.email ? `<tr><td style="color:#166534;padding:4px 0;width:80px;">E-Mail:</td><td style="color:#166534;font-weight:500;">${lead.email}</td></tr>` : ''}
            ${lead.phone ? `<tr><td style="color:#166534;padding:4px 0;">Telefon:</td><td style="color:#166534;font-weight:500;">${lead.phone}</td></tr>` : ''}
            ${lead.plz ? `<tr><td style="color:#166534;padding:4px 0;">PLZ/Ort:</td><td style="color:#166534;font-weight:500;">${lead.plz} ${lead.ort || ''}</td></tr>` : ''}
          </table>
        </div>
        
        <p style="color:#64748b;line-height:1.6;">
          Bitte kontaktieren Sie den Lead so schnell wie möglich für beste Erfolgsaussichten.
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
      subject: `Lead freigeschaltet: ${lead.first_name} ${lead.last_name}`,
      html: emailHtml
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
