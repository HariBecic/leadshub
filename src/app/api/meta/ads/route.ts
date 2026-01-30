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
      'today': 'today',
      'yesterday': 'yesterday',
      'last_3d': 'last_3d',
      'last_7d': 'last_7d',
      'last_14d': 'last_14d', 
      'last_30d': 'last_30d',
      'this_week_sun_today': 'this_week_sun_today',
      'last_week_sun_sat': 'last_week_sun_sat',
      'this_month': 'this_month',
      'last_month': 'last_month'
    }
    const datePreset = datePresetMap[range] || 'last_7d'

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
      
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${accountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective&access_token=${META_ACCESS_TOKEN}`
      )
      const campaignsData = await campaignsResponse.json()
      const campaigns = campaignsData.data || []

      const campaignsWithInsights = await Promise.all(campaigns.map(async (campaign: any) => {
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,ctr,cpc,reach,actions&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
          )
          const insightsData = await insightsResponse.json()
          return { ...campaign, insights: insightsData.data?.[0] || null }
        } catch (e) {
          return { ...campaign, insights: null }
        }
      }))

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
      } catch (e) {}

      if (includeCreatives) {
        try {
          // Get adcreatives directly with all image fields
          const creativesResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/adcreatives?fields=id,name,thumbnail_url,image_url,object_story_spec,effective_object_story_id&limit=50&access_token=${META_ACCESS_TOKEN}`
          )
          const creativesData = await creativesResponse.json()
          
          // Get ads to match creatives with insights
          const adsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/ads?fields=id,name,creative{id},insights.date_preset(${datePreset}){spend,impressions,clicks}&limit=100&access_token=${META_ACCESS_TOKEN}`
          )
          const adsData = await adsResponse.json()
          
          // Build insights map by creative ID
          const insightsMap: Record<string, any> = {}
          for (const ad of adsData.data || []) {
            if (ad.creative?.id && ad.insights?.data?.[0]) {
              const creativeId = ad.creative.id
              if (!insightsMap[creativeId]) {
                insightsMap[creativeId] = { spend: 0, impressions: 0, clicks: 0, adName: ad.name }
              }
              insightsMap[creativeId].spend += parseFloat(ad.insights.data[0].spend || 0)
              insightsMap[creativeId].impressions += parseInt(ad.insights.data[0].impressions || 0)
              insightsMap[creativeId].clicks += parseInt(ad.insights.data[0].clicks || 0)
            }
          }
          
          for (const creative of creativesData.data || []) {
            let imageUrl = null
            
            // Try to get image from object_story_spec
            if (creative.object_story_spec?.link_data?.picture) {
              imageUrl = creative.object_story_spec.link_data.picture
            } else if (creative.object_story_spec?.link_data?.image_url) {
              imageUrl = creative.object_story_spec.link_data.image_url
            } else if (creative.object_story_spec?.photo_data?.url) {
              imageUrl = creative.object_story_spec.photo_data.url
            } else if (creative.object_story_spec?.video_data?.image_url) {
              imageUrl = creative.object_story_spec.video_data.image_url
            } else if (creative.image_url) {
              imageUrl = creative.image_url
            }
            
            // Get insights for this creative
            const insights = insightsMap[creative.id] || { spend: 0, impressions: 0, clicks: 0 }
            
            allCreatives.push({
              id: creative.id,
              name: insights.adName || creative.name || 'Unnamed Creative',
              image_url: imageUrl,
              thumbnail_url: creative.thumbnail_url,
              spend: insights.spend,
              impressions: insights.impressions,
              clicks: insights.clicks
            })
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
