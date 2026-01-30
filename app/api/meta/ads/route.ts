import { NextResponse } from 'next/server'

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || ''
const BUSINESS_ID = process.env.META_BUSINESS_ID || '1506294637305314'

export async function GET() {
  try {
    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN nicht konfiguriert' }, { status: 500 })
    }

    // Get all ad accounts from business
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${BUSINESS_ID}/owned_ad_accounts?fields=id,name,currency,account_status&access_token=${META_ACCESS_TOKEN}`
    )
    const accountsData = await accountsResponse.json()

    if (accountsData.error) {
      // Try with direct ad account ID
      const directAccountId = process.env.META_AD_ACCOUNT_ID || '791146183932969'
      const directResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${directAccountId}?fields=id,name,currency,account_status&access_token=${META_ACCESS_TOKEN}`
      )
      const directData = await directResponse.json()
      
      if (directData.error) {
        return NextResponse.json({ error: 'Meta API Fehler', details: directData.error }, { status: 400 })
      }
      
      accountsData.data = [directData]
    }

    const accounts = accountsData.data || []
    const result = []

    for (const account of accounts) {
      const accountId = account.id.replace('act_', '')
      
      // Get campaigns for this account
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective&access_token=${META_ACCESS_TOKEN}`
      )
      const campaignsData = await campaignsResponse.json()

      const campaigns = []
      
      for (const campaign of (campaignsData.data || [])) {
        // Get insights for last 30 days
        let insights = null
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,cpc,ctr&date_preset=last_30d&access_token=${META_ACCESS_TOKEN}`
          )
          const insightsData = await insightsResponse.json()
          if (insightsData.data && insightsData.data[0]) {
            insights = insightsData.data[0]
          }
        } catch (e) {
          // Insights might not be available
        }

        campaigns.push({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          effective_status: campaign.effective_status,
          daily_budget: campaign.daily_budget,
          lifetime_budget: campaign.lifetime_budget,
          objective: campaign.objective,
          insights
        })
      }

      result.push({
        id: account.id,
        name: account.name || `Account ${accountId}`,
        currency: account.currency || 'CHF',
        campaigns
      })
    }

    return NextResponse.json({ accounts: result })

  } catch (err: any) {
    console.error('Meta Ads API error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
