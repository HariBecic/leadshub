import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { subscriptionDeliveryEmail } from '@/lib/email-template'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

// This endpoint is called from the success page to verify and process payment
// It serves as a fallback if the webhook doesn't work
export async function POST(request: NextRequest) {
  try {
    const { invoice_number } = await request.json()

    if (!invoice_number) {
      return NextResponse.json({ error: 'invoice_number erforderlich' }, { status: 400 })
    }

    console.log(`Verify payment für Rechnung: ${invoice_number}`)

    // Find invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, broker:brokers(*), package_id')
      .eq('invoice_number', invoice_number)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice nicht gefunden:', invoice_number)
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    // Already paid?
    if (invoice.status === 'paid') {
      console.log('Rechnung bereits bezahlt')
      return NextResponse.json({
        success: true,
        already_paid: true,
        message: 'Zahlung bereits verarbeitet'
      })
    }

    // Check if there's a Stripe payment link and it was used
    // For now, we'll trust that if user reached success page, payment was successful
    // In production, you'd verify with Stripe API

    // Mark invoice as paid
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: 'stripe'
      })
      .eq('id', invoice.id)

    console.log(`Rechnung ${invoice_number} als bezahlt markiert`)

    let leadsDelivered = 0
    let emailSent = false

    // Handle package
    if (invoice.package_id) {
      const { data: pkg } = await supabase
        .from('lead_packages')
        .select('*')
        .eq('id', invoice.package_id)
        .single()

      if (pkg) {
        // Check for pre-reserved leads
        const { data: pendingAssignments } = await supabase
          .from('lead_assignments')
          .select('*, lead:leads(*, category:lead_categories(*))')
          .eq('package_id', pkg.id)
          .eq('status', 'pending')

        if (pendingAssignments && pendingAssignments.length > 0) {
          console.log(`${pendingAssignments.length} reservierte Leads gefunden`)

          // Update assignments
          const assignmentIds = pendingAssignments.map(a => a.id)
          await supabase
            .from('lead_assignments')
            .update({
              status: 'sent',
              unlocked: true,
              email_sent_at: new Date().toISOString()
            })
            .in('id', assignmentIds)

          // Update package
          await supabase
            .from('lead_packages')
            .update({
              status: 'completed',
              paid_at: new Date().toISOString(),
              delivered_leads: pendingAssignments.length
            })
            .eq('id', pkg.id)

          leadsDelivered = pendingAssignments.length

          // Send email
          if (invoice.broker?.email) {
            const leads = pendingAssignments.map(a => a.lead).filter(Boolean)

            try {
              const emailHtml = subscriptionDeliveryEmail({
                brokerName: invoice.broker.contact_person || invoice.broker.name,
                packageName: pkg.name,
                leadsCount: leads.length,
                leads: leads.map((lead: any) => ({
                  name: `${lead.first_name || ''} ${lead.last_name || ''}`,
                  email: lead.email || '',
                  phone: lead.phone || '',
                  plz: lead.plz || '',
                  ort: lead.ort || '',
                  extraData: lead.extra_data
                }))
              })

              await resend.emails.send({
                from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
                to: invoice.broker.email,
                subject: `🎉 ${pkg.name} - ${leads.length} Leads verfügbar`,
                html: emailHtml
              })
              emailSent = true
              console.log(`E-Mail mit ${leads.length} Leads gesendet an ${invoice.broker.email}`)
            } catch (e: any) {
              console.error('Email error:', e?.message || e)
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      leads_delivered: leadsDelivered,
      email_sent: emailSent
    })

  } catch (err: any) {
    console.error('Verify payment error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
