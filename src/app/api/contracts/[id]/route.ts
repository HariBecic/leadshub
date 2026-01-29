import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// GET - Load contract for confirmation page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*, broker:brokers(*), category:lead_categories(name)')
    .eq('id', id)
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: 'Vertrag nicht gefunden' }, { status: 404 })
  }

  if (contract.confirmation_token !== token) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 403 })
  }

  return NextResponse.json({
    id: contract.id,
    pricing_model: contract.pricing_model,
    price_per_lead: contract.price_per_lead,
    monthly_fee: contract.monthly_fee,
    revenue_share_percent: contract.revenue_share_percent,
    followup_days: contract.followup_days,
    status: contract.status,
    confirmed_at: contract.confirmed_at,
    category: contract.category?.name || 'Alle Kategorien',
    broker: {
      name: contract.broker?.name,
      contact_person: contract.broker?.contact_person
    }
  })
}

// POST - Confirm contract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { token } = await request.json()

  if (!token) {
    return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: 'Vertrag nicht gefunden' }, { status: 404 })
  }

  if (contract.confirmation_token !== token) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 403 })
  }

  if (contract.status === 'active') {
    return NextResponse.json({ error: 'Vertrag wurde bereits bestätigt' }, { status: 400 })
  }

  // Deactivate any existing active contracts for same broker/category
  await supabase
    .from('contracts')
    .update({ status: 'inactive' })
    .eq('broker_id', contract.broker_id)
    .eq('category_id', contract.category_id)
    .eq('status', 'active')

  // Activate this contract
  const { error: updateError } = await supabase
    .from('contracts')
    .update({ 
      status: 'active',
      confirmed_at: new Date().toISOString()
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
