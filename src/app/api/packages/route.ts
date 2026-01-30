import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, broker_id, category_id, total_leads, price, distribution_type, leads_per_day } = body

    if (!broker_id || !total_leads) {
      return NextResponse.json({ error: 'broker_id und total_leads erforderlich' }, { status: 400 })
    }

    // Get broker
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', broker_id)
      .single()

    if (brokerError || !broker) {
      return NextResponse.json({ error: 'Broker nicht gefunden', details: brokerError }, { status: 404 })
    }

    // Create package
    const { data: pkg, error: pkgError } = await supabase
      .from('lead_packages')
      .insert({
        name: name || `${total_leads}er Paket`,
        broker_id,
        category_id: category_id || null,
        total_leads,
        delivered_leads: 0,
        price: price || 0,
        distribution_type: distribution_type || 'instant',
        leads_per_day: distribution_type === 'distributed' ? (leads_per_day || 2) : null,
        status: 'pending'
      })
      .select()
      .single()

    if (pkgError) {
      return NextResponse.json({ error: 'Package error', details: pkgError }, { status: 500 })
    }

    // Generate invoice number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
    
    const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`

    // Create invoice - only required fields
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        broker_id,
        type: 'package',
        amount: price || 0,
        status: 'pending',
        package_id: pkg.id
      })
      .select()
      .single()

    if (invError) {
      return NextResponse.json({ 
        success: true, 
        package: pkg,
        invoice: null,
        invoice_error: invError.message,
        email_sent: false 
      })
    }

    // Update package with invoice_id
    await supabase
      .from('lead_packages')
      .update({ invoice_id: invoice.id })
      .eq('id', pkg.id)

    // Send email
    let emailSent = false
    if (broker.email) {
      const emailHtml = `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
            <h1 style="margin:0;font-size:24px;">📦 Lead-Paket bestellt</h1>
          </div>
          <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
            <p style="font-size:16px;color:#1e293b;">Hallo ${broker.contact_person || broker.name},</p>
            <p style="color:#64748b;">Ihr Paket "${name || `${total_leads}er Paket`}" wurde erstellt.</p>
            
            <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
              <div style="font-size:14px;color:#64748b;">Zu zahlen</div>
              <div style="font-size:36px;font-weight:700;color:#1e293b;">CHF ${Number(price).toFixed(2)}</div>
              <div style="font-size:14px;color:#64748b;margin-top:8px;">Rechnung: ${invoiceNumber}</div>
            </div>

            <div style="background:#dbeafe;border-radius:8px;padding:16px;margin:24px 0;">
              <div style="color:#1e40af;font-size:14px;">
                <strong>Zahlung an:</strong><br>
                IBAN: CH00 0000 0000 0000 0000 0<br>
                Referenz: ${invoiceNumber}
              </div>
            </div>

            <p style="color:#64748b;font-size:14px;">Nach Zahlungseingang werden Ihre ${total_leads} Leads automatisch zugestellt.</p>
          </div>
        </div>
      `

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
          to: broker.email,
          subject: `📦 Lead-Paket - Rechnung ${invoiceNumber}`,
          html: emailHtml
        })
        emailSent = true
        
        await supabase
          .from('invoices')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', invoice.id)
      } catch (e: any) {
        console.error('Email error:', e)
      }
    }

    return NextResponse.json({ 
      success: true, 
      package: pkg,
      invoice: invoice,
      email_sent: emailSent 
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
