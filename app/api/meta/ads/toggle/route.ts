import { NextRequest, NextResponse } from 'next/server'

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || ''

export async function POST(request: NextRequest) {
  try {
    const { campaign_id, status } = await request.json()

    if (!campaign_id || !status) {
      return NextResponse.json({ error: 'campaign_id und status erforderlich' }, { status: 400 })
    }

    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return NextResponse.json({ error: 'Status muss ACTIVE oder PAUSED sein' }, { status: 400 })
    }

    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN nicht konfiguriert' }, { status: 500 })
    }

    // Update campaign status
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${campaign_id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: status,
          access_token: META_ACCESS_TOKEN
        })
      }
    )

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ error: 'Meta API Fehler', details: data.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      campaign_id,
      new_status: status 
    })

  } catch (err: any) {
    console.error('Toggle campaign error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
