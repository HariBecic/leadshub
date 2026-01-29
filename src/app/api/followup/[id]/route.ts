import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Calculate deadline excluding weekends (48h business hours)
function calculateDeadline(fromDate: Date): Date {
  const deadline = new Date(fromDate)
  let hoursToAdd = 48
  
  while (hoursToAdd > 0) {
    deadline.setHours(deadline.getHours() + 1)
    const day = deadline.getDay()
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (day !== 0 && day !== 6) {
      hoursToAdd--
    }
  }
  
  return deadline
}

// Calculate next followup date (3 days, skip weekends)
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

  // Allow re-submission for reached/scheduled status (for follow-up updates)
  const finalStatuses = ['returned', 'success', 'not_reached', 'closed']
  if (assignment.followup_response && finalStatuses.includes(assignment.followup_response)) {
    return NextResponse.json({ error: 'Feedback wurde bereits abgegeben' }, { status: 400 })
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
  const body = await request.json()
  const { token, status, notes, commission_amount } = body

  if (!token || !status) {
    return NextResponse.json({ error: 'Token und Status erforderlich' }, { status: 400 })
  }

  const { data: assignment, error } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*)')
    .eq('id', id)
    .single()

  if (error || !assignment) {
    return NextResponse.json({ error: 'Zuweisung nicht gefunden' }, { status: 404 })
  }

  const expectedToken = Buffer.from(assignment.id + assignment.broker_id).toString('base64').slice(0, 20)
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 403 })
  }

  let assignmentStatus = 'sent'
  let leadStatus = 'assigned'
  let contacted = false
  let nextFollowupDate: Date | null = null

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
      // Schedule next followup in 3 business days
      nextFollowupDate = calculateNextFollowup(new Date())
      break
    case 'scheduled':
      assignmentStatus = 'scheduled'
      leadStatus = 'assigned'
      contacted = true
      // Schedule next followup in 3 business days
      nextFollowupDate = calculateNextFollowup(new Date())
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

  const updateData: any = {
    status: assignmentStatus,
    followup_response: status,
    followup_responded_at: new Date().toISOString(),
    contacted: contacted,
    contact_result: notes || null,
    commission_amount: commissionValue,
    followup_count: (assignment.followup_count || 0) + 1
  }

  // Set next followup date for reached/scheduled
  if (nextFollowupDate) {
    updateData.followup_date = nextFollowupDate.toISOString()
    updateData.followup_sent_at = null // Reset so it gets sent again
    updateData.response_deadline = null // Will be set when email is sent
  }

  await supabase
    .from('lead_assignments')
    .update(updateData)
    .eq('id', id)

  await supabase
    .from('leads')
    .update({ status: leadStatus })
    .eq('id', assignment.lead_id)

  return NextResponse.json({ 
    success: true, 
    status: assignmentStatus,
    next_followup: nextFollowupDate?.toISOString() || null
  })
}
