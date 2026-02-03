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
    const { lead_ids, broker_id, name, price, distribution_type, leads_per_day } = body

    if (!broker_id || !lead_ids || lead_ids.length === 0) {
      return NextResponse.json({ error: 'broker_id und lead_ids erforderlich' }, { status: 400 })
    }

    // Get broker
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', broker_id)
      .single()

    if (brokerError || !broker) {
      return NextResponse.json({ error: 'Broker nicht gefunden' }, { status: 404 })
    }

    // Get all leads with their categories
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*, category:lead_categories(id, name)')
      .in('id', lead_ids)

    if (leadsError || !leads || leads.length === 0) {
      return NextResponse.json({ error: 'Leads nicht gefunden' }, { status: 404 })
    }

    const totalLeads = leads.length
    const packageName = name || `${totalLeads}er Paket`

    // Determine status based on distribution type
    // instant = all leads delivered immediately -> completed
    // distributed = leads delivered over time -> active
    const packageStatus = distribution_type === 'instant' ? 'completed' : 'active'
    const deliveredLeads = distribution_type === 'instant' ? totalLeads : 0

    // Create package
    const { data: pkg, error: pkgError } = await supabase
      .from('lead_packages')
      .insert({
        name: packageName,
        broker_id,
        category_id: null, // Mixed categories possible when selecting from leads
        total_leads: totalLeads,
        delivered_leads: deliveredLeads,
        price: price || 0,
        distribution_type: distribution_type || 'instant',
        leads_per_day: distribution_type === 'distributed' ? (leads_per_day || 2) : null,
        status: packageStatus,
        next_delivery_date: distribution_type === 'distributed' ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (pkgError) {
      return NextResponse.json({ error: 'Package error', details: pkgError.message }, { status: 500 })
    }

    // Generate invoice number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)

    const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Create invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        broker_id,
        type: 'package',
        amount: price || 0,
        status: 'pending',
        due_date: dueDate.toISOString(),
        package_id: pkg.id
      })
      .select()
      .single()

    if (!invError && invoice) {
      // Update package with invoice_id
      await supabase
        .from('lead_packages')
        .update({ invoice_id: invoice.id })
        .eq('id', pkg.id)
    }

    // For instant delivery, create assignments and update lead statuses now
    if (distribution_type === 'instant') {
      // Create lead assignments
      const assignments = leads.map(lead => ({
        lead_id: lead.id,
        broker_id,
        package_id: pkg.id,
        assigned_at: new Date().toISOString(),
        status: 'sent',
        pricing_model: 'package',
        price_charged: totalLeads > 0 ? (price || 0) / totalLeads : 0
      }))

      await supabase.from('lead_assignments').insert(assignments)

      // Update all leads to assigned
      await supabase
        .from('leads')
        .update({ status: 'assigned' })
        .in('id', lead_ids)
    }

    // Send email with leads
    let emailSent = false
    if (broker.email && distribution_type === 'instant') {
      const formattedDate = new Date().toLocaleDateString('de-CH')
      const formattedDueDate = dueDate.toLocaleDateString('de-CH')

      // Build leads table HTML
      const leadsTableRows = leads.map(lead => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:white;">${lead.first_name || ''} ${lead.last_name || ''}</td>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);">${lead.email || '-'}</td>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);">${lead.phone || '-'}</td>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);">${lead.plz || ''} ${lead.ort || ''}</td>
          <td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);">${lead.category?.name || '-'}</td>
        </tr>
      `).join('')

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%);min-height:100vh;">
  <div style="max-width:800px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <img src="https://leadshub2.vercel.app/logo.png" alt="LeadsHub" style="height:48px;width:auto;" />
    </div>

    <!-- Main Card -->
    <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:24px;border:1px solid rgba(255,255,255,0.2);overflow:hidden;">

      <!-- Header -->
      <div style="background:rgba(255,255,255,0.05);padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:48px;margin-bottom:16px;">📦</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:white;">Lead-Paket: ${packageName}</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);">${totalLeads} Leads wurden Ihnen zugewiesen</p>
      </div>

      <!-- Content -->
      <div style="padding:32px;">
        <p style="color:rgba(255,255,255,0.9);font-size:16px;line-height:1.6;margin:0 0 24px;">
          Hallo ${broker.contact_person || broker.name},<br><br>
          Ihr Lead-Paket wurde erstellt und die Leads wurden Ihnen zugewiesen. Hier sind die Details:
        </p>

        <!-- Package Info -->
        <div style="background:rgba(249,115,22,0.2);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid rgba(249,115,22,0.3);">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:rgba(255,255,255,0.6);font-size:14px;">Rechnung</td>
              <td style="padding:8px 0;color:white;font-weight:600;text-align:right;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Paket</td>
              <td style="padding:8px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${packageName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Anzahl Leads</td>
              <td style="padding:8px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${totalLeads}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Zu zahlen</td>
              <td style="padding:8px 0;color:white;font-weight:700;font-size:18px;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">CHF ${Number(price || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:rgba(255,255,255,0.6);font-size:14px;border-top:1px solid rgba(255,255,255,0.1);">Fällig bis</td>
              <td style="padding:8px 0;color:white;text-align:right;border-top:1px solid rgba(255,255,255,0.1);">${formattedDueDate}</td>
            </tr>
          </table>
        </div>

        <!-- Leads Table -->
        <h3 style="color:white;margin:0 0 16px;font-size:18px;">Ihre Leads</h3>
        <div style="background:rgba(255,255,255,0.05);border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(255,255,255,0.1);">
                <th style="padding:12px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">NAME</th>
                <th style="padding:12px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">E-MAIL</th>
                <th style="padding:12px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">TELEFON</th>
                <th style="padding:12px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">ORT</th>
                <th style="padding:12px;text-align:left;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;">KATEGORIE</th>
              </tr>
            </thead>
            <tbody>
              ${leadsTableRows}
            </tbody>
          </table>
        </div>

        <!-- Payment Details -->
        <div style="background:rgba(99,102,241,0.2);border-radius:16px;padding:24px;margin-bottom:24px;border:1px solid rgba(99,102,241,0.3);">
          <div style="color:#a5b4fc;font-weight:600;margin-bottom:12px;">Zahlungsdetails</div>
          <table style="width:100%;">
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">IBAN:</td>
              <td style="color:white;padding:4px 0;font-size:14px;">CH93 0076 2011 6238 5295 7</td>
            </tr>
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">Bank:</td>
              <td style="color:white;padding:4px 0;font-size:14px;">Raiffeisenbank</td>
            </tr>
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">Empfänger:</td>
              <td style="color:white;padding:4px 0;font-size:14px;">LeadsHub, 8957 Spreitenbach</td>
            </tr>
            <tr>
              <td style="color:rgba(255,255,255,0.6);padding:4px 0;font-size:14px;">Referenz:</td>
              <td style="color:white;padding:4px 0;font-size:14px;font-weight:600;">${invoiceNumber}</td>
            </tr>
          </table>
        </div>

      </div>

      <!-- Footer -->
      <div style="background:rgba(0,0,0,0.2);padding:24px 32px;border-top:1px solid rgba(255,255,255,0.1);">
        <p style="margin:0;color:rgba(255,255,255,0.6);font-size:14px;">
          Freundliche Grüsse<br>
          <strong style="color:white;">LeadsHub</strong><br>
          <span style="font-size:12px;">Sandäckerstrasse 10, 8957 Spreitenbach</span>
        </p>
      </div>

    </div>

    <!-- Footer Links -->
    <div style="text-align:center;margin-top:24px;">
      <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;">
        © 2026 LeadsHub. Alle Rechte vorbehalten.
      </p>
    </div>

  </div>
</body>
</html>
      `

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
          to: broker.email,
          subject: `📦 ${packageName} - ${totalLeads} Leads zugewiesen`,
          html: emailHtml
        })
        emailSent = true

        if (invoice) {
          await supabase
            .from('invoices')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', invoice.id)
        }
      } catch (e: any) {
        console.error('Email error:', e)
      }
    }

    return NextResponse.json({
      success: true,
      package: pkg,
      invoice: invoice,
      assigned_leads: distribution_type === 'instant' ? totalLeads : 0,
      email_sent: emailSent
    })

  } catch (err: any) {
    console.error('Server error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
