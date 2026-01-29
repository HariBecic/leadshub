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
  const { lead_id, broker_id, price } = body

  // Get lead data
  const { data: lead } = await supabase
    .from('leads')
    .select('*, category:lead_categories(*)')
    .eq('id', lead_id)
    .single()

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // Get broker data
  const { data: broker } = await supabase
    .from('brokers')
    .select('*')
    .eq('id', broker_id)
    .single()

  if (!broker) {
    return NextResponse.json({ error: 'Broker not found' }, { status: 404 })
  }

  // Check for active contract
  let contract = null
  const categoryId = lead.category_id

  // First try category-specific contract
  const { data: categoryContract } = await supabase
    .from('contracts')
    .select('*')
    .eq('broker_id', broker_id)
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .single()

  if (categoryContract) {
    contract = categoryContract
  } else {
    // Try general contract
    const { data: generalContract } = await supabase
      .from('contracts')
      .select('*')
      .eq('broker_id', broker_id)
      .is('category_id', null)
      .eq('status', 'active')
      .single()
    
    contract = generalContract
  }

  // Determine pricing
  let priceCharged = 0
  let pricingModel = 'fixed'
  let revenueSharePercent = null
  let followupDays = 3
  let unlocked = true // Default: unlocked (for contracts)

  if (contract) {
    pricingModel = contract.pricing_model
    followupDays = contract.followup_days || 3

    if (contract.pricing_model === 'fixed') {
      priceCharged = contract.price_per_lead || 0
      unlocked = true // Contract = trusted, unlocked
    } else if (contract.pricing_model === 'subscription') {
      priceCharged = 0
      unlocked = true
    } else if (contract.pricing_model === 'revenue_share') {
      priceCharged = 0
      revenueSharePercent = contract.revenue_share_percent
      unlocked = true
    }
  } else {
    // No contract = single purchase, must pay first
    priceCharged = price || 35
    pricingModel = 'fixed'
    unlocked = false // Locked until paid!
  }

  // Calculate followup date
  const followupDate = new Date()
  followupDate.setDate(followupDate.getDate() + followupDays)

  // Create assignment
  const { data: assignment, error: assignError } = await supabase
    .from('lead_assignments')
    .insert([{
      lead_id,
      broker_id,
      contract_id: contract?.id || null,
      price_charged: priceCharged,
      pricing_model: pricingModel,
      revenue_share_percent: revenueSharePercent,
      followup_date: pricingModel === 'revenue_share' ? followupDate.toISOString() : null,
      status: 'sent',
      unlocked: unlocked
    }])
    .select()
    .single()

  if (assignError) {
    return NextResponse.json({ error: assignError.message }, { status: 500 })
  }

  // Update lead status and assignment count
  await supabase
    .from('leads')
    .update({ 
      status: 'assigned',
      assignment_count: (lead.assignment_count || 0) + 1
    })
    .eq('id', lead_id)

  // If single purchase (no contract), create invoice immediately
  let invoice = null
  if (!contract && priceCharged > 0) {
    const invoiceNumber = await getNextInvoiceNumber()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const { data: newInvoice } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        broker_id: broker_id,
        type: 'single',
        status: 'pending',
        amount: priceCharged,
        due_date: dueDate.toISOString().split('T')[0]
      }])
      .select()
      .single()

    if (newInvoice) {
      invoice = newInvoice

      await supabase
        .from('invoice_items')
        .insert([{
          invoice_id: newInvoice.id,
          description: `Lead: ${lead.first_name} ${lead.last_name}`,
          quantity: 1,
          unit_price: priceCharged,
          total: priceCharged,
          lead_assignment_id: assignment.id
        }])
    }
  }

  // Send email
  let emailSent = false
  if (broker.email) {
    const baseUrl = request.nextUrl.origin
    
    let emailHtml = ''
    let subject = ''

    if (!unlocked && invoice) {
      // Locked - send payment request
      subject = `Neuer Lead - Zahlung erforderlich`
      emailHtml = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#F26444 0%,#D94E30 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
            <h1 style="margin:0;font-size:24px;">Neuer Lead für Sie!</h1>
          </div>
          <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
            <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
            <p style="color:#64748b;line-height:1.6;">
              Sie haben einen neuen Lead erhalten. Die Kontaktdaten werden nach Zahlungseingang freigeschaltet.
            </p>
            
            <div style="background:#fef3c7;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
              <div style="font-size:14px;color:#92400e;margin-bottom:4px;">Zu zahlen</div>
              <div style="font-size:32px;font-weight:700;color:#92400e;">CHF ${priceCharged.toFixed(2)}</div>
            </div>

            <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;">
              <div style="font-weight:600;margin-bottom:8px;">Zahlungsinformationen</div>
              <div style="color:#64748b;font-size:14px;">
                <div>IBAN: CH00 0000 0000 0000 0000 0</div>
                <div>Referenz: ${invoice.invoice_number}</div>
              </div>
            </div>
            
            <p style="color:#64748b;font-size:14px;">
              Sobald die Zahlung eingegangen ist, erhalten Sie eine E-Mail mit den vollständigen Kontaktdaten.
            </p>
            
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
            
            <p style="color:#64748b;font-size:14px;margin:0;">
              Freundliche Grüsse<br>
              <strong style="color:#1e293b;">LeadsHub</strong>
            </p>
          </div>
        </div>
      `
    } else {
      // Unlocked - send full lead data
      subject = `Neuer Lead: ${lead.first_name} ${lead.last_name}`
      emailHtml = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#F26444 0%,#D94E30 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
            <h1 style="margin:0;font-size:24px;">Neuer Lead für Sie!</h1>
          </div>
          <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
            <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
            <p style="color:#64748b;line-height:1.6;">
              Sie haben einen neuen Lead erhalten. Hier sind die Details:
            </p>
            
            <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;">
              <div style="font-size:18px;font-weight:600;color:#1e293b;margin-bottom:12px;">
                ${lead.first_name} ${lead.last_name}
              </div>
              <table style="width:100%;font-size:14px;">
                ${lead.email ? `<tr><td style="color:#64748b;padding:4px 0;">E-Mail:</td><td style="color:#1e293b;">${lead.email}</td></tr>` : ''}
                ${lead.phone ? `<tr><td style="color:#64748b;padding:4px 0;">Telefon:</td><td style="color:#1e293b;">${lead.phone}</td></tr>` : ''}
                ${lead.plz ? `<tr><td style="color:#64748b;padding:4px 0;">PLZ/Ort:</td><td style="color:#1e293b;">${lead.plz} ${lead.ort || ''}</td></tr>` : ''}
              </table>
            </div>
            
            <p style="color:#64748b;line-height:1.6;">
              Bitte kontaktieren Sie den Lead so schnell wie möglich.
            </p>
            
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
            
            <p style="color:#64748b;font-size:14px;margin:0;">
              Freundliche Grüsse<br>
              <strong style="color:#1e293b;">LeadsHub</strong>
            </p>
          </div>
        </div>
      `
    }

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
        to: broker.email,
        subject,
        html: emailHtml
      })
      emailSent = true
    } catch (e) {
      console.error('Email error:', e)
    }
  }

  return NextResponse.json({ 
    success: true, 
    assignment,
    invoice,
    unlocked,
    email_sent: emailSent
  })
}
