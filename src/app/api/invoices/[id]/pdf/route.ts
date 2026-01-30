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

    const invoiceDate = new Date(invoice.created_at).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })
    const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : '30 Tage netto'
    
    // Determine line items
    let description = invoice.description || 'Lead-Dienstleistung'
    let quantity = 1
    let unit = 'Stk'
    let unitPrice = Number(invoice.amount)
    
    if (pkg) {
      description = `Lead-Paket "${pkg.name}"`
      quantity = pkg.total_leads
      unit = 'Leads'
      unitPrice = Number(invoice.amount) / pkg.total_leads
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rechnung ${invoice.invoice_number}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
      font-size: 10pt;
      color: #1a1a2e;
      background: white;
      min-height: 100vh;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 20mm;
      margin: 0 auto;
      background: white;
      position: relative;
    }
    
    /* Header with logo and company info side by side */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15mm;
    }
    
    .logo-section img {
      height: 40px;
      width: auto;
    }
    
    .company-details {
      text-align: left;
      font-size: 9pt;
      color: #4a4a68;
      line-height: 1.6;
    }
    
    /* Two column address section */
    .address-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12mm;
    }
    
    .sender-info {
      font-size: 9pt;
      color: #4a4a68;
      line-height: 1.6;
    }
    
    .recipient-box {
      width: 85mm;
      padding: 5mm;
      background: #f8f9fc;
      border-radius: 4px;
    }
    
    .recipient-label {
      font-size: 8pt;
      color: #6366f1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2mm;
    }
    
    .recipient-content {
      font-size: 10pt;
      line-height: 1.6;
    }
    
    .recipient-content strong {
      font-size: 11pt;
      color: #1a1a2e;
    }
    
    /* Invoice title section */
    .invoice-title-section {
      border-bottom: 2px solid #6366f1;
      padding-bottom: 5mm;
      margin-bottom: 8mm;
    }
    
    .invoice-title {
      font-size: 22pt;
      font-weight: 700;
      color: #1a1a2e;
    }
    
    .invoice-title span {
      color: #6366f1;
    }
    
    /* Meta row */
    .meta-row {
      display: flex;
      gap: 15mm;
      margin-bottom: 10mm;
      font-size: 10pt;
    }
    
    .meta-item {
      display: flex;
      gap: 3mm;
    }
    
    .meta-label {
      color: #6b7280;
    }
    
    .meta-value {
      font-weight: 600;
      color: #1a1a2e;
    }
    
    /* Intro text */
    .intro-text {
      margin-bottom: 8mm;
      font-size: 10pt;
      color: #4a4a68;
      line-height: 1.6;
    }
    
    /* Items table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5mm;
      font-size: 10pt;
    }
    
    .items-table th {
      background: #1e1b4b;
      color: white;
      padding: 3mm 4mm;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
    }
    
    .items-table th:nth-child(1) { width: 15%; }
    .items-table th:nth-child(2) { width: 10%; }
    .items-table th:nth-child(3) { width: 40%; }
    .items-table th:nth-child(4) { width: 17%; text-align: right; }
    .items-table th:nth-child(5) { width: 18%; text-align: right; }
    
    .items-table td {
      padding: 4mm;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    
    .items-table td:nth-child(4),
    .items-table td:nth-child(5) {
      text-align: right;
    }
    
    /* Totals */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10mm;
    }
    
    .totals-box {
      width: 70mm;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 10pt;
    }
    
    .totals-row.subtotal {
      border-bottom: 1px solid #e5e7eb;
    }
    
    .totals-row.total {
      border-top: 2px solid #1e1b4b;
      margin-top: 2mm;
      padding-top: 3mm;
      font-size: 14pt;
      font-weight: 700;
      color: #1e1b4b;
    }
    
    /* Payment info */
    .payment-section {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: white;
      border-radius: 6px;
      padding: 6mm;
      margin-bottom: 10mm;
    }
    
    .payment-title {
      font-size: 11pt;
      font-weight: 600;
      margin-bottom: 4mm;
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    
    .payment-grid {
      display: grid;
      grid-template-columns: 25mm 1fr;
      gap: 2mm 4mm;
      font-size: 10pt;
    }
    
    .payment-label {
      opacity: 0.8;
    }
    
    .payment-value {
      font-weight: 500;
    }
    
    /* Closing */
    .closing {
      font-size: 10pt;
      color: #4a4a68;
      line-height: 1.8;
    }
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 10mm;
      left: 20mm;
      right: 20mm;
      text-align: center;
      font-size: 8pt;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 4mm;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { width: 100%; padding: 10mm 15mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    
    <!-- Header -->
    <div class="header">
      <div class="logo-section">
        <img src="https://leadshub2.vercel.app/logo.png" alt="LeadsHub" />
      </div>
      <div class="company-details">
        <strong>LeadsHub</strong><br>
        Sandäckerstrasse 10<br>
        8957 Spreitenbach<br>
        info@leadshub.ch
      </div>
    </div>
    
    <!-- Address Section -->
    <div class="address-section">
      <div class="sender-info">
        LeadsHub · Sandäckerstrasse 10 · 8957 Spreitenbach
      </div>
      <div class="recipient-box">
        <div class="recipient-label">Rechnungsempfänger</div>
        <div class="recipient-content">
          <strong>${broker?.name || '-'}</strong><br>
          ${broker?.contact_person ? broker.contact_person + '<br>' : ''}
          ${broker?.email || ''}
        </div>
      </div>
    </div>
    
    <!-- Invoice Title -->
    <div class="invoice-title-section">
      <div class="invoice-title">Rechnung <span>${invoice.invoice_number}</span></div>
    </div>
    
    <!-- Meta Row -->
    <div class="meta-row">
      <div class="meta-item">
        <span class="meta-label">Datum:</span>
        <span class="meta-value">${invoiceDate}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Zahlbar bis:</span>
        <span class="meta-value">${dueDate}</span>
      </div>
    </div>
    
    <!-- Intro -->
    <div class="intro-text">
      Vielen Dank für Ihr Vertrauen. Hiermit stellen wir Ihnen folgende Leistungen in Rechnung:
    </div>
    
    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th>Menge</th>
          <th>Einheit</th>
          <th>Beschreibung</th>
          <th>Einzelpreis</th>
          <th>Gesamtpreis</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${quantity}</td>
          <td>${unit}</td>
          <td>${description}</td>
          <td>CHF ${unitPrice.toFixed(2)}</td>
          <td>CHF ${Number(invoice.amount).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    
    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row subtotal">
          <span>Zwischensumme</span>
          <span>CHF ${Number(invoice.amount).toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>MwSt. (0%)</span>
          <span>CHF 0.00</span>
        </div>
        <div class="totals-row total">
          <span>Gesamttotal</span>
          <span>CHF ${Number(invoice.amount).toFixed(2)}</span>
        </div>
      </div>
    </div>
    
    <!-- Payment Info -->
    <div class="payment-section">
      <div class="payment-title">💳 Zahlungsinformationen</div>
      <div class="payment-grid">
        <span class="payment-label">Bank:</span>
        <span class="payment-value">Raiffeisenbank</span>
        <span class="payment-label">IBAN:</span>
        <span class="payment-value">CH93 0076 2011 6238 5295 7</span>
        <span class="payment-label">Empfänger:</span>
        <span class="payment-value">LeadsHub, 8957 Spreitenbach</span>
        <span class="payment-label">Referenz:</span>
        <span class="payment-value">${invoice.invoice_number}</span>
      </div>
    </div>
    
    <!-- Closing -->
    <div class="closing">
      Freundliche Grüsse<br>
      <strong>LeadsHub</strong>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      LeadsHub · Sandäckerstrasse 10 · 8957 Spreitenbach · Schweiz · info@leadshub.ch
    </div>
    
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
