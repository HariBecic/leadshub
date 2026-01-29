import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendFollowupEmail } from '@/lib/followup-email'

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
    if (day !== 0 && day !== 6) {
      hoursToAdd--
    }
  }
  
  return deadline
}

// POST - Send pending followups & check expired deadlines
export async function POST(request: NextRequest) {
  const now = new Date()
  const nowISO = now.toISOString()
  
  // 1. First, check for expired deadlines (no response within 48h)
  const { data: expired } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*)')
    .eq('pricing_model', 'revenue_share')
    .not('followup_sent_at', 'is', null)
    .is('followup_response', null)
    .lte('response_deadline', nowISO)

  let returnedCount = 0
  if (expired && expired.length > 0) {
    for (const assignment of expired) {
      // Return lead to pool
      await supabase
        .from('lead_assignments')
        .update({
          status: 'returned',
          followup_response: 'no_response',
          contact_result: 'Keine Antwort innerhalb 48h'
        })
        .eq('id', assignment.id)

      await supabase
        .from('leads')
        .update({ status: 'available' })
        .eq('id', assignment.lead_id)

      returnedCount++
    }
  }

  // 2. Send new followup emails
  const { data: assignments, error } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*), broker:brokers(*)')
    .eq('pricing_model', 'revenue_share')
    .lte('followup_date', nowISO)
    .is('followup_sent_at', null)
    .not('status', 'in', '("success","returned")')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const baseUrl = request.nextUrl.origin
  let sentCount = 0
  const errors: string[] = []

  if (assignments && assignments.length > 0) {
    for (const assignment of assignments) {
      if (!assignment.broker?.email || !assignment.lead) continue

      const { error: emailError } = await sendFollowupEmail(
        { name: assignment.broker.name, email: assignment.broker.email },
        { first_name: assignment.lead.first_name, last_name: assignment.lead.last_name },
        { id: assignment.id, broker_id: assignment.broker_id },
        baseUrl
      )

      if (emailError) {
        errors.push(`${assignment.id}: ${emailError.message}`)
      } else {
        // Mark as sent & set response deadline (48h excluding weekends)
        const deadline = calculateDeadline(now)
        
        await supabase
          .from('lead_assignments')
          .update({ 
            followup_sent_at: nowISO,
            response_deadline: deadline.toISOString()
          })
          .eq('id', assignment.id)
        
        sentCount++
      }
    }
  }

  return NextResponse.json({
    message: `${sentCount} Follow-ups gesendet, ${returnedCount} Leads zurück in Pool`,
    sent: sentCount,
    returned: returnedCount,
    errors: errors.length > 0 ? errors : undefined
  })
}

// GET - Check status
export async function GET() {
  const now = new Date().toISOString()
  
  // Pending to send
  const { data: pending } = await supabase
    .from('lead_assignments')
    .select('id, followup_date, followup_count, lead:leads(first_name, last_name), broker:brokers(name)')
    .eq('pricing_model', 'revenue_share')
    .lte('followup_date', now)
    .is('followup_sent_at', null)
    .not('status', 'in', '("success","returned")')

  // Waiting for response (deadline not yet expired)
  const { data: waiting } = await supabase
    .from('lead_assignments')
    .select('id, response_deadline, followup_count, lead:leads(first_name, last_name), broker:brokers(name)')
    .eq('pricing_model', 'revenue_share')
    .not('followup_sent_at', 'is', null)
    .is('followup_response', null)
    .gt('response_deadline', now)

  // Expired (no response, deadline passed)
  const { data: expired } = await supabase
    .from('lead_assignments')
    .select('id, response_deadline, lead:leads(first_name, last_name), broker:brokers(name)')
    .eq('pricing_model', 'revenue_share')
    .not('followup_sent_at', 'is', null)
    .is('followup_response', null)
    .lte('response_deadline', now)

  return NextResponse.json({
    pending_to_send: pending?.length || 0,
    waiting_for_response: waiting?.length || 0,
    expired_no_response: expired?.length || 0,
    details: {
      pending,
      waiting,
      expired
    }
  })
}
