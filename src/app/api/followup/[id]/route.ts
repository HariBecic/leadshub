import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// GET - Load assignment for feedback page
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = request.nextUrl.searchParams.get('token')
  
  if (!token) {
    return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
  }

  // Get assignment with lead data
  const { data: assignment, error } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*), broker:brokers(*)')
    .eq('id', params.id)
    .single()

  if (error || !assignment) {
    return NextResponse.json({ error: 'Zuweisung nicht gefunden' }, { status: 404 })
  }

  // Verify token (simple check - in production use proper token)
  const expectedToken = Buffer.from(assignment.id + assignment.broker_id).toString('base64').slice(0, 20)
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 403 })
  }

  // Check if already responded
  if (assignment.followup_response) {
    return NextResponse.json({ error: 'Feedback wurde bereits abgegeben' }, { status: 400 })
  }

  // Only return necessary data
  return NextResponse.json({
    id: assignment.id,
    lead: {
      first_name: assignment.lead?.first_name,
      last_name: assignment.lead?.last_name,
      email: assignment.lead?.email,
      phone: assignment.lead?.phone,
    },
    revenue_share_percent: assignment.revenue_share_percent,
    assigned_at: assignment.assigned_at
  })
}

// POST - Submit feedback
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { token, status, notes, commission_amount } = body

  if (!token || !status) {
    return NextResponse.json({ error: 'Token und Status erforderlich' }, { status: 400 })
  }

  // Get assignment
  const { data: assignment, error } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*)')
    .eq('id', params.id)
    .single()

  if (error || !assignment) {
    return NextResponse.json({ error: 'Zuweisung nicht gefunden' }, { status: 404 })
  }

  // Verify token
  const expectedToken = Buffer.from(assignment.id + assignment.broker_id).toString('base64').slice(0, 20)
  if (token !== expectedToken) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 403 })
  }

  // Check if already responded
  if (assignment.followup_response) {
    return NextResponse.json({ error: 'Feedback wurde bereits abgegeben' }, { status: 400 })
  }

  // Map status to assignment status and lead status
  let assignmentStatus = 'sent'
  let leadStatus = 'assigned'
  let contacted = false

  switch (status) {
    case 'not_reached':
      assignmentStatus = 'returned'
      leadStatus = 'available' // Back to pool
      contacted = false
      break
    case 'reached':
      assignmentStatus = 'in_progress'
      leadStatus = 'assigned'
      contacted = true
      break
    case 'scheduled':
      assignmentStatus = 'scheduled'
      leadStatus = 'assigned'
      contacted = true
      break
    case 'closed':
      assignmentStatus = 'success'
      leadStatus = 'closed'
      contacted = true
      break
  }

  // Calculate commission if closed
  let commissionValue = null
  if (status === 'closed' && commission_amount && assignment.revenue_share_percent) {
    commissionValue = commission_amount * (assignment.revenue_share_percent / 100)
  }

  // Update assignment
  await supabase
    .from('lead_assignments')
    .update({
      status: assignmentStatus,
      followup_response: status,
      followup_responded_at: new Date().toISOString(),
      contacted: contacted,
      contact_result: notes || null,
      commission_amount: commissionValue
    })
    .eq('id', params.id)

  // Update lead status
  await supabase
    .from('leads')
    .update({ status: leadStatus })
    .eq('id', assignment.lead_id)

  return NextResponse.json({ success: true, status: assignmentStatus })
}
