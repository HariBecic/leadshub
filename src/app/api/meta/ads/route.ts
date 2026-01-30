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
    const includeCreatives = searchParams.get('creatives') === 'true'
    
    const datePresetMap: Record<string, string> = {
      'last_7d': 'last_7d',
      'last_14d': 'last_14d', 
      'last_30d': 'last_30d',
      'this_month': 'this_month'
    }
    const datePreset = datePresetMap[range] || 'last_7d'

    // Get all ad accounts
    let accounts: any[] = []
    
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${BUSINESS_ID}/owned_ad_accounts?fields=id,name,currency,account_status&access_token=${META_ACCESS_TOKEN}`
    )
    const accountsData = await accountsResponse.json()

    if (accountsData.error) {
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
    let dailyInsights: any[] = []
    let allCreatives: any[] = []

    for (const account of accounts) {
      const accountId = account.id.replace('act_', '')
      
      // Get campaigns with insights
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective&access_token=${META_ACCESS_TOKEN}`
      )
      const campaignsData = await campaignsResponse.json()
      const campaigns = campaignsData.data || []

      // Get insights for each campaign
      const campaignsWithInsights = await Promise.all(campaigns.map(async (campaign: any) => {
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,ctr,cpc,reach,actions&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
          )
          const insightsData = await insightsResponse.json()
          
          return {
            ...campaign,
            insights: insightsData.data?.[0] || null
          }
        } catch (e) {
          return { ...campaign, insights: null }
        }
      }))

      // Get daily insights for account
      try {
        const dailyResponse = await fetch(
          `https://graph.facebook.com/v18.0/act_${accountId}/insights?fields=spend,impressions,clicks&date_preset=${datePreset}&time_increment=1&access_token=${META_ACCESS_TOKEN}`
        )
        const dailyData = await dailyResponse.json()
        if (dailyData.data) {
          dailyInsights = dailyData.data.map((d: any) => ({
            date: d.date_start,
            spend: parseFloat(d.spend || 0),
            impressions: parseInt(d.impressions || 0),
            clicks: parseInt(d.clicks || 0)
          }))
        }
      } catch (e) {
        console.error('Error fetching daily insights:', e)
      }

      // Get ad creatives if requested
      if (includeCreatives) {
        try {
          const adsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/ads?fields=id,name,creative{id,name,thumbnail_url,image_url,object_story_spec}&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}&limit=50`
          )
          const adsData = await adsResponse.json()
          
          if (adsData.data) {
            for (const ad of adsData.data) {
              if (ad.creative) {
                // Get insights for this ad
                try {
                  const adInsightsResponse = await fetch(
                    `https://graph.facebook.com/v18.0/${ad.id}/insights?fields=spend,impressions,clicks&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
                  )
                  const adInsightsData = await adInsightsResponse.json()
                  const adInsights = adInsightsData.data?.[0] || {}
                  
                  allCreatives.push({
                    id: ad.creative.id,
                    name: ad.name || ad.creative.name || 'Unnamed Creative',
                    thumbnail_url: ad.creative.thumbnail_url,
                    image_url: ad.creative.image_url,
                    object_story_spec: ad.creative.object_story_spec,
                    spend: parseFloat(adInsights.spend || 0),
                    impressions: parseInt(adInsights.impressions || 0),
                    clicks: parseInt(adInsights.clicks || 0)
                  })
                } catch (e) {
                  allCreatives.push({
                    id: ad.creative.id,
                    name: ad.name || ad.creative.name || 'Unnamed Creative',
                    thumbnail_url: ad.creative.thumbnail_url,
                    image_url: ad.creative.image_url,
                    spend: 0,
                    impressions: 0,
                    clicks: 0
                  })
                }
              }
            }
          }
        } catch (e) {
          console.error('Error fetching creatives:', e)
        }
      }

      result.push({
        id: account.id,
        name: account.name || `Account ${accountId}`,
        currency: account.currency || 'CHF',
        campaigns: campaignsWithInsights
      })
    }

    // Sort creatives by spend
    allCreatives.sort((a, b) => b.spend - a.spend)

    return NextResponse.json({ 
      accounts: result,
      dailyInsights,
      creatives: allCreatives
    })

  } catch (err: any) {
    console.error('Meta Ads API error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
