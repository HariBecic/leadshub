import { NextRequest, NextResponse } from 'next/server'

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || ''
const BUSINESS_ID = process.env.META_BUSINESS_ID || '1506294637305314'

export async function GET(request: NextRequest) {
  try {
    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN nicht konfiguriert' }, { status: 500 })
    }

    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'last_7d'
    const campaignFilter = searchParams.get('campaigns')?.split(',').filter(Boolean) || []
    
    // Map range to Meta date_preset
    const datePresetMap: Record<string, string> = {
      'last_7d': 'last_7d',
      'last_14d': 'last_14d', 
      'last_30d': 'last_30d',
      'this_month': 'this_month'
    }
    const datePreset = datePresetMap[range] || 'last_7d'

    // Get all ad accounts from business
    let accounts: any[] = []
    
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
      
      accounts = [directData]
    } else {
      accounts = accountsData.data || []
    }

    const result = []
    let totalInsights = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      reach: 0
    }
    let dailyInsights: any[] = []
    let dailyMap: Record<string, any> = {}

    for (const account of accounts) {
      const accountId = account.id.replace('act_', '')
      
      // Get campaigns
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective&access_token=${META_ACCESS_TOKEN}`
      )
      const campaignsData = await campaignsResponse.json()
      const allCampaigns = campaignsData.data || []

      // Filter campaigns if specified
      const campaignsToAnalyze = campaignFilter.length > 0
        ? allCampaigns.filter((c: any) => campaignFilter.includes(c.id))
        : allCampaigns

      // Get insights for each campaign (or all if no filter)
      if (campaignFilter.length > 0) {
        // Get insights per selected campaign
        for (const campaign of campaignsToAnalyze) {
          try {
            const insightsResponse = await fetch(
              `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,ctr,cpc,reach&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
            )
            const insightsData = await insightsResponse.json()
            
            if (insightsData.data && insightsData.data[0]) {
              const ins = insightsData.data[0]
              totalInsights.spend += parseFloat(ins.spend || 0)
              totalInsights.impressions += parseInt(ins.impressions || 0)
              totalInsights.clicks += parseInt(ins.clicks || 0)
              totalInsights.reach += parseInt(ins.reach || 0)
            }

            // Daily insights per campaign
            const dailyResponse = await fetch(
              `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,ctr&date_preset=${datePreset}&time_increment=1&access_token=${META_ACCESS_TOKEN}`
            )
            const dailyData = await dailyResponse.json()
            
            if (dailyData.data) {
              for (const d of dailyData.data) {
                const date = d.date_start
                if (!dailyMap[date]) {
                  dailyMap[date] = { date, spend: 0, impressions: 0, clicks: 0, ctr: 0 }
                }
                dailyMap[date].spend += parseFloat(d.spend || 0)
                dailyMap[date].impressions += parseInt(d.impressions || 0)
                dailyMap[date].clicks += parseInt(d.clicks || 0)
              }
            }
          } catch (e) {
            console.error('Error fetching campaign insights:', e)
          }
        }
      } else {
        // Get account-level insights (all campaigns)
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/insights?fields=spend,impressions,clicks,ctr,cpc,reach&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
          )
          const insightsData = await insightsResponse.json()
          
          if (insightsData.data && insightsData.data[0]) {
            const ins = insightsData.data[0]
            totalInsights.spend += parseFloat(ins.spend || 0)
            totalInsights.impressions += parseInt(ins.impressions || 0)
            totalInsights.clicks += parseInt(ins.clicks || 0)
            totalInsights.reach += parseInt(ins.reach || 0)
          }
        } catch (e) {
          console.error('Error fetching account insights:', e)
        }

        // Get daily insights for account
        try {
          const dailyResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/insights?fields=spend,impressions,clicks,ctr&date_preset=${datePreset}&time_increment=1&access_token=${META_ACCESS_TOKEN}`
          )
          const dailyData = await dailyResponse.json()
          
          if (dailyData.data) {
            for (const d of dailyData.data) {
              const date = d.date_start
              if (!dailyMap[date]) {
                dailyMap[date] = { date, spend: 0, impressions: 0, clicks: 0, ctr: 0 }
              }
              dailyMap[date].spend += parseFloat(d.spend || 0)
              dailyMap[date].impressions += parseInt(d.impressions || 0)
              dailyMap[date].clicks += parseInt(d.clicks || 0)
            }
          }
        } catch (e) {
          console.error('Error fetching daily insights:', e)
        }
      }

      result.push({
        id: account.id,
        name: account.name || `Account ${accountId}`,
        currency: account.currency || 'CHF',
        campaigns: allCampaigns
      })
    }

    // Convert daily map to sorted array
    dailyInsights = Object.values(dailyMap).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Recalculate CTR for daily insights
    dailyInsights = dailyInsights.map((d: any) => ({
      ...d,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
    }))

    // Calculate averages
    if (totalInsights.clicks > 0 && totalInsights.impressions > 0) {
      totalInsights.ctr = (totalInsights.clicks / totalInsights.impressions) * 100
    }
    if (totalInsights.clicks > 0 && totalInsights.spend > 0) {
      totalInsights.cpc = totalInsights.spend / totalInsights.clicks
    }

    return NextResponse.json({ 
      accounts: result,
      insights: totalInsights,
      dailyInsights: dailyInsights
    })

  } catch (err: any) {
    console.error('Meta Ads API error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
