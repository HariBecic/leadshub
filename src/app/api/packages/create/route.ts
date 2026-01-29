import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

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

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { broker_id, category_id, name, total_leads, price, distribution_type, leads_per_day } = body

  if (!broker_id || !name || !total_leads || !price) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })
  }

  // Create invoice first
  const invoiceNumber = await getNextInvoiceNumber()
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert([{
      invoice_number: invoiceNumber,
      broker_id,
      type: 'single',
      status: 'pending',
      amount: price,
      due_date: dueDate.toISOString().split('T')[0]
    }])
    .select()
    .single()

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  // Create package
  const { data: pkg, error: pkgError } = await supabase
    .from('lead_packages')
    .insert([{
      broker_id,
      category_id: category_id || null,
      name,
      total_leads,
      delivered_leads: 0,
      price,
      distribution_type,
      leads_per_day: leads_per_day || 1,
      status: 'pending',
      invoice_id: invoice.id
    }])
    .select()
    .single()

  if (pkgError) {
    return NextResponse.json({ error: pkgError.message }, { status: 500 })
  }

  // Add invoice item
  await supabase
    .from('invoice_items')
    .insert([{
      invoice_id: invoice.id,
      description: `Lead-Paket: ${name} (${total_leads} Leads)`,
      quantity: 1,
      unit_price: price,
      total: price
    }])

  return NextResponse.json({ success: true, package: pkg, invoice })
}
