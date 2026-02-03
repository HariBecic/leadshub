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

    // Find invoice with description field
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, broker:brokers(*)')
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

    // Mark invoice as paid
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', invoice.id)

    if (updateError) {
      console.error('Fehler beim Update der Rechnung:', updateError)
      return NextResponse.json({
        error: 'Rechnung konnte nicht aktualisiert werden',
        details: updateError.message
      }, { status: 500 })
    }

    console.log(`Rechnung ${invoice_number} als bezahlt markiert`)

    let leadsDelivered = 0
    let emailSent = false

    // Parse lead_ids from invoice description
    let leadIds: string[] = []
    let packageName = ''

    if (invoice.description) {
      try {
        const descData = JSON.parse(invoice.description)
        leadIds = descData.lead_ids || []
        packageName = descData.package_name || ''
        console.log(`Lead IDs aus Description: ${leadIds.length} Leads`)
      } catch (e) {
        console.log('Description ist kein JSON, überspringe')
      }
    }

    // Handle package with reserved leads
    if (invoice.package_id && leadIds.length > 0) {
      const { data: pkg } = await supabase
        .from('lead_packages')
        .select('*')
        .eq('id', invoice.package_id)
        .single()

      if (pkg) {
        console.log(`Package gefunden: ${pkg.id}`)

        // Get the reserved leads
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('*, category:lead_categories(*)')
          .in('id', leadIds)

        if (leadsError) {
          console.error('Fehler beim Laden der Leads:', leadsError)
        }

        if (leads && leads.length > 0) {
          console.log(`${leads.length} reservierte Leads gefunden`)

          // Create lead assignments
          const assignments = leads.map(lead => ({
            lead_id: lead.id,
            broker_id: invoice.broker_id,
            pricing_model: 'package',
            price_charged: leads.length > 0 ? pkg.price / leads.length : 0,
            status: 'sent',
            unlocked: true,
            email_sent_at: new Date().toISOString()
          }))

          const { error: assignError } = await supabase
            .from('lead_assignments')
            .insert(assignments)

          if (assignError) {
            console.error('Fehler beim Erstellen der Assignments:', assignError)
          } else {
            console.log(`${assignments.length} Assignments erstellt`)
          }

          // Update leads status to assigned
          await supabase
            .from('leads')
            .update({ status: 'assigned' })
            .in('id', leadIds)

          // Update package
          await supabase
            .from('lead_packages')
            .update({
              status: 'completed',
              paid_at: new Date().toISOString(),
              delivered_leads: leads.length
            })
            .eq('id', pkg.id)

          leadsDelivered = leads.length

          // Send email with leads
          if (invoice.broker?.email) {
            try {
              const emailHtml = subscriptionDeliveryEmail({
                brokerName: invoice.broker.contact_person || invoice.broker.name,
                packageName: packageName || pkg.name,
                leadsCount: leads.length,
                leads: leads.map((lead: any) => ({
                  name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
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
                subject: `🎉 ${packageName || pkg.name} - ${leads.length} Leads verfügbar`,
                html: emailHtml
              })
              emailSent = true
              console.log(`E-Mail mit ${leads.length} Leads gesendet an ${invoice.broker.email}`)
            } catch (e: any) {
              console.error('Email error:', e?.message || e)
            }
          }
        } else {
          console.log('Keine Leads gefunden für IDs:', leadIds)
        }
      }
    } else {
      console.log(`Keine Lead IDs in Description oder kein package_id. Package: ${invoice.package_id}, Leads: ${leadIds.length}`)
    }

    return NextResponse.json({
      success: true,
      leads_delivered: leadsDelivered,
      email_sent: emailSent,
      debug: {
        has_package_id: !!invoice.package_id,
        package_id: invoice.package_id,
        lead_ids_count: leadIds.length,
        broker_email: invoice.broker?.email || null
      }
    })

  } catch (err: any) {
    console.error('Verify payment error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
