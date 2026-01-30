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

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invError || !invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    const { data: broker } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', invoice.broker_id)
      .single()

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
    @page { 
      size: A4; 
      margin: 20mm; 
    }
    
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      font-size: 11px;
      color: #333;
      background: #f5f5f5;
      line-height: 1.4;
    }
    
    .print-bar {
      background: #1e1b4b;
      padding: 15px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
    }
    
    .print-bar-title {
      color: white;
      font-size: 14px;
      font-weight: 500;
    }
    
    .print-btn {
      background: #6366f1;
      color: white;
      border: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }
    
    .print-btn:hover {
      background: #4f46e5;
    }
    
    .page-container {
      padding: 80px 20px 40px;
      display: flex;
      justify-content: center;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      background: white;
      padding: 20mm;
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
    }
    
    /* Header Row */
    .header-row {
      display: table;
      width: 100%;
      margin-bottom: 25px;
    }
    
    .logo-cell {
      display: table-cell;
      vertical-align: top;
      width: 50%;
    }
    
    .logo-cell img {
      height: 45px;
    }
    
    .company-cell {
      display: table-cell;
      vertical-align: top;
      width: 50%;
      text-align: right;
      font-size: 10px;
      color: #555;
      line-height: 1.6;
    }
    
    .company-cell strong {
      font-size: 12px;
      color: #1e1b4b;
    }
    
    /* Address Section */
    .address-section {
      margin-bottom: 30px;
      text-align: right;
    }
    
    .sender-line {
      font-size: 9px;
      color: #6366f1;
      margin-bottom: 5px;
    }
    
    .recipient-box {
      display: inline-block;
      text-align: left;
      background: #f8f9fc;
      border-left: 3px solid #6366f1;
      padding: 15px 20px;
      min-width: 250px;
    }
    
    .recipient-label {
      font-size: 9px;
      color: #6366f1;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      font-weight: bold;
    }
    
    .recipient-name {
      font-size: 13px;
      font-weight: bold;
      color: #1e1b4b;
      margin-bottom: 3px;
    }
    
    .recipient-details {
      font-size: 11px;
      color: #333;
      line-height: 1.5;
    }
    
    /* Invoice Title */
    .invoice-header {
      border-bottom: 3px solid #6366f1;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      color: #1e1b4b;
    }
    
    .invoice-number {
      color: #6366f1;
    }
    
    /* Meta Info */
    .meta-info {
      margin-bottom: 25px;
      font-size: 11px;
    }
    
    .meta-row {
      display: inline-block;
      margin-right: 40px;
    }
    
    .meta-label {
      color: #777;
    }
    
    .meta-value {
      font-weight: bold;
      color: #333;
    }
    
    /* Intro Text */
    .intro-text {
      margin-bottom: 20px;
      color: #555;
    }
    
    /* Table */
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    
    .invoice-table th {
      background: #1e1b4b;
      color: white;
      padding: 10px 12px;
      text-align: left;
      font-size: 10px;
      font-weight: bold;
    }
    
    .invoice-table th.right {
      text-align: right;
    }
    
    .invoice-table td {
      padding: 12px;
      border-bottom: 1px solid #eee;
      font-size: 11px;
    }
    
    .invoice-table td.right {
      text-align: right;
    }
    
    /* Totals */
    .totals-wrapper {
      display: table;
      width: 100%;
      margin-bottom: 30px;
    }
    
    .totals-spacer {
      display: table-cell;
      width: 60%;
    }
    
    .totals-box {
      display: table-cell;
      width: 40%;
    }
    
    .total-row {
      display: table;
      width: 100%;
      font-size: 11px;
      padding: 6px 0;
    }
    
    .total-row.border-top {
      border-top: 1px solid #ddd;
    }
    
    .total-row.grand-total {
      border-top: 2px solid #1e1b4b;
      padding-top: 10px;
      margin-top: 5px;
    }
    
    .total-label {
      display: table-cell;
    }
    
    .total-value {
      display: table-cell;
      text-align: right;
      font-weight: bold;
    }
    
    .grand-total .total-label,
    .grand-total .total-value {
      font-size: 16px;
      font-weight: bold;
      color: #1e1b4b;
    }
    
    /* Payment Box */
    .payment-box {
      background: #1e1b4b;
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    
    .payment-title {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    
    .payment-row {
      display: table;
      width: 100%;
      font-size: 11px;
      padding: 4px 0;
    }
    
    .payment-label {
      display: table-cell;
      width: 100px;
      opacity: 0.8;
    }
    
    .payment-value {
      display: table-cell;
    }
    
    /* Closing */
    .closing {
      font-size: 11px;
      color: #555;
      line-height: 1.8;
    }
    
    .closing strong {
      color: #1e1b4b;
    }
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 20mm;
      left: 20mm;
      right: 20mm;
      text-align: center;
      font-size: 9px;
      color: #999;
      border-top: 1px solid #eee;
      padding-top: 15px;
    }
    
    @media print {
      body { 
        background: white; 
      }
      .print-bar { 
        display: none !important; 
      }
      .page-container { 
        padding: 0; 
      }
      .page { 
        box-shadow: none;
        width: 100%;
        min-height: auto;
        padding: 0;
      }
      .payment-box {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .invoice-table th {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .recipient-box {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  
  <div class="print-bar">
    <span class="print-bar-title">Rechnung ${invoice.invoice_number}</span>
    <button class="print-btn" onclick="window.print()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9V2h12v7"></path>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      Als PDF drucken
    </button>
  </div>
  
  <div class="page-container">
    <div class="page">
      
      <!-- Header -->
      <div class="header-row">
        <div class="logo-cell">
          <img src="https://leadshub2.vercel.app/logo.png" alt="LeadsHub" />
        </div>
        <div class="company-cell">
          <strong>LeadsHub</strong><br>
          Sandäckerstrasse 10<br>
          8957 Spreitenbach<br>
          info@leadshub.ch
        </div>
      </div>
      
      <!-- Address -->
      <div class="address-section">
        <div class="sender-line">LeadsHub · Sandäckerstrasse 10 · 8957 Spreitenbach</div>
        <div class="recipient-box">
          <div class="recipient-label">Rechnungsempfänger</div>
          <div class="recipient-name">${broker?.name || '-'}</div>
          <div class="recipient-details">
            ${broker?.contact_person ? broker.contact_person + '<br>' : ''}
            ${broker?.email || ''}
          </div>
        </div>
      </div>
      
      <!-- Invoice Header -->
      <div class="invoice-header">
        <div class="invoice-title">Rechnung <span class="invoice-number">${invoice.invoice_number}</span></div>
      </div>
      
      <!-- Meta -->
      <div class="meta-info">
        <span class="meta-row">
          <span class="meta-label">Datum: </span>
          <span class="meta-value">${invoiceDate}</span>
        </span>
        <span class="meta-row">
          <span class="meta-label">Zahlbar bis: </span>
          <span class="meta-value">${dueDate}</span>
        </span>
      </div>
      
      <!-- Intro -->
      <p class="intro-text">Vielen Dank für Ihr Vertrauen. Hiermit stellen wir Ihnen folgende Leistungen in Rechnung:</p>
      
      <!-- Table -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width:12%">Menge</th>
            <th style="width:12%">Einheit</th>
            <th style="width:42%">Beschreibung</th>
            <th style="width:17%" class="right">Einzelpreis</th>
            <th style="width:17%" class="right">Betrag</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${quantity}</td>
            <td>${unit}</td>
            <td>${description}</td>
            <td class="right">CHF ${unitPrice.toFixed(2)}</td>
            <td class="right">CHF ${Number(invoice.amount).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Totals -->
      <div class="totals-wrapper">
        <div class="totals-spacer"></div>
        <div class="totals-box">
          <div class="total-row">
            <span class="total-label">Zwischensumme</span>
            <span class="total-value">CHF ${Number(invoice.amount).toFixed(2)}</span>
          </div>
          <div class="total-row border-top">
            <span class="total-label">MwSt. (0%)</span>
            <span class="total-value">CHF 0.00</span>
          </div>
          <div class="total-row grand-total">
            <span class="total-label">Gesamttotal</span>
            <span class="total-value">CHF ${Number(invoice.amount).toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <!-- Payment -->
      <div class="payment-box">
        <div class="payment-title">💳 Zahlungsinformationen</div>
        <div class="payment-row">
          <span class="payment-label">Bank:</span>
          <span class="payment-value">Raiffeisenbank</span>
        </div>
        <div class="payment-row">
          <span class="payment-label">IBAN:</span>
          <span class="payment-value">CH93 0076 2011 6238 5295 7</span>
        </div>
        <div class="payment-row">
          <span class="payment-label">Empfänger:</span>
          <span class="payment-value">LeadsHub, 8957 Spreitenbach</span>
        </div>
        <div class="payment-row">
          <span class="payment-label">Referenz:</span>
          <span class="payment-value"><strong>${invoice.invoice_number}</strong></span>
        </div>
      </div>
      
      <!-- Closing -->
      <div class="closing">
        Freundliche Grüsse<br>
        <strong>LeadsHub</strong>
      </div>
      
    </div>
  </div>
</body>
</html>
    `

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })

  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
