import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = params.id

    // Get invoice with broker and package
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, broker:brokers(*), package:lead_packages(*)')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    const broker = invoice.broker
    const pkg = invoice.package
    const invoiceDate = new Date(invoice.created_at).toLocaleDateString('de-CH')
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-CH') : '-'
    
    // Determine description
    let description = 'Lead-Dienstleistung'
    let quantity = 1
    let unitPrice = Number(invoice.amount)
    
    if (pkg) {
      description = `Lead-Paket: ${pkg.name} (${pkg.total_leads} Leads)`
      quantity = pkg.total_leads
      unitPrice = Number(invoice.amount) / pkg.total_leads
    }

    // Generate PDF using HTML to PDF approach
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
      font-size: 10pt;
      color: #1e293b;
      padding: 40px;
      max-width: 210mm;
      margin: 0 auto;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .logo {
      font-size: 24pt;
      font-weight: 700;
      color: #1e1b4b;
    }
    .logo span.hub { color: #f97316; }
    .logo span.dot { color: #6366f1; }
    
    .company-info {
      text-align: right;
      font-size: 9pt;
      color: #64748b;
      line-height: 1.6;
    }
    
    .invoice-title {
      font-size: 28pt;
      font-weight: 700;
      color: #1e1b4b;
      margin-bottom: 8px;
    }
    
    .invoice-number {
      font-size: 12pt;
      color: #6366f1;
      font-weight: 600;
      margin-bottom: 30px;
    }
    
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    
    .address-block {
      width: 45%;
    }
    
    .address-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    
    .address-content {
      font-size: 10pt;
      line-height: 1.6;
    }
    
    .address-content strong {
      font-size: 11pt;
      color: #1e1b4b;
    }
    
    .meta-table {
      margin-bottom: 40px;
    }
    
    .meta-table table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .meta-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .meta-table td:first-child {
      color: #64748b;
      width: 150px;
    }
    
    .meta-table td:last-child {
      font-weight: 500;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table th {
      background: #f8fafc;
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .items-table th:last-child,
    .items-table td:last-child {
      text-align: right;
    }
    
    .items-table td {
      padding: 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .items-table .item-name {
      font-weight: 500;
    }
    
    .totals {
      margin-left: auto;
      width: 280px;
    }
    
    .totals table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .totals td {
      padding: 10px 0;
    }
    
    .totals td:last-child {
      text-align: right;
      font-weight: 500;
    }
    
    .totals .total-row {
      border-top: 2px solid #1e1b4b;
      font-size: 14pt;
      font-weight: 700;
    }
    
    .totals .total-row td {
      padding-top: 16px;
      color: #1e1b4b;
    }
    
    .payment-info {
      background: #f8fafc;
      border-radius: 8px;
      padding: 24px;
      margin-top: 40px;
    }
    
    .payment-info h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #1e1b4b;
      margin-bottom: 16px;
    }
    
    .payment-info table {
      width: 100%;
    }
    
    .payment-info td {
      padding: 6px 0;
      font-size: 10pt;
    }
    
    .payment-info td:first-child {
      color: #64748b;
      width: 120px;
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 8pt;
      color: #94a3b8;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    
    .status-paid {
      background: #d1fae5;
      color: #065f46;
    }
  </style>
</head>
<body>
  
  <div class="header">
    <div>
      <div class="logo">leads<span class="hub">hub</span><span class="dot">°</span></div>
    </div>
    <div class="company-info">
      LeadsHub<br>
      Sandäckerstrasse 10<br>
      8957 Spreitenbach<br>
      Schweiz<br>
      info@leadshub.ch
    </div>
  </div>
  
  <div class="invoice-title">RECHNUNG</div>
  <div class="invoice-number">${invoice.invoice_number}</div>
  
  <div class="addresses">
    <div class="address-block">
      <div class="address-label">Rechnungsadresse</div>
      <div class="address-content">
        <strong>${broker?.name || '-'}</strong><br>
        ${broker?.contact_person ? broker.contact_person + '<br>' : ''}
        ${broker?.email || ''}<br>
        ${broker?.phone || ''}
      </div>
    </div>
    <div class="address-block" style="text-align: right;">
      <span class="status-badge ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
        ${invoice.status === 'paid' ? 'Bezahlt' : 'Offen'}
      </span>
    </div>
  </div>
  
  <div class="meta-table">
    <table>
      <tr>
        <td>Rechnungsdatum</td>
        <td>${invoiceDate}</td>
      </tr>
      <tr>
        <td>Fällig bis</td>
        <td>${dueDate}</td>
      </tr>
      <tr>
        <td>Zahlungsart</td>
        <td>Überweisung</td>
      </tr>
    </table>
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
        <td class="item-name">${description}</td>
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
  
  <div class="payment-info">
    <h3>Zahlungsinformationen</h3>
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

    // Return HTML for now - browser can print as PDF
    // For real PDF generation, we'd need puppeteer or similar
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
