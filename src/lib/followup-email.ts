import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendFollowupEmail(
  broker: { name: string; email: string },
  lead: { first_name: string; last_name: string },
  assignment: { id: string; broker_id: string },
  baseUrl: string
) {
  // Generate simple token
  const token = Buffer.from(assignment.id + assignment.broker_id).toString('base64').slice(0, 20)
  const feedbackUrl = `${baseUrl}/followup/${assignment.id}?token=${token}`

  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#F26444 0%,#D94E30 100%);color:white;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
      <h1 style="margin:0;font-size:24px;">Lead Status Update</h1>
    </div>
    <div style="padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
      <p style="font-size:16px;color:#1e293b;">Hallo ${broker.name},</p>
      <p style="color:#64748b;line-height:1.6;">
        Vor einigen Tagen hast du folgenden Lead erhalten:
      </p>
      
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:24px 0;">
        <div style="font-size:18px;font-weight:600;color:#1e293b;margin-bottom:4px;">
          ${lead.first_name} ${lead.last_name}
        </div>
        <div style="color:#64748b;font-size:14px;">Lead-Zuweisung</div>
      </div>
      
      <p style="color:#64748b;line-height:1.6;">
        Bitte teile uns mit, wie der Stand ist. Klicke auf den Button um dein Feedback zu geben:
      </p>
      
      <div style="text-align:center;margin:32px 0;">
        <a href="${feedbackUrl}" style="display:inline-block;background:#3A29A6;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">
          Feedback geben
        </a>
      </div>
      
      <p style="color:#94a3b8;font-size:13px;text-align:center;">
        Oder kopiere diesen Link: ${feedbackUrl}
      </p>
      
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
      
      <p style="color:#64748b;font-size:14px;margin:0;">
        Freundliche Grüsse<br>
        <strong style="color:#1e293b;">LeadsHub</strong>
      </p>
    </div>
  </div>`

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'LeadsHub <onboarding@resend.dev>',
    to: broker.email,
    subject: `Lead Status: ${lead.first_name} ${lead.last_name}`,
    html
  })

  return { data, error }
}
