import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendFollowupEmail } from '@/lib/followup-email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// This endpoint can be called by a cron job or manually
export async function POST(request: NextRequest) {
  // Get all assignments where:
  // - pricing_model is 'revenue_share'
  // - followup_date has passed
  // - followup_sent_at is null (not yet sent)
  // - followup_response is null (not yet responded)
  
  const now = new Date().toISOString()
  
  const { data: assignments, error } = await supabase
    .from('lead_assignments')
    .select('*, lead:leads(*), broker:brokers(*)')
    .eq('pricing_model', 'revenue_share')
    .lte('followup_date', now)
    .is('followup_sent_at', null)
    .is('followup_response', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ message: 'Keine Follow-ups zu senden', count: 0 })
  }

  const baseUrl = request.nextUrl.origin
  let sentCount = 0
  const errors: string[] = []

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
      // Mark as sent
      await supabase
        .from('lead_assignments')
        .update({ followup_sent_at: new Date().toISOString() })
        .eq('id', assignment.id)
      
      sentCount++
    }
  }

  return NextResponse.json({
    message: `${sentCount} Follow-up E-Mails gesendet`,
    count: sentCount,
    total: assignments.length,
    errors: errors.length > 0 ? errors : undefined
  })
}

// GET - Check pending followups
export async function GET() {
  const now = new Date().toISOString()
  
  const { data: pending, error } = await supabase
    .from('lead_assignments')
    .select('id, followup_date, lead:leads(first_name, last_name), broker:brokers(name)')
    .eq('pricing_model', 'revenue_share')
    .lte('followup_date', now)
    .is('followup_sent_at', null)
    .is('followup_response', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    pending_count: pending?.length || 0,
    pending: pending
  })
}
