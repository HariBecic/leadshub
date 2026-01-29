import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

async function sendLeadsEmail(broker: any, leads: any[], packageName: string) {
  if (!broker.email) return false

  const leadsHtml = leads.map(lead => `
    <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="font-weight:600;font-size:16px;color:#1e293b;margin-bottom:8px;">${lead.first_name} ${lead.last_name}</div>
      <table style="font-size:14px;width:100%;">
        ${lead.email ? `<tr><td style="color:#64748b;width:80px;">E-Mail:</td><td style="color:#1e293b;">${lead.email}</td></tr>` : ''}
        ${lead.phone ? `<tr><td style="color:#64748b;">Telefon:</td><td style="color:#1e293b;">${lead.phone}</td></tr>` : ''}
        ${lead.plz ? `<tr><td style="color:#64748b;">PLZ/Ort:</td><td style="color:#1e293b;">${lead.plz} ${lead.ort || ''}</td></tr>` : ''}
      </table>
    </div>
  `).join('')

  const emailHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
        <h1 style="margin:0;font-size:24px;">🎉 ${leads.length} neue Leads!</h1>
      </div>
      <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
        <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
        <p style="color:#64748b;line-height:1.6;">
          Hier sind Ihre neuen Leads aus dem Paket <strong>"${packageName}"</strong>:
        </p>
        
        <div style="margin:24px 0;">
          ${leadsHtml}
        </div>
        
        <p style="color:#64748b;line-height:1.6;">
          Bitte kontaktieren Sie die Leads so schnell wie möglich für beste Erfolgsaussichten.
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
      subject: `${leads.length} neue Leads - ${packageName}`,
      html: emailHtml
    })
    return true
  } catch (e) {
    console.error('Email error:', e)
    return false
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { package_id, count } = body

  if (!package_id) {
    return NextResponse.json({ error: 'Package ID required' }, { status: 400 })
  }

  // Get package with broker
  const { data: pkg } = await supabase
    .from('lead_packages')
    .select('*, broker:brokers(*)')
    .eq('id', package_id)
    .single()

  if (!pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  if (pkg.status !== 'active' && pkg.status !== 'paid') {
    return NextResponse.json({ error: 'Package not active' }, { status: 400 })
  }

  const remaining = pkg.total_leads - pkg.delivered_leads
  const toDeliver = count ? Math.min(count, remaining) : Math.min(pkg.leads_per_day, remaining)

  if (toDeliver <= 0) {
    return NextResponse.json({ error: 'No more leads to deliver' }, { status: 400 })
  }

  // Find available leads
  let query = supabase
    .from('leads')
    .select('*')
    .in('status', ['new', 'available'])
    .order('created_at', { ascending: true })
    .limit(toDeliver)

  if (pkg.category_id) {
    query = query.eq('category_id', pkg.category_id)
  }

  const { data: leads } = await query

  if (!leads || leads.length === 0) {
    return NextResponse.json({ error: 'Keine verfügbaren Leads gefunden' }, { status: 404 })
  }

  // Assign leads to broker
  const deliveredLeads = []
  for (const lead of leads) {
    const { error: assignError } = await supabase
      .from('lead_assignments')
      .insert([{
        lead_id: lead.id,
        broker_id: pkg.broker_id,
        price_charged: pkg.price / pkg.total_leads,
        pricing_model: 'fixed',
        status: 'sent',
        unlocked: true
      }])

    if (!assignError) {
      await supabase
        .from('leads')
        .update({ 
          status: 'assigned',
          assignment_count: (lead.assignment_count || 0) + 1
        })
        .eq('id', lead.id)
      
      deliveredLeads.push(lead)
    }
  }

  // Update package
  const newDelivered = pkg.delivered_leads + deliveredLeads.length
  const isCompleted = newDelivered >= pkg.total_leads

  const updateData: any = {
    delivered_leads: newDelivered,
    status: isCompleted ? 'completed' : 'active'
  }

  if (!isCompleted && pkg.distribution_type === 'distributed') {
    let nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 1)
    while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 1)
    }
    updateData.next_delivery_date = nextDate.toISOString().split('T')[0]
  }

  await supabase
    .from('lead_packages')
    .update(updateData)
    .eq('id', package_id)

  // Send email with leads
  let emailSent = false
  if (deliveredLeads.length > 0 && pkg.broker) {
    emailSent = await sendLeadsEmail(pkg.broker, deliveredLeads, pkg.name)
  }

  return NextResponse.json({ 
    success: true, 
    delivered: deliveredLeads.length,
    total_delivered: newDelivered,
    remaining: pkg.total_leads - newDelivered,
    completed: isCompleted,
    email_sent: emailSent
  })
}

// GET - Cron job for distributed packages
export async function GET(request: NextRequest) {
  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().getDay()

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ message: 'Weekend - no deliveries' })
  }

  const { data: packages } = await supabase
    .from('lead_packages')
    .select('*, broker:brokers(*)')
    .eq('status', 'active')
    .eq('distribution_type', 'distributed')
    .lte('next_delivery_date', today)

  if (!packages || packages.length === 0) {
    return NextResponse.json({ message: 'No packages to deliver today', count: 0 })
  }

  let totalDelivered = 0
  const results = []

  for (const pkg of packages) {
    const remaining = pkg.total_leads - pkg.delivered_leads
    const toDeliver = Math.min(pkg.leads_per_day, remaining)

    if (toDeliver <= 0) continue

    let query = supabase
      .from('leads')
      .select('*')
      .in('status', ['new', 'available'])
      .order('created_at', { ascending: true })
      .limit(toDeliver)

    if (pkg.category_id) {
      query = query.eq('category_id', pkg.category_id)
    }

    const { data: leads } = await query

    if (!leads || leads.length === 0) {
      results.push({ package_id: pkg.id, error: 'No leads available' })
      continue
    }

    const deliveredLeads = []
    for (const lead of leads) {
      const { error: assignError } = await supabase
        .from('lead_assignments')
        .insert([{
          lead_id: lead.id,
          broker_id: pkg.broker_id,
          price_charged: pkg.price / pkg.total_leads,
          pricing_model: 'fixed',
          status: 'sent',
          unlocked: true
        }])

      if (!assignError) {
        await supabase
          .from('leads')
          .update({ 
            status: 'assigned',
            assignment_count: (lead.assignment_count || 0) + 1
          })
          .eq('id', lead.id)
        
        deliveredLeads.push(lead)
      }
    }

    const newDelivered = pkg.delivered_leads + deliveredLeads.length
    const isCompleted = newDelivered >= pkg.total_leads

    const updateData: any = {
      delivered_leads: newDelivered,
      status: isCompleted ? 'completed' : 'active'
    }

    if (!isCompleted) {
      let nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + 1)
      while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
        nextDate.setDate(nextDate.getDate() + 1)
      }
      updateData.next_delivery_date = nextDate.toISOString().split('T')[0]
    }

    await supabase
      .from('lead_packages')
      .update(updateData)
      .eq('id', pkg.id)

    // Send email with leads
    let emailSent = false
    if (deliveredLeads.length > 0 && pkg.broker) {
      emailSent = await sendLeadsEmail(pkg.broker, deliveredLeads, pkg.name)
    }

    totalDelivered += deliveredLeads.length
    results.push({ 
      package_id: pkg.id, 
      delivered: deliveredLeads.length, 
      completed: isCompleted,
      email_sent: emailSent
    })
  }

  return NextResponse.json({ 
    message: `${totalDelivered} leads delivered`,
    total_delivered: totalDelivered,
    packages: results
  })
}
