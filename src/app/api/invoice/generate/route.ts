import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Generate next invoice number
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

// POST - Create invoice for single lead purchase
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { broker_id, assignment_id, type = 'single' } = body

  if (type === 'single' && assignment_id) {
    // Single lead invoice
    const { data: assignment } = await supabase
      .from('lead_assignments')
      .select('*, lead:leads(*), broker:brokers(*)')
      .eq('id', assignment_id)
      .single()

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const invoiceNumber = await getNextInvoiceNumber()
    const amount = assignment.price_charged || 0
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14) // 14 days payment term

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        broker_id: assignment.broker_id,
        type: 'single',
        status: 'pending',
        amount: amount,
        due_date: dueDate.toISOString().split('T')[0]
      }])
      .select()
      .single()

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 500 })
    }

    // Create invoice item
    await supabase
      .from('invoice_items')
      .insert([{
        invoice_id: invoice.id,
        description: `Lead: ${assignment.lead?.first_name} ${assignment.lead?.last_name}`,
        quantity: 1,
        unit_price: amount,
        total: amount,
        lead_assignment_id: assignment_id
      }])

    return NextResponse.json({ success: true, invoice })

  } else if (type === 'subscription' && broker_id) {
    // Monthly subscription invoice
    const { data: contract } = await supabase
      .from('contracts')
      .select('*, broker:brokers(*)')
      .eq('broker_id', broker_id)
      .eq('pricing_model', 'subscription')
      .eq('status', 'active')
      .single()

    if (!contract) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const invoiceNumber = await getNextInvoiceNumber()
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        broker_id: broker_id,
        type: 'subscription',
        status: 'pending',
        amount: contract.monthly_fee,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0]
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase
      .from('invoice_items')
      .insert([{
        invoice_id: invoice.id,
        description: `Abo ${periodStart.toLocaleDateString('de-CH')} - ${periodEnd.toLocaleDateString('de-CH')}`,
        quantity: 1,
        unit_price: contract.monthly_fee,
        total: contract.monthly_fee
      }])

    return NextResponse.json({ success: true, invoice })

  } else if (type === 'commission' && broker_id) {
    // Monthly commission invoice (for revenue share)
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    // Get all successful assignments with commission in the period
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('*, lead:leads(*)')
      .eq('broker_id', broker_id)
      .eq('pricing_model', 'revenue_share')
      .eq('status', 'success')
      .not('commission_amount', 'is', null)
      .gte('followup_responded_at', periodStart.toISOString())
      .lte('followup_responded_at', periodEnd.toISOString())

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ error: 'No commissions found for this period' }, { status: 404 })
    }

    const totalAmount = assignments.reduce((sum, a) => sum + (a.commission_amount || 0), 0)
    const invoiceNumber = await getNextInvoiceNumber()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        broker_id: broker_id,
        type: 'commission',
        status: 'pending',
        amount: totalAmount,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0]
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create invoice items for each commission
    for (const assignment of assignments) {
      await supabase
        .from('invoice_items')
        .insert([{
          invoice_id: invoice.id,
          description: `Provision: ${assignment.lead?.first_name} ${assignment.lead?.last_name} (${assignment.revenue_share_percent}%)`,
          quantity: 1,
          unit_price: assignment.commission_amount,
          total: assignment.commission_amount,
          lead_assignment_id: assignment.id
        }])
    }

    return NextResponse.json({ success: true, invoice })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
