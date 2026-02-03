import { Resend } from 'resend'
import { followupRequestEmail } from './email-template'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendFollowupEmail(
  broker: { name: string; email: string },
  lead: { first_name: string; last_name: string },
  assignment: { id: string; broker_id: string },
  baseUrl: string,
  category?: string,
  assignedDate?: string
) {
  // Generate simple token
  const token = Buffer.from(assignment.id + assignment.broker_id).toString('base64').slice(0, 20)
  const feedbackUrl = `${baseUrl}/followup/${assignment.id}?token=${token}`

  const html = followupRequestEmail({
    brokerName: broker.name,
    leadName: `${lead.first_name} ${lead.last_name}`,
    category: category || 'Lead',
    assignedDate: assignedDate || new Date().toLocaleDateString('de-CH'),
    feedbackUrl: feedbackUrl
  })

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'LeadsHub <noreply@leadshub.ch>',
    to: broker.email,
    subject: `📊 Lead Status: ${lead.first_name} ${lead.last_name}`,
    html
  })

  return { data, error }
}
