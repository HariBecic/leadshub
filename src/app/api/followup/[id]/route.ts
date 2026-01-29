import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

function calculateNextFollowup(fromDate: Date): Date {
  const next = new Date(fromDate)
  let daysToAdd = 3
  
  while (daysToAdd > 0) {
    next.setDate(next.getDate() + 1)
    const day = next.getDay()
    if (day !== 0 && day !== 6) {
      daysToAdd--
    }
  }
  
  return next
}

// GET - Load assignment for feedback page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')
  
  if (!token) {
    return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
  }

  const { data: assignment, error } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*), broker:brokers(*)')
    .eq('id', id)
    .single()

  if (error || !assignment) {
    return NextResponse.json({ error: 'Zuweisung nicht gefunden' }, { status: 404 })
  }

  const expectedToken = Buffer.from(assignment.id + assignment.broker_id).toString('base64').slice(0, 20)
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 403 })
  }

  const finalStatuses = ['not_reached', 'closed']
  if (finalStatuses.includes(assignment.followup_response)) {
    return NextResponse.json({ error: 'Feedback wurde bereits abgeschlossen' }, { status: 400 })
  }

  if (assignment.followup_response && !assignment.followup_sent_at) {
    const respondedAt = new Date(assignment.followup_responded_at)
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    if (respondedAt > hourAgo) {
      return NextResponse.json({ error: 'Feedback bereits abgegeben. Wir melden uns in 3 Tagen.' }, { status: 400 })
    }
  }

  return NextResponse.json({
    id: assignment.id,
    lead: {
      first_name: assignment.lead?.first_name,
      last_name: assignment.lead?.last_name,
      email: assignment.lead?.email,
      phone: assignment.lead?.phone,
    },
    revenue_share_percent: assignment.revenue_share_percent,
    assigned_at: assignment.assigned_at,
    current_status: assignment.followup_response,
    followup_count: assignment.followup_count || 0
  })
}

// POST - Submit feedback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  let body
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  
  const { token, status, notes, commission_amount } = body

  if (!token || !status) {
    return NextResponse.json({ error: 'Token und Status erforderlich' }, { status: 400 })
  }

  const { data: assignment, error: fetchError } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*)')
    .eq('id', id)
    .single()

  if (fetchError || !assignment) {
    return NextResponse.json({ error: 'Zuweisung nicht gefunden', details: fetchError?.message }, { status: 404 })
  }

  const expectedToken = Buffer.from(assignment.id + assignment.broker_id).toString('base64').slice(0, 20)
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 403 })
  }

  const finalStatuses = ['not_reached', 'closed']
  if (finalStatuses.includes(assignment.followup_response)) {
    return NextResponse.json({ error: 'Feedback wurde bereits abgeschlossen' }, { status: 400 })
  }

  let assignmentStatus = 'sent'
  let leadStatus = 'assigned'
  let contacted = false
  let nextFollowupDate: string | null = null

  switch (status) {
    case 'not_reached':
      assignmentStatus = 'returned'
      leadStatus = 'available'
      contacted = false
      break
    case 'reached':
      assignmentStatus = 'in_progress'
      leadStatus = 'assigned'
      contacted = true
      nextFollowupDate = calculateNextFollowup(new Date()).toISOString()
      break
    case 'scheduled':
      assignmentStatus = 'scheduled'
      leadStatus = 'assigned'
      contacted = true
      nextFollowupDate = calculateNextFollowup(new Date()).toISOString()
      break
    case 'closed':
      assignmentStatus = 'success'
      leadStatus = 'closed'
      contacted = true
      break
  }

  let commissionValue = null
  if (status === 'closed' && commission_amount && assignment.revenue_share_percent) {
    commissionValue = commission_amount * (assignment.revenue_share_percent / 100)
  }

  // Build update object
  const updateData: Record<string, any> = {
    status: assignmentStatus,
    followup_response: status,
    followup_responded_at: new Date().toISOString(),
    contacted: contacted,
    contact_result: notes || null,
    commission_amount: commissionValue,
    followup_count: (assignment.followup_count || 0) + 1
  }

  if (nextFollowupDate) {
    updateData.followup_date = nextFollowupDate
    updateData.followup_sent_at = null
    updateData.response_deadline = null
  }

  // Update assignment
  const { error: updateError } = await supabase
    .from('lead_assignments')
    .update(updateData)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ 
      error: 'Update fehlgeschlagen', 
      details: updateError.message,
      code: updateError.code 
    }, { status: 500 })
  }

  // Update lead status
  const { error: leadError } = await supabase
    .from('leads')
    .update({ status: leadStatus })
    .eq('id', assignment.lead_id)

  if (leadError) {
    return NextResponse.json({ 
      error: 'Lead Update fehlgeschlagen', 
      details: leadError.message 
    }, { status: 500 })
  }

  return NextResponse.json({ 
    success: true, 
    status: assignmentStatus,
    next_followup: nextFollowupDate || null,
    updated_id: id
  })
}
