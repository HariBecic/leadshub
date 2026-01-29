import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, broker:brokers(*)')
    .eq('id', id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const { data: items } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)

  const baseUrl = request.nextUrl.origin

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rechnung ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo img { height: 50px; }
    .invoice-title { font-size: 32px; font-weight: 700; color: #3A29A6; text-align: right; }
    .invoice-number { color: #64748b; text-align: right; margin-top: 4px; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address { max-width: 250px; }
    .address-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
    .company-name { font-weight: 600; margin-bottom: 4px; }
    .meta { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 32px; display: flex; gap: 40px; }
    .meta-item { }
    .meta-label { font-size: 12px; color: #64748b; }
    .meta-value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { text-align: left; padding: 12px; background: #3A29A6; color: white; font-size: 13px; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 14px 12px; border-bottom: 1px solid #e2e8f0; }
    .total-row { background: #f8fafc; }
    .total-row td { font-weight: 700; font-size: 18px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .bank-details { background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .bank-title { font-weight: 600; margin-bottom: 12px; }
    .bank-row { display: flex; gap: 20px; margin-bottom: 4px; }
    .bank-label { color: #64748b; width: 80px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-paid { background: #dcfce7; color: #166534; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; padding: 12px; background: #dbeafe; border-radius: 8px; text-align: center;">
    <button onclick="window.print()" style="background: #3A29A6; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; cursor: pointer;">
      Als PDF drucken / speichern
    </button>
  </div>

  <div class="header">
    <div class="logo">
      <img src="${baseUrl}/logo.png" alt="LeadsHub" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div style="display: none; font-size: 28px; font-weight: 700; color: #3A29A6;">leads<span style="color: #F26444;">hub</span></div>
    </div>
    <div>
      <div class="invoice-title">RECHNUNG</div>
      <div class="invoice-number">${invoice.invoice_number}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address">
      <div class="address-label">Von</div>
      <div class="company-name">LeadsHub</div>
      <div>Sandäckerstrasse 10</div>
      <div>8957 Spreitenbach</div>
      <div style="margin-top: 8px;">info@leadshub.ch</div>
    </div>
    <div class="address">
      <div class="address-label">An</div>
      <div class="company-name">${invoice.broker?.name || ''}</div>
      <div>${invoice.broker?.contact_person || ''}</div>
      <div>${invoice.broker?.email || ''}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Rechnungsdatum</div>
      <div class="meta-value">${new Date(invoice.created_at).toLocaleDateString('de-CH')}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Fällig bis</div>
      <div class="meta-value">${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-CH') : '-'}</div>
    </div>
    ${invoice.period_start ? `
    <div class="meta-item">
      <div class="meta-label">Zeitraum</div>
      <div class="meta-value">${new Date(invoice.period_start).toLocaleDateString('de-CH')} - ${new Date(invoice.period_end).toLocaleDateString('de-CH')}</div>
    </div>
    ` : ''}
    <div class="meta-item">
      <div class="meta-label">Status</div>
      <div class="meta-value"><span class="status status-${invoice.status}">${invoice.status === 'paid' ? 'Bezahlt' : invoice.status === 'pending' ? 'Offen' : invoice.status}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th>Menge</th>
        <th>Einzelpreis</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${(items || []).map(item => `
      <tr>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>CHF ${Number(item.unit_price).toFixed(2)}</td>
        <td>CHF ${Number(item.total).toFixed(2)}</td>
      </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3">Gesamtbetrag</td>
        <td>CHF ${Number(invoice.amount).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="bank-details">
      <div class="bank-title">Zahlungsinformationen</div>
      <div class="bank-row"><span class="bank-label">Bank:</span> <span>PostFinance</span></div>
      <div class="bank-row"><span class="bank-label">IBAN:</span> <span>CH00 0000 0000 0000 0000 0</span></div>
      <div class="bank-row"><span class="bank-label">Referenz:</span> <span>${invoice.invoice_number}</span></div>
    </div>
    <p style="margin-top: 20px; color: #64748b; font-size: 13px;">
      Bitte überweisen Sie den Betrag innerhalb von 14 Tagen unter Angabe der Rechnungsnummer.
    </p>
  </div>
</body>
</html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    }
  })
}
