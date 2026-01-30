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

      // Get ad creatives with FULL SIZE images
      if (includeCreatives) {
        try {
          // First get ads with their creative IDs
          const adsResponse = await fetch(
            `https://graph.facebook.com/v18.0/act_${accountId}/ads?fields=id,name,creative{id,name,thumbnail_url,object_story_spec,image_url,asset_feed_spec}&limit=50&access_token=${META_ACCESS_TOKEN}`
          )
          const adsData = await adsResponse.json()
          
          if (adsData.data) {
            for (const ad of adsData.data) {
              let imageUrl = null
              
              // Try to get full size image from creative
              if (ad.creative?.id) {
                try {
                  // Fetch creative with image_hash to get full resolution
                  const creativeResponse = await fetch(
                    `https://graph.facebook.com/v18.0/${ad.creative.id}?fields=name,thumbnail_url,image_url,image_hash,object_story_spec,asset_feed_spec&access_token=${META_ACCESS_TOKEN}`
                  )
                  const creativeData = await creativeResponse.json()
                  
                  // Try different sources for high-res image
                  if (creativeData.object_story_spec?.link_data?.image_hash) {
                    // Get image from hash
                    const imageHash = creativeData.object_story_spec.link_data.image_hash
                    const imageResponse = await fetch(
                      `https://graph.facebook.com/v18.0/act_${accountId}/adimages?hashes=['${imageHash}']&fields=url_128,url,permalink_url&access_token=${META_ACCESS_TOKEN}`
                    )
                    const imageData = await imageResponse.json()
                    if (imageData.data?.[imageHash]) {
                      imageUrl = imageData.data[imageHash].permalink_url || imageData.data[imageHash].url
                    }
                  }
                  
                  // Fallback to object_story_spec picture
                  if (!imageUrl && creativeData.object_story_spec?.link_data?.picture) {
                    imageUrl = creativeData.object_story_spec.link_data.picture
                  }
                  
                  // Fallback to image_url
                  if (!imageUrl && creativeData.image_url) {
                    imageUrl = creativeData.image_url
                  }
                  
                  // Last resort: thumbnail but request larger size
                  if (!imageUrl && creativeData.thumbnail_url) {
                    // Replace thumbnail size with larger version
                    imageUrl = creativeData.thumbnail_url.replace(/\/\d+x\d+\//, '/800x800/')
                  }
                } catch (e) {
                  console.error('Error fetching creative details:', e)
                }
              }
              
              // Final fallback to ad thumbnail
              if (!imageUrl && ad.creative?.thumbnail_url) {
                imageUrl = ad.creative.thumbnail_url
              }

              // Get insights for this ad
              let adInsights = { spend: 0, impressions: 0, clicks: 0 }
              try {
                const adInsightsResponse = await fetch(
                  `https://graph.facebook.com/v18.0/${ad.id}/insights?fields=spend,impressions,clicks&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
                )
                const adInsightsData = await adInsightsResponse.json()
                if (adInsightsData.data?.[0]) {
                  adInsights = {
                    spend: parseFloat(adInsightsData.data[0].spend || 0),
                    impressions: parseInt(adInsightsData.data[0].impressions || 0),
                    clicks: parseInt(adInsightsData.data[0].clicks || 0)
                  }
                }
              } catch (e) {
                // Ignore insights error
              }
              
              allCreatives.push({
                id: ad.creative?.id || ad.id,
                name: ad.name || ad.creative?.name || 'Unnamed Creative',
                image_url: imageUrl,
                thumbnail_url: ad.creative?.thumbnail_url,
                ...adInsights
              })
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
