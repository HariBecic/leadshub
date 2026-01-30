// Einheitliches E-Mail Template mit Glassmorphism Design
// Datei: src/lib/email-template.ts

const LOGO_URL = 'https://leadshub2.vercel.app/logo.png'

export function emailTemplate(content: string, title: string = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Logo -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <img src="${LOGO_URL}" alt="LeadsHub" style="height: 40px; width: auto;" />
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(139, 92, 246, 0.3) 100%); padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${title}</h1>
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
            <td style="padding: 30px 40px; text-align: center;">
              <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 13px;">
                LeadsHub GmbH · Sandäckerstrasse 10 · 8957 Spreitenbach
              </p>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.3); font-size: 12px;">
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
    <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden;">
      ${items.map((item, index) => `
        <tr>
          <td style="padding: 16px 20px; color: rgba(255, 255, 255, 0.6); font-size: 14px; border-bottom: ${index < items.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'}; width: 40%;">
            ${item.label}
          </td>
          <td style="padding: 16px 20px; color: #ffffff; font-size: 14px; font-weight: 500; border-bottom: ${index < items.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'};">
            ${item.value}
          </td>
        </tr>
      `).join('')}
    </table>
  `
}

export function sectionTitle(text: string) {
  return `<p style="margin: 0 0 12px; color: rgba(255, 255, 255, 0.6); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">${text}</p>`
}

export function highlightBox(content: string, type: 'info' | 'warning' | 'success' = 'info') {
  const colors = {
    info: { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.3)', text: '#93c5fd' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.3)', text: '#fcd34d' },
    success: { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.3)', text: '#86efac' }
  }
  const c = colors[type]
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 12px;">
      <tr>
        <td style="padding: 16px 20px; color: ${c.text}; font-size: 14px;">
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
        <td align="center" style="padding: 20px 0;">
          <p style="margin: 0 0 8px; color: rgba(255, 255, 255, 0.6); font-size: 14px;">${label}</p>
          <p style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700;">CHF ${amount}</p>
        </td>
      </tr>
    </table>
  `
}

export function paragraph(text: string) {
  return `<p style="margin: 0 0 20px; color: rgba(255, 255, 255, 0.8); font-size: 15px; line-height: 1.6;">${text}</p>`
}

export function greeting(name: string) {
  return `<p style="margin: 0 0 20px; color: #ffffff; font-size: 16px;">Hallo ${name},</p>`
}

export function spacer(height: number = 20) {
  return `<div style="height: ${height}px;"></div>`
}

export function button(text: string, url: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 10px 0;">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `
}

export function signature() {
  return `
    <p style="margin: 30px 0 0; color: rgba(255, 255, 255, 0.6); font-size: 14px;">
      Freundliche Grüsse<br>
      <span style="color: #ffffff;">Ihr LeadsHub Team</span>
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
  iban: string
}) {
  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Ein neuer <strong>${data.category}-Lead</strong> ist für Sie verfügbar. Nach Zahlungseingang erhalten Sie die vollständigen Kontaktdaten.`)}
    
    ${amountDisplay(data.amount.toFixed(2))}
    ${spacer(10)}
    
    <p style="margin: 0 0 5px; color: rgba(255, 255, 255, 0.6); font-size: 13px; text-align: center;">Rechnung: ${data.invoiceNumber}</p>
    
    ${spacer(20)}
    
    ${highlightBox(`<strong>Hinweis:</strong> Die Lead-Daten werden Ihnen nach Zahlungseingang automatisch per E-Mail zugestellt.`, 'warning')}
    
    ${spacer(20)}
    
    ${infoBox([
      { label: 'IBAN', value: data.iban },
      { label: 'Empfänger', value: 'LeadsHub GmbH' },
      { label: 'Referenz', value: data.invoiceNumber }
    ])}
    
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
    { label: 'E-Mail', value: `<a href="mailto:${data.leadEmail}" style="color: #a855f7; text-decoration: none;">${data.leadEmail}</a>` },
    { label: 'Telefon', value: `<a href="tel:${data.leadPhone}" style="color: #a855f7; text-decoration: none;">${data.leadPhone}</a>` },
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
        ${spacer(25)}
        ${sectionTitle('Zusatzangaben')}
        ${infoBox(extraItems)}
      `
    }
  }

  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Vielen Dank für Ihre Zahlung! Hier sind die Kontaktdaten Ihres <strong>${data.category}-Leads</strong>:`)}
    
    ${spacer(10)}
    
    ${sectionTitle('Kontaktdaten')}
    ${infoBox(baseItems)}
    
    ${extraDataHtml}
    
    ${spacer(25)}
    
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
    
    ${spacer(10)}
    
    ${infoBox([
      { label: 'Rechnungsnr.', value: data.invoiceNumber },
      { label: 'Typ', value: typeLabels[data.type] },
      { label: 'Datum', value: new Date().toLocaleDateString('de-CH') },
      { label: 'Fällig bis', value: data.dueDate }
    ])}
    
    ${spacer(20)}
    
    ${amountDisplay(data.amount.toFixed(2), 'Rechnungsbetrag')}
    
    ${spacer(20)}
    
    ${infoBox([
      { label: 'IBAN', value: data.iban },
      { label: 'Empfänger', value: 'LeadsHub GmbH' },
      { label: 'Referenz', value: data.invoiceNumber }
    ])}
    
    ${spacer(10)}
    
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
    ${paragraph(`Vor 3 Tagen haben wir Ihnen einen <strong>${data.category}-Lead</strong> zugewiesen. Wie ist der aktuelle Stand?`)}
    
    ${spacer(10)}
    
    ${infoBox([
      { label: 'Lead', value: data.leadName },
      { label: 'Kategorie', value: data.category },
      { label: 'Zugewiesen am', value: data.assignedDate }
    ])}
    
    ${spacer(25)}
    
    ${button('Status melden', data.feedbackUrl)}
    
    ${spacer(25)}
    
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
      { label: 'E-Mail', value: `<a href="mailto:${lead.email}" style="color: #a855f7; text-decoration: none;">${lead.email}</a>` },
      { label: 'Telefon', value: `<a href="tel:${lead.phone}" style="color: #a855f7; text-decoration: none;">${lead.phone}</a>` },
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
    
    ${spacer(10)}
    
    ${leadsHtml}
    
    ${spacer(25)}
    
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
    { label: 'E-Mail', value: `<a href="mailto:${data.leadEmail}" style="color: #a855f7; text-decoration: none;">${data.leadEmail}</a>` },
    { label: 'Telefon', value: `<a href="tel:${data.leadPhone}" style="color: #a855f7; text-decoration: none;">${data.leadPhone}</a>` },
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
        ${spacer(25)}
        ${sectionTitle('Zusatzangaben')}
        ${infoBox(extraItems)}
      `
    }
  }

  const content = `
    ${greeting(data.brokerName)}
    ${paragraph(`Ein neuer <strong>${data.category}-Lead</strong> wurde Ihnen zugewiesen. Bei erfolgreichem Abschluss gilt eine Beteiligung von <strong>${data.revenueSharePercent}%</strong>.`)}
    
    ${spacer(10)}
    
    ${sectionTitle('Kontaktdaten')}
    ${infoBox(baseItems)}
    
    ${extraDataHtml}
    
    ${spacer(25)}
    
    ${highlightBox(`<strong>Hinweis:</strong> In 3 Tagen erhalten Sie eine Anfrage zum Status dieses Leads.`, 'info')}
    
    ${signature()}
  `
  
  return emailTemplate(content, '🎯 Neuer Lead (Beteiligung)')
}
