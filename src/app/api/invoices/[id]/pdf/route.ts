import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params

    // Get invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invError || !invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden', details: invError?.message }, { status: 404 })
    }

    // Get broker separately
    const { data: broker } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', invoice.broker_id)
      .single()

    // Get package if exists
    let pkg = null
    if (invoice.package_id) {
      const { data: pkgData } = await supabase
        .from('lead_packages')
        .select('*')
        .eq('id', invoice.package_id)
        .single()
      pkg = pkgData
    }

    const invoiceDate = new Date(invoice.created_at).toLocaleDateString('de-CH')
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-CH') : '-'
    
    // Determine description
    let description = invoice.description || 'Lead-Dienstleistung'
    let quantity = 1
    let unitPrice = Number(invoice.amount)
    
    if (pkg) {
      description = `Lead-Paket: ${pkg.name} (${pkg.total_leads} Leads)`
      quantity = pkg.total_leads
      unitPrice = Number(invoice.amount) / pkg.total_leads
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rechnung ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
      font-size: 11pt;
      color: #1e293b;
      padding: 50px;
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 50px;
      padding-bottom: 25px;
      border-bottom: 3px solid #6366f1;
    }
    
    .logo {
      font-size: 28pt;
      font-weight: 700;
      color: #1e1b4b;
    }
    .logo .hub { color: #f97316; }
    .logo .dot { color: #6366f1; }
    
    .company-info {
      text-align: right;
      font-size: 10pt;
      color: #64748b;
      line-height: 1.7;
    }
    
    .invoice-header {
      margin-bottom: 40px;
    }
    
    .invoice-title {
      font-size: 32pt;
      font-weight: 700;
      color: #1e1b4b;
      margin-bottom: 5px;
    }
    
    .invoice-number {
      font-size: 14pt;
      color: #6366f1;
      font-weight: 600;
    }
    
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    
    .address-block { width: 48%; }
    
    .address-label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .address-content {
      font-size: 11pt;
      line-height: 1.7;
    }
    
    .address-content strong {
      font-size: 12pt;
      color: #1e1b4b;
      display: block;
      margin-bottom: 5px;
    }
    
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
    }
    
    .meta-item label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      display: block;
      margin-bottom: 5px;
    }
    
    .meta-item span {
      font-weight: 600;
      color: #1e293b;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table th {
      background: #1e1b4b;
      color: white;
      padding: 15px 20px;
      text-align: left;
      font-weight: 600;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .items-table th:last-child,
    .items-table td:last-child {
      text-align: right;
    }
    
    .items-table td {
      padding: 20px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11pt;
    }
    
    .totals {
      margin-left: auto;
      width: 300px;
      margin-bottom: 40px;
    }
    
    .totals table { width: 100%; }
    
    .totals td {
      padding: 12px 0;
      font-size: 11pt;
    }
    
    .totals td:last-child {
      text-align: right;
      font-weight: 500;
    }
    
    .totals .total-row {
      border-top: 3px solid #1e1b4b;
    }
    
    .totals .total-row td {
      padding-top: 15px;
      font-size: 16pt;
      font-weight: 700;
      color: #1e1b4b;
    }
    
    .payment-box {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      border-radius: 12px;
      padding: 30px;
      margin-top: 40px;
    }
    
    .payment-box h3 {
      font-size: 14pt;
      margin-bottom: 20px;
      font-weight: 600;
    }
    
    .payment-box table { width: 100%; }
    
    .payment-box td {
      padding: 8px 0;
      font-size: 11pt;
    }
    
    .payment-box td:first-child {
      opacity: 0.8;
      width: 120px;
    }
    
    .payment-box td:last-child {
      font-weight: 500;
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9pt;
      color: #94a3b8;
    }
    
    .status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 10pt;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-sent { background: #dbeafe; color: #1e40af; }
    
    @media print {
      body { padding: 20px; }
      .payment-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  
  <div class="header">
    <div class="logo">leads<span class="hub">hub</span><span class="dot">°</span></div>
    <div class="company-info">
      <strong>LeadsHub</strong><br>
      Sandäckerstrasse 10<br>
      8957 Spreitenbach<br>
      Schweiz<br>
      info@leadshub.ch
    </div>
  </div>
  
  <div class="invoice-header">
    <div class="invoice-title">RECHNUNG</div>
    <div class="invoice-number">${invoice.invoice_number}</div>
  </div>
  
  <div class="addresses">
    <div class="address-block">
      <div class="address-label">Rechnungsempfänger</div>
      <div class="address-content">
        <strong>${broker?.name || '-'}</strong>
        ${broker?.contact_person ? broker.contact_person + '<br>' : ''}
        ${broker?.email || ''}<br>
        ${broker?.phone || ''}
      </div>
    </div>
    <div class="address-block" style="text-align: right;">
      <span class="status status-${invoice.status}">
        ${invoice.status === 'paid' ? 'Bezahlt' : invoice.status === 'sent' ? 'Gesendet' : 'Offen'}
      </span>
    </div>
  </div>
  
  <div class="meta-grid">
    <div class="meta-item">
      <label>Rechnungsdatum</label>
      <span>${invoiceDate}</span>
    </div>
    <div class="meta-item">
      <label>Fällig bis</label>
      <span>${dueDate}</span>
    </div>
    <div class="meta-item">
      <label>Rechnungsnr.</label>
      <span>${invoice.invoice_number}</span>
    </div>
  </div>
  
  <table class="items-table">
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th>Menge</th>
        <th>Einzelpreis</th>
        <th>Betrag</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${description}</td>
        <td>${quantity}</td>
        <td>CHF ${unitPrice.toFixed(2)}</td>
        <td>CHF ${Number(invoice.amount).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  
  <div class="totals">
    <table>
      <tr>
        <td>Zwischensumme</td>
        <td>CHF ${Number(invoice.amount).toFixed(2)}</td>
      </tr>
      <tr>
        <td>MwSt. (0%)</td>
        <td>CHF 0.00</td>
      </tr>
      <tr class="total-row">
        <td>Total</td>
        <td>CHF ${Number(invoice.amount).toFixed(2)}</td>
      </tr>
    </table>
  </div>
  
  <div class="payment-box">
    <h3>💳 Zahlungsinformationen</h3>
    <table>
      <tr>
        <td>Bank</td>
        <td>Raiffeisenbank</td>
      </tr>
      <tr>
        <td>IBAN</td>
        <td>CH93 0076 2011 6238 5295 7</td>
      </tr>
      <tr>
        <td>Empfänger</td>
        <td>LeadsHub, 8957 Spreitenbach</td>
      </tr>
      <tr>
        <td>Referenz</td>
        <td><strong>${invoice.invoice_number}</strong></td>
      </tr>
    </table>
  </div>
  
  <div class="footer">
    LeadsHub · Sandäckerstrasse 10 · 8957 Spreitenbach · Schweiz · info@leadshub.ch
  </div>
  
</body>
</html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
