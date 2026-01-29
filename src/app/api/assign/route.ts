import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendLeadEmail } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

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

  // Create assignment
  const { error: assignError } = await supabase
    .from('lead_assignments')
    .insert([{
      lead_id,
      broker_id,
      status: 'sent',
      price_charged: price || 35
    }])

  if (assignError) {
    return NextResponse.json({ error: 'Assignment failed' }, { status: 500 })
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
    email_error: emailError?.message
  })
}
