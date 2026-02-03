import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendLeadEmail(
  broker: { name: string; email: string },
  lead: { first_name: string; last_name: string; email: string; phone: string; plz: string; ort: string; extra_data?: Record<string, unknown> },
  category?: string
) {
  const extraHtml = lead.extra_data
    ? Object.entries(lead.extra_data)
        .filter(([k, v]) => v && !['first_name', 'last_name', 'email', 'phone', 'plz', 'ort', 'category'].includes(k))
        .map(([k, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">${k.replace(/_/g, ' ')}</td><td style="padding:8px;border-bottom:1px solid #eee;">${typeof v === 'object' ? JSON.stringify(v) : v}</td></tr>`)
        .join('')
    : ''

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#2563eb;color:white;padding:20px;text-align:center;"><h1 style="margin:0;">Neuer Lead</h1></div>
    <div style="padding:20px;background:#f8fafc;">
      <p>Hallo ${broker.name},</p>
      <p>Du hast einen neuen Lead erhalten${category ? ' (' + category + ')' : ''}:</p>
      <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:12px;font-weight:bold;background:#f1f5f9;">Name</td><td style="padding:12px;background:#f1f5f9;font-weight:bold;">${lead.first_name} ${lead.last_name}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">E-Mail</td><td style="padding:8px;border-bottom:1px solid #eee;">${lead.email || '-'}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Telefon</td><td style="padding:8px;border-bottom:1px solid #eee;">${lead.phone || '-'}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Ort</td><td style="padding:8px;border-bottom:1px solid #eee;">${lead.plz || ''} ${lead.ort || ''}</td></tr>
        ${extraHtml}
      </table>
      <p style="color:#666;font-size:14px;">Bitte kontaktiere den Lead so schnell wie moeglich.</p>
      <p>Freundliche Gruesse<br>LeadsHub</p>
    </div>
  </div>`

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
    to: broker.email,
    subject: 'Neuer Lead: ' + lead.first_name + ' ' + lead.last_name,
    html
  })

  return { data, error }
}
