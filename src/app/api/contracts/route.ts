import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { broker_id, category_id, pricing_model, price_per_lead, monthly_fee, revenue_share_percent, followup_days } = body

  if (!broker_id || !pricing_model) {
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

  // Get category if specified
  let categoryName = 'Alle Kategorien'
  if (category_id) {
    const { data: category } = await supabase
      .from('lead_categories')
      .select('name')
      .eq('id', category_id)
      .single()
    if (category) categoryName = category.name
  }

  // Generate confirmation token
  const confirmationToken = crypto.randomBytes(32).toString('hex')

  // Create contract (pending status)
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert([{
      broker_id,
      category_id: category_id || null,
      pricing_model,
      price_per_lead: pricing_model === 'fixed' ? price_per_lead : null,
      monthly_fee: pricing_model === 'subscription' ? monthly_fee : null,
      revenue_share_percent: pricing_model === 'revenue_share' ? revenue_share_percent : null,
      followup_days: followup_days || 3,
      status: 'pending',
      confirmation_token: confirmationToken,
      sent_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (contractError) {
    return NextResponse.json({ error: contractError.message }, { status: 500 })
  }

  // Send confirmation email
  let emailSent = false
  if (broker.email) {
    const baseUrl = request.nextUrl.origin
    const confirmUrl = `${baseUrl}/vertrag/${contract.id}?token=${confirmationToken}`

    let pricingText = ''
    let pricingDetail = ''
    if (pricing_model === 'subscription') {
      pricingText = 'Abo-Vertrag'
      pricingDetail = `CHF ${monthly_fee}/Monat`
    } else if (pricing_model === 'revenue_share') {
      pricingText = 'Beteiligungsvertrag'
      pricingDetail = `${revenue_share_percent}% bei Abschluss`
    } else {
      pricingText = 'Fixpreis-Vertrag'
      pricingDetail = `CHF ${price_per_lead} pro Lead`
    }

    const emailHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#3A29A6 0%,#4D3BBF 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
          <h1 style="margin:0;font-size:24px;">📋 Ihr Vertrag</h1>
        </div>
        <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
          <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
          <p style="color:#64748b;line-height:1.6;">
            Wir freuen uns, Ihnen folgenden Vertrag anzubieten:
          </p>
          
          <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;">
            <div style="font-size:20px;font-weight:700;color:#3A29A6;margin-bottom:16px;">${pricingText}</div>
            <table style="width:100%;font-size:14px;">
              <tr><td style="color:#64748b;padding:8px 0;">Kategorie:</td><td style="color:#1e293b;font-weight:500;">${categoryName}</td></tr>
              <tr><td style="color:#64748b;padding:8px 0;">Konditionen:</td><td style="color:#1e293b;font-weight:600;font-size:18px;">${pricingDetail}</td></tr>
              ${pricing_model === 'revenue_share' ? `<tr><td style="color:#64748b;padding:8px 0;">Follow-up nach:</td><td style="color:#1e293b;">${followup_days || 3} Tagen</td></tr>` : ''}
            </table>
          </div>

          ${pricing_model === 'subscription' ? `
          <div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0;">
            <div style="color:#1e40af;font-size:14px;">
              <strong>Abo-Bedingungen:</strong> Monatliche Abrechnung, jederzeit kündbar mit 30 Tagen Frist.
            </div>
          </div>
          ` : ''}

          ${pricing_model === 'revenue_share' ? `
          <div style="background:#f3e8ff;border-radius:8px;padding:16px;margin:24px 0;">
            <div style="color:#7c3aed;font-size:14px;">
              <strong>Beteiligungs-Bedingungen:</strong> Sie erhalten Leads kostenlos und zahlen nur bei erfolgreichem Abschluss. 
              Wir fragen nach ${followup_days || 3} Tagen nach dem Status.
            </div>
          </div>
          ` : ''}
          
          <div style="text-align:center;margin:32px 0;">
            <a href="${confirmUrl}" style="display:inline-block;background:#3A29A6;color:white;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">
              Vertrag ansehen & bestätigen
            </a>
          </div>
          
          <p style="color:#94a3b8;font-size:13px;text-align:center;">
            Oder kopieren Sie diesen Link: ${confirmUrl}
          </p>
          
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
          
          <p style="color:#64748b;font-size:14px;margin:0;">
            Freundliche Grüsse<br>
            <strong style="color:#1e293b;">LeadsHub</strong><br>
            <span style="font-size:12px;">Sandäckerstrasse 10, 8957 Spreitenbach</span>
          </p>
        </div>
      </div>
    `

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
        to: broker.email,
        subject: `Vertragsangebot: ${pricingText} - LeadsHub`,
        html: emailHtml
      })
      emailSent = true
    } catch (e) {
      console.error('Email error:', e)
    }
  }

  return NextResponse.json({ success: true, contract, email_sent: emailSent })
}
