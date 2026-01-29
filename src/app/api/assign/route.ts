import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLeadEmail } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { lead_id, broker_id } = body

  // Get lead data with category
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

  // Get contract for this broker and category
  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('broker_id', broker_id)
    .eq('category_id', lead.category_id)
    .eq('status', 'active')
    .single()

  // If no category-specific contract, try to find a general contract for this broker
  let activeContract = contract
  if (!activeContract) {
    const { data: generalContract } = await supabase
      .from('contracts')
      .select('*')
      .eq('broker_id', broker_id)
      .is('category_id', null)
      .eq('status', 'active')
      .single()
    activeContract = generalContract
  }

  // Determine price based on contract
  let priceCharged = 0
  let revenueSharePercent = null
  let pricingModel = 'fixed'

  if (activeContract) {
    pricingModel = activeContract.pricing_model
    
    if (activeContract.pricing_model === 'fixed') {
      priceCharged = activeContract.price_per_lead || 0
    } else if (activeContract.pricing_model === 'subscription') {
      // Subscription = no per-lead cost, monthly fee
      priceCharged = 0
    } else if (activeContract.pricing_model === 'revenue_share') {
      // Revenue share = no upfront cost, but track percentage
      priceCharged = 0
      revenueSharePercent = activeContract.revenue_share_percent
    }
  }

  // Create assignment
  const { error: assignError } = await supabase
    .from('lead_assignments')
    .insert([{
      lead_id,
      broker_id,
      contract_id: activeContract?.id || null,
      status: 'sent',
      price_charged: priceCharged,
      revenue_share_percent: revenueSharePercent,
      pricing_model: pricingModel,
      followup_date: activeContract?.followup_days 
        ? new Date(Date.now() + activeContract.followup_days * 24 * 60 * 60 * 1000).toISOString()
        : null
    }])

  if (assignError) {
    return NextResponse.json({ error: 'Assignment failed: ' + assignError.message }, { status: 500 })
  }

  // Update lead status
  await supabase
    .from('leads')
    .update({
      status: 'assigned',
      ownership: 'sold',
      assignment_count: (lead.assignment_count || 0) + 1
    })
    .eq('id', lead_id)

  // Send email
  const { error: emailError } = await sendLeadEmail(
    { name: broker.name, email: broker.email },
    {
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      plz: lead.plz || '',
      ort: lead.ort || '',
      extra_data: lead.extra_data
    },
    lead.category?.name
  )

  return NextResponse.json({
    success: true,
    email_sent: !emailError,
    email_error: emailError?.message,
    pricing_model: pricingModel,
    price_charged: priceCharged,
    revenue_share_percent: revenueSharePercent,
    contract_found: !!activeContract
  })
}
