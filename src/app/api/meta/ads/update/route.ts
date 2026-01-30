import { NextRequest, NextResponse } from 'next/server'

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || ''

export async function POST(request: NextRequest) {
  try {
    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN nicht konfiguriert' }, { status: 500 })
    }

    const body = await request.json()
    const { campaign_id, field, value } = body

    if (!campaign_id || !field || value === undefined) {
      return NextResponse.json({ error: 'campaign_id, field und value erforderlich' }, { status: 400 })
    }

    let updateData: any = {}

    if (field === 'name') {
      updateData.name = value
    } else if (field === 'budget') {
      // Convert to cents
      const budgetInCents = Math.round(parseFloat(value) * 100)
      updateData.daily_budget = budgetInCents.toString()
    } else {
      return NextResponse.json({ error: 'Ungültiges Feld' }, { status: 400 })
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${campaign_id}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...updateData,
          access_token: META_ACCESS_TOKEN
        })
      }
    )

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Meta Ads Update error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
