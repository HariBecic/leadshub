// Einheitliches E-Mail Template - Helles Design (funktioniert in allen Modi)
// Datei: src/lib/email-template.ts

const LOGO_URL = 'https://leadshub2.vercel.app/logo.png'

export function emailTemplate(content: string, title: string = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Logo -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <img src="${LOGO_URL}" alt="LeadsHub" style="height: 36px; width: auto;" />
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">${title}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                LeadsHub · Sandäckerstrasse 10 · 8957 Spreitenbach
              </p>
              <p style="margin: 8px 0 0; color: #d1d5db; font-size: 12px;">
                © 2026 LeadsHub. Alle Rechte vorbehalten.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `
}

// Hilfsfunktionen für einheitliche Elemente
export function infoBox(items: { label: string; value: string }[]) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      ${items.map((item, index) => `
        <tr>
          <td style="padding: 14px 20px; color: #6b7280; font-size: 14px; border-bottom: ${index < items.length - 1 ? '1px solid #e5e7eb' : 'none'}; width: 40%;">
            ${item.label}
          </td>
          <td style="padding: 14px 20px; color: #111827; font-size: 14px; font-weight: 500; border-bottom: ${index < items.length - 1 ? '1px solid #e5e7eb' : 'none'};">
            ${item.value}
          </td>
        </tr>
      `).join('')}
    </table>
  `
}

export function sectionTitle(text: string) {
  return `<p style="margin: 0 0 12px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">${text}</p>`
}

export function highlightBox(content: string, type: 'info' | 'warning' | 'success' = 'info') {
  const colors = {
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' }
  }
  const c = colors[type]
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${c.bg}; border: 1px solid ${c.border}; border-radius: 10px;">
      <tr>
        <td style="padding: 14px 18px; color: ${c.text}; font-size: 14px; line-height: 1.5;">
          ${content}
        </td>
      </tr>
    </table>
  `
}

export function amountDisplay(amount: string, label: string = 'Betrag') {
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 24px 0;">
          <p style="margin: 0 0 6px; color: #6b7280; font-size: 14px;">${label}</p>
          <p style="margin: 0; color: #111827; font-size: 36px; font-weight: 700;">CHF ${amount}</p>
        </td>
      </tr>
    </table>
  `
}

export function paragraph(text: string) {
  return `<p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">${text}</p>`
}

export function greeting(name: string) {
  return `<p style="margin: 0 0 16px; color: #111827; font-size: 16px;">Hallo ${name},</p>`
}

export function spacer(height: number = 20) {
  return `<div style="height: ${height}px;"></div>`
}

export function button(text: string, url: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 8px 0;">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `
}

export function signature() {
  return `
    <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">
      Freundliche Grüsse<br>
      <span style="color: #111827; font-weight: 500;">Ihr LeadsHub Team</span>
    </p>
  `
}

// Hilfsfunktion: Label formatieren (snake_case → Title Case)
export function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

// ============================================
// FERTIGE E-MAIL FUNKTIONEN
// ============================================

// 1. PAYMENT GATE - "Neuer Lead verfügbar" (Einzelkauf - Daten versteckt)
export function paymentGateEmail(data: {
  brokerName: string
  category: string
  amount: number
  invoiceNumber: string
  stripePaymentLink: string
}) {
  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Ein neuer <strong>${data.category}-Lead</strong> ist für Sie verfügbar. Nach Zahlungseingang erhalten Sie die vollständigen Kontaktdaten.`)}

    ${amountDisplay(data.amount.toFixed(2))}

    <p style="margin: 0 0 20px; color: #6b7280; font-size: 13px; text-align: center;">Rechnung: ${data.invoiceNumber}</p>

    ${spacer(8)}

    ${button('Jetzt bezahlen', data.stripePaymentLink)}
    <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">Sicher bezahlen mit Kreditkarte oder TWINT</p>

    ${spacer(24)}

    ${highlightBox(`<strong>Hinweis:</strong> Die Lead-Daten werden Ihnen nach Zahlungseingang automatisch per E-Mail zugestellt.`, 'info')}

    ${signature()}
  `

  return emailTemplate(content, '📋 Neuer Lead verfügbar')
}

// 2. LEAD FREIGABE - "Ihr Lead ist da!" (mit ALLEN Daten inkl. Extra)
export function leadDeliveryEmail(data: {
  brokerName: string
  category: string
  leadName: string
  leadEmail: string
  leadPhone: string
  leadPlz: string
  leadOrt: string
  extraData?: Record<string, any>
}) {
  // Basis Lead-Daten
  const baseItems = [
    { label: 'Name', value: data.leadName },
    { label: 'E-Mail', value: `<a href="mailto:${data.leadEmail}" style="color: #8b5cf6; text-decoration: none;">${data.leadEmail}</a>` },
    { label: 'Telefon', value: `<a href="tel:${data.leadPhone}" style="color: #8b5cf6; text-decoration: none;">${data.leadPhone}</a>` },
    { label: 'PLZ / Ort', value: `${data.leadPlz} ${data.leadOrt}` }
  ]

  // Extra-Daten aufbereiten (ohne meta_ Felder)
  let extraDataHtml = ''
  if (data.extraData && Object.keys(data.extraData).length > 0) {
    const extraItems = Object.entries(data.extraData)
      .filter(([key]) => !key.startsWith('meta_'))
      .filter(([_, value]) => value && String(value).trim() !== '')
      .map(([key, value]) => ({
        label: formatLabel(key),
        value: String(value)
      }))
    
    if (extraItems.length > 0) {
      extraDataHtml = `
        ${spacer(24)}
        ${sectionTitle('Zusatzangaben')}
        ${infoBox(extraItems)}
      `
    }
  }

  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Vielen Dank für Ihre Zahlung! Hier sind die Kontaktdaten Ihres <strong>${data.category}-Leads</strong>:`)}
    
    ${spacer(8)}
    
    ${sectionTitle('Kontaktdaten')}
    ${infoBox(baseItems)}
    
    ${extraDataHtml}
    
    ${spacer(24)}
    
    ${highlightBox(`<strong>Tipp:</strong> Kontaktieren Sie den Lead möglichst innerhalb von 24 Stunden für die beste Conversion-Rate.`, 'success')}
    
    ${signature()}
  `
  
  return emailTemplate(content, '🎉 Ihr Lead ist da!')
}

// 3. RECHNUNG E-MAIL
export function invoiceEmail(data: {
  brokerName: string
  invoiceNumber: string
  amount: number
  dueDate: string
  type: 'single' | 'subscription' | 'commission'
  iban: string
}) {
  const typeLabels = {
    single: 'Einzelkauf',
    subscription: 'Abo-Gebühr',
    commission: 'Provisionsabrechnung'
  }

  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Anbei erhalten Sie Ihre Rechnung.`)}
    
    ${spacer(8)}
    
    ${infoBox([
      { label: 'Rechnungsnr.', value: data.invoiceNumber },
      { label: 'Typ', value: typeLabels[data.type] },
      { label: 'Datum', value: new Date().toLocaleDateString('de-CH') },
      { label: 'Fällig bis', value: data.dueDate }
    ])}
    
    ${spacer(16)}
    
    ${amountDisplay(data.amount.toFixed(2), 'Rechnungsbetrag')}
    
    ${spacer(16)}
    
    ${sectionTitle('Zahlungsdetails')}
    ${infoBox([
      { label: 'IBAN', value: data.iban },
      { label: 'Empfänger', value: 'LeadsHub GmbH' },
      { label: 'Referenz', value: data.invoiceNumber }
    ])}
    
    ${spacer(8)}
    
    ${highlightBox(`Bitte überweisen Sie den Betrag bis zum ${data.dueDate} unter Angabe der Rechnungsnummer.`, 'info')}
    
    ${signature()}
  `
  
  return emailTemplate(content, `📄 Rechnung ${data.invoiceNumber}`)
}

// 4. FOLLOW-UP ANFRAGE (für Beteiligungsmodell)
export function followupRequestEmail(data: {
  brokerName: string
  leadName: string
  category: string
  assignedDate: string
  feedbackUrl: string
}) {
  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Vor einigen Tagen haben wir Ihnen einen <strong>${data.category}-Lead</strong> zugewiesen. Wie ist der aktuelle Stand?`)}
    
    ${spacer(8)}
    
    ${infoBox([
      { label: 'Lead', value: data.leadName },
      { label: 'Kategorie', value: data.category },
      { label: 'Zugewiesen am', value: data.assignedDate }
    ])}
    
    ${spacer(24)}
    
    ${button('Status melden', data.feedbackUrl)}
    
    ${spacer(24)}
    
    ${highlightBox(`Bitte teilen Sie uns mit, ob der Lead erreicht wurde. Bei erfolgreichem Abschluss berechnen wir Ihre Provision.`, 'info')}
    
    ${signature()}
  `
  
  return emailTemplate(content, '📊 Status-Update benötigt')
}

// 5. ABO/PAKET LIEFERUNG
export function subscriptionDeliveryEmail(data: {
  brokerName: string
  packageName: string
  leadsCount: number
  leads: Array<{
    name: string
    email: string
    phone: string
    plz: string
    ort: string
    extraData?: Record<string, any>
  }>
}) {
  const leadsHtml = data.leads.map((lead, index) => {
    const baseItems = [
      { label: 'Name', value: lead.name },
      { label: 'E-Mail', value: `<a href="mailto:${lead.email}" style="color: #8b5cf6; text-decoration: none;">${lead.email}</a>` },
      { label: 'Telefon', value: `<a href="tel:${lead.phone}" style="color: #8b5cf6; text-decoration: none;">${lead.phone}</a>` },
      { label: 'PLZ / Ort', value: `${lead.plz} ${lead.ort}` }
    ]
    
    // Extra-Daten hinzufügen
    if (lead.extraData) {
      Object.entries(lead.extraData)
        .filter(([key]) => !key.startsWith('meta_'))
        .filter(([_, value]) => value && String(value).trim() !== '')
        .forEach(([key, value]) => {
          baseItems.push({ label: formatLabel(key), value: String(value) })
        })
    }
    
    return `
      ${index > 0 ? spacer(20) : ''}
      ${sectionTitle(`Lead ${index + 1}`)}
      ${infoBox(baseItems)}
    `
  }).join('')

  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Hier sind Ihre heutigen <strong>${data.leadsCount} Leads</strong> aus dem Paket "<strong>${data.packageName}</strong>":`)}
    
    ${spacer(8)}
    
    ${leadsHtml}
    
    ${spacer(24)}
    
    ${highlightBox(`<strong>Tipp:</strong> Kontaktieren Sie neue Leads möglichst schnell für die beste Conversion-Rate.`, 'success')}
    
    ${signature()}
  `
  
  return emailTemplate(content, `📦 ${data.leadsCount} neue Leads`)
}

// 6. BETEILIGUNG - Lead direkt sichtbar (ohne Payment Gate)
export function revenueShareLeadEmail(data: {
  brokerName: string
  category: string
  leadName: string
  leadEmail: string
  leadPhone: string
  leadPlz: string
  leadOrt: string
  revenueSharePercent: number
  extraData?: Record<string, any>
}) {
  // Basis Lead-Daten
  const baseItems = [
    { label: 'Name', value: data.leadName },
    { label: 'E-Mail', value: `<a href="mailto:${data.leadEmail}" style="color: #8b5cf6; text-decoration: none;">${data.leadEmail}</a>` },
    { label: 'Telefon', value: `<a href="tel:${data.leadPhone}" style="color: #8b5cf6; text-decoration: none;">${data.leadPhone}</a>` },
    { label: 'PLZ / Ort', value: `${data.leadPlz} ${data.leadOrt}` }
  ]

  // Extra-Daten
  let extraDataHtml = ''
  if (data.extraData && Object.keys(data.extraData).length > 0) {
    const extraItems = Object.entries(data.extraData)
      .filter(([key]) => !key.startsWith('meta_'))
      .filter(([_, value]) => value && String(value).trim() !== '')
      .map(([key, value]) => ({
        label: formatLabel(key),
        value: String(value)
      }))
    
    if (extraItems.length > 0) {
      extraDataHtml = `
        ${spacer(24)}
        ${sectionTitle('Zusatzangaben')}
        ${infoBox(extraItems)}
      `
    }
  }

  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Ein neuer <strong>${data.category}-Lead</strong> wurde Ihnen zugewiesen. Bei erfolgreichem Abschluss gilt eine Beteiligung von <strong>${data.revenueSharePercent}%</strong>.`)}
    
    ${spacer(8)}
    
    ${sectionTitle('Kontaktdaten')}
    ${infoBox(baseItems)}
    
    ${extraDataHtml}
    
    ${spacer(24)}
    
    ${highlightBox(`<strong>Hinweis:</strong> In einigen Tagen erhalten Sie eine Anfrage zum Status dieses Leads.`, 'info')}
    
    ${signature()}
  `
  
  return emailTemplate(content, '🎯 Neuer Lead (Beteiligung)')
}
