import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { 
  leadDeliveryEmail, 
  subscriptionDeliveryEmail,
  emailTemplate,
  greeting,
  paragraph,
  spacer,
  highlightBox,
  signature
} from '@/lib/email-template'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { invoice_id } = await request.json()

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id erforderlich' }, { status: 400 })
    }

    // Get invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, broker:brokers(*)')
      .eq('id', invoice_id)
      .single()

    if (!invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    // Mark invoice as paid
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoice_id)

    let leadsDelivered = 0
    let emailSent = false

    // Check if it's a package invoice
    if (invoice.package_id) {
      // Get package
      const { data: pkg } = await supabase
        .from('lead_packages')
        .select('*')
        .eq('id', invoice.package_id)
        .single()

      if (pkg) {
        // Check if there are pre-reserved leads (from "from-leads" creation)
        const { data: pendingAssignments } = await supabase
          .from('lead_assignments')
          .select('*, lead:leads(*, category:lead_categories(*))')
          .eq('package_id', pkg.id)
          .eq('status', 'pending')

        if (pendingAssignments && pendingAssignments.length > 0) {
          // This is a package with pre-selected leads - deliver them now
          console.log(`Paket ${pkg.name} hat ${pendingAssignments.length} reservierte Leads - liefere jetzt`)

          // Update assignments to 'sent' and unlock
          const assignmentIds = pendingAssignments.map(a => a.id)
          await supabase
            .from('lead_assignments')
            .update({
              status: 'sent',
              unlocked: true,
              email_sent_at: new Date().toISOString()
            })
            .in('id', assignmentIds)

          // Update package to completed
          await supabase
            .from('lead_packages')
            .update({
              status: 'completed',
              paid_at: new Date().toISOString(),
              delivered_leads: pendingAssignments.length
            })
            .eq('id', pkg.id)

          leadsDelivered = pendingAssignments.length

          // Send email with all lead details
          if (invoice.broker?.email) {
            const leads = pendingAssignments.map(a => a.lead).filter(Boolean)
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

            try {
              await resend.emails.send({
                from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
                to: invoice.broker.email,
                subject: `🎉 ${pkg.name} - ${leads.length} Leads verfügbar`,
                html: emailHtml
              })
              emailSent = true
            } catch (e) {
              console.error('Email error:', e)
            }
          }
        } else {
          // Standard package flow - no pre-reserved leads
          // Activate package
          await supabase
            .from('lead_packages')
            .update({ status: 'active', paid_at: new Date().toISOString() })
            .eq('id', pkg.id)

          // For instant delivery, assign leads now
          if (pkg.distribution_type === 'instant') {
            const result = await deliverPackageLeads(pkg, invoice.broker)
            leadsDelivered = result.delivered
            emailSent = result.emailSent
          } else {
            // For distributed, send confirmation
            if (invoice.broker?.email) {
              const content = `
                ${greeting(invoice.broker.contact_person || invoice.broker.name)}
                ${paragraph(`Vielen Dank! Ihre Zahlung für "<strong>${pkg.name}</strong>" ist eingegangen.`)}
                ${paragraph(`Sie erhalten ab sofort täglich <strong>${pkg.leads_per_day} Leads</strong> per E-Mail, bis alle <strong>${pkg.total_leads} Leads</strong> geliefert sind.`)}
                ${spacer(20)}
                ${highlightBox(`<strong>Start:</strong> Die erste Lieferung erfolgt morgen um 09:00 Uhr.`, 'success')}
                ${signature()}
              `
              const emailHtml = emailTemplate(content, '✅ Zahlung erhalten')

              try {
                await resend.emails.send({
                  from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
                  to: invoice.broker.email,
                  subject: `✅ Zahlung erhalten - ${pkg.name} aktiviert`,
                  html: emailHtml
                })
                emailSent = true
              } catch (e) {
                console.error('Email error:', e)
              }
            }
          }
        }
      }
    }

    // Check if it's a single lead invoice
    if (invoice.assignment_id) {
      const { data: assignment } = await supabase
        .from('lead_assignments')
        .select('*, lead:leads(*, category:lead_categories(name))')
        .eq('id', invoice.assignment_id)
        .single()

      if (assignment && assignment.lead) {
        // Update assignment status
        await supabase
          .from('lead_assignments')
          .update({ status: 'sent' })
          .eq('id', assignment.id)

        // Update lead status
        await supabase
          .from('leads')
          .update({ status: 'assigned' })
          .eq('id', assignment.lead.id)

        leadsDelivered = 1

        // Send lead details to broker
        if (invoice.broker?.email) {
          const lead = assignment.lead
          const categoryName = lead.category?.name || 'Lead'
          
          const emailHtml = leadDeliveryEmail({
            brokerName: invoice.broker.contact_person || invoice.broker.name,
            category: categoryName,
            leadName: `${lead.first_name} ${lead.last_name}`,
            leadEmail: lead.email || '',
            leadPhone: lead.phone || '',
            leadPlz: lead.plz || '',
            leadOrt: lead.ort || '',
            extraData: lead.extra_data
          })

          try {
            await resend.emails.send({
              from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
              to: invoice.broker.email,
              subject: `🎯 Ihr ${categoryName}-Lead: ${lead.first_name} ${lead.last_name}`,
              html: emailHtml
            })
            emailSent = true
          } catch (e) {
            console.error('Email error:', e)
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      leads_delivered: leadsDelivered,
      email_sent: emailSent
    })

  } catch (err) {
    console.error('Error:', err)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

// Helper function to deliver package leads
async function deliverPackageLeads(pkg: any, broker: any) {
  const leadsNeeded = pkg.total_leads - (pkg.delivered_leads || 0)
  if (leadsNeeded <= 0) return { delivered: 0, emailSent: false }

  // Find available leads
  let query = supabase
    .from('leads')
    .select('*, category:lead_categories(name)')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(leadsNeeded)

  if (pkg.category_id) {
    query = query.eq('category_id', pkg.category_id)
  }

  const { data: leads } = await query

  if (!leads || leads.length === 0) {
    return { delivered: 0, emailSent: false }
  }

  // Create assignments
  const assignments = leads.map(lead => ({
    lead_id: lead.id,
    broker_id: pkg.broker_id,
    package_id: pkg.id,
    pricing_model: 'package',
    price_charged: pkg.price / pkg.total_leads,
    status: 'sent'
  }))

  await supabase.from('lead_assignments').insert(assignments)

  // Update leads status
  const leadIds = leads.map(l => l.id)
  await supabase
    .from('leads')
    .update({ status: 'assigned' })
    .in('id', leadIds)

  // Update package
  const newDelivered = (pkg.delivered_leads || 0) + leads.length
  await supabase
    .from('lead_packages')
    .update({ 
      delivered_leads: newDelivered,
      status: newDelivered >= pkg.total_leads ? 'completed' : 'active'
    })
    .eq('id', pkg.id)

  // Send email with new template
  let emailSent = false
  if (broker?.email && leads.length > 0) {
    const emailHtml = subscriptionDeliveryEmail({
      brokerName: broker.contact_person || broker.name,
      packageName: pkg.name,
      leadsCount: leads.length,
      leads: leads.map(lead => ({
        name: `${lead.first_name} ${lead.last_name}`,
        email: lead.email || '',
        phone: lead.phone || '',
        plz: lead.plz || '',
        ort: lead.ort || '',
        extraData: lead.extra_data
      }))
    })

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
        to: broker.email,
        subject: `📦 ${leads.length} Leads geliefert - ${pkg.name}`,
        html: emailHtml
      })
      emailSent = true
    } catch (e) {
      console.error('Email error:', e)
    }
  }

  return { delivered: leads.length, emailSent }
}
