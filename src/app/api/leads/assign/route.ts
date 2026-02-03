import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { paymentGateEmail, revenueShareLeadEmail } from '@/lib/email-template'
import { createPaymentLink } from '@/lib/stripe'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lead_id, broker_id, pricing_model, price_charged, revenue_share_percent } = body

    console.log('Assign request:', body)

    if (!lead_id || !broker_id) {
      return NextResponse.json({ error: 'lead_id und broker_id erforderlich' }, { status: 400 })
    }

    // Get lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, category:lead_categories(name)')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      console.error('Lead error:', leadError)
      return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })
    }

    // Get broker
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', broker_id)
      .single()

    if (brokerError || !broker) {
      console.error('Broker error:', brokerError)
      return NextResponse.json({ error: 'Broker nicht gefunden' }, { status: 404 })
    }

    // Create assignment
    const { data: assignment, error: assignError } = await supabase
      .from('lead_assignments')
      .insert({
        lead_id,
        broker_id,
        pricing_model: pricing_model || 'single',
        price_charged: price_charged || 0,
        revenue_share_percent: revenue_share_percent || null,
        status: pricing_model === 'commission' ? 'sent' : 'pending' // commission = sofort, sonst warten auf Zahlung
      })
      .select()
      .single()

    if (assignError) {
      console.error('Assignment error:', assignError)
      return NextResponse.json({ error: assignError.message }, { status: 500 })
    }

    // For fixed/single: Create invoice, leads sent after payment
    // For commission: Send leads immediately (free), invoice at end of month
    let invoiceCreated = false
    let emailSent = false
    const categoryName = lead.category?.name || 'Lead'

    if (pricing_model === 'fixed' || pricing_model === 'single') {
      // Create invoice
      const year = new Date().getFullYear()
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`)

      const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`

      const { data: invoice } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        broker_id,
        type: pricing_model,
        amount: price_charged || 0,
        description: `${categoryName}: ${lead.first_name} ${lead.last_name}`,
        status: 'pending',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assignment_id: assignment.id
      }).select().single()

      invoiceCreated = true

      // Create Stripe Payment Link
      if (invoice && broker.email) {
        try {
          const result = await createPaymentLink({
            invoiceId: invoice.id,
            invoiceNumber: invoiceNumber,
            amount: Number(price_charged) || 0,
            description: `${categoryName}-Lead`,
            customerEmail: broker.email,
          })

          // Update invoice with Stripe link
          await supabase
            .from('invoices')
            .update({
              stripe_payment_link: result.paymentLink,
              stripe_payment_id: result.paymentLinkId,
            })
            .eq('id', invoice.id)

          // Send Payment Gate email with Stripe link
          const emailHtml = paymentGateEmail({
            brokerName: broker.contact_person || broker.name,
            category: categoryName,
            amount: Number(price_charged) || 0,
            invoiceNumber: invoiceNumber,
            stripePaymentLink: result.paymentLink
          })

          await resend.emails.send({
            from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
            to: broker.email,
            subject: `Neuer ${categoryName}-Lead verfügbar - CHF ${Number(price_charged).toFixed(2)}`,
            html: emailHtml
          })
          emailSent = true
        } catch (err) {
          console.error('Stripe/Email error:', err)
          return NextResponse.json({ error: 'Stripe Payment Link konnte nicht erstellt werden' }, { status: 500 })
        }
      }
    } else {
      // Commission/Subscription: Send lead immediately
      // Update lead status
      await supabase
        .from('leads')
        .update({ 
          status: 'assigned',
          assignment_count: (lead.assignment_count || 0) + 1
        })
        .eq('id', lead_id)

      // Send email to broker with lead details
      if (broker.email) {
        const emailHtml = revenueShareLeadEmail({
          brokerName: broker.contact_person || broker.name,
          category: categoryName,
          leadName: `${lead.first_name} ${lead.last_name}`,
          leadEmail: lead.email || '',
          leadPhone: lead.phone || '',
          leadPlz: lead.plz || '',
          leadOrt: lead.ort || '',
          revenueSharePercent: revenue_share_percent || 0,
          extraData: lead.extra_data
        })

        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
            to: broker.email,
            subject: `Neuer ${categoryName}-Lead: ${lead.first_name} ${lead.last_name}`,
            html: emailHtml
          })
          emailSent = true
        } catch (e) {
          console.error('Email error:', e)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      assignment,
      invoice_created: invoiceCreated,
      email_sent: emailSent 
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 })
  }
}
