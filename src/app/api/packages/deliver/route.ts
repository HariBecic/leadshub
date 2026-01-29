import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { package_id, count } = body

  if (!package_id) {
    return NextResponse.json({ error: 'Package ID required' }, { status: 400 })
  }

  // Get package
  const { data: pkg } = await supabase
    .from('lead_packages')
    .select('*')
    .eq('id', package_id)
    .single()

  if (!pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  if (pkg.status !== 'active' && pkg.status !== 'paid') {
    return NextResponse.json({ error: 'Package not active' }, { status: 400 })
  }

  // Calculate how many leads to deliver
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
  let deliveredCount = 0
  for (const lead of leads) {
    const { error: assignError } = await supabase
      .from('lead_assignments')
      .insert([{
        lead_id: lead.id,
        broker_id: pkg.broker_id,
        price_charged: pkg.price / pkg.total_leads, // Price per lead
        pricing_model: 'fixed',
        status: 'sent',
        unlocked: true // Already paid
      }])

    if (!assignError) {
      // Update lead status
      await supabase
        .from('leads')
        .update({ 
          status: 'assigned',
          assignment_count: (lead.assignment_count || 0) + 1
        })
        .eq('id', lead.id)
      
      deliveredCount++
    }
  }

  // Update package
  const newDelivered = pkg.delivered_leads + deliveredCount
  const isCompleted = newDelivered >= pkg.total_leads

  const updateData: any = {
    delivered_leads: newDelivered,
    status: isCompleted ? 'completed' : 'active'
  }

  // Calculate next delivery date if distributed and not completed
  if (!isCompleted && pkg.distribution_type === 'distributed') {
    let nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 1)
    // Skip weekends
    while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 1)
    }
    updateData.next_delivery_date = nextDate.toISOString().split('T')[0]
  }

  await supabase
    .from('lead_packages')
    .update(updateData)
    .eq('id', package_id)

  return NextResponse.json({ 
    success: true, 
    delivered: deliveredCount,
    total_delivered: newDelivered,
    remaining: pkg.total_leads - newDelivered,
    completed: isCompleted
  })
}

// GET - Check and deliver for cron job (distributed packages)
export async function GET(request: NextRequest) {
  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().getDay()

  // Skip weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return NextResponse.json({ message: 'Weekend - no deliveries' })
  }

  // Find packages that need delivery today
  const { data: packages } = await supabase
    .from('lead_packages')
    .select('*')
    .eq('status', 'active')
    .eq('distribution_type', 'distributed')
    .lte('next_delivery_date', today)

  if (!packages || packages.length === 0) {
    return NextResponse.json({ message: 'No packages to deliver today', count: 0 })
  }

  let totalDelivered = 0
  const results = []

  for (const pkg of packages) {
    // Deliver leads for this package
    const remaining = pkg.total_leads - pkg.delivered_leads
    const toDeliver = Math.min(pkg.leads_per_day, remaining)

    if (toDeliver <= 0) continue

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
      results.push({ package_id: pkg.id, error: 'No leads available' })
      continue
    }

    let deliveredCount = 0
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
        
        deliveredCount++
      }
    }

    // Update package
    const newDelivered = pkg.delivered_leads + deliveredCount
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

    totalDelivered += deliveredCount
    results.push({ package_id: pkg.id, delivered: deliveredCount, completed: isCompleted })
  }

  return NextResponse.json({ 
    message: `${totalDelivered} leads delivered`,
    total_delivered: totalDelivered,
    packages: results
  })
}
