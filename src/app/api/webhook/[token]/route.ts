import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  
  const { token } = await context.params
  const { data: source } = await supabase.from('lead_sources').select('*').eq('webhook_token', token).eq('active', true).single()
  if (!source) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  
  const body = await request.json()
  const leadData = {
    source_id: source.id,
    category_id: source.category_id,
    first_name: body.first_name || body.vorname || '',
    last_name: body.last_name || body.nachname || '',
    email: body.email || '',
    phone: body.phone || body.telefon || '',
    plz: body.plz || '',
    ort: body.ort || '',
    extra_data: body,
    status: 'new',
    ownership: 'managed'
  }
  const { data: lead, error } = await supabase.from('leads').insert([leadData]).select().single()
  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })
  return NextResponse.json({ success: true, lead_id: lead.id })
}

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  
  const { token } = await context.params
  const { data: source } = await supabase.from('lead_sources').select('name').eq('webhook_token', token).eq('active', true).single()
  if (!source) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  return NextResponse.json({ status: 'ok', source: source.name })
}
