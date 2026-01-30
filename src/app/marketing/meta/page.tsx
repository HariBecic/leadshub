'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, RefreshCw, ChevronDown } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  objective: string
  insights?: {
    spend: string
    impressions: string
    clicks: string
    cpc: string
    ctr: string
    reach: string
    actions?: any[]
  }
}

interface AdAccount {
  id: string
  name: string
  currency: string
  campaigns: Campaign[]
}

interface Totals {
  spend: number
  impressions: number
  clicks: number
  reach: number
  leads: number
}

export default function MetaAdsPage() {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'adsets' | 'ads'>('campaigns')
  const [dateRange, setDateRange] = useState('last_7d')
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [totals, setTotals] = useState<Totals>({ spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 })

  useEffect(() => {
    loadData()
  }, [dateRange])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/meta/ads?range=${dateRange}&detailed=true`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAdAccounts(data.accounts || [])
        
        // Calculate totals
        let t = { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 }
        for (const account of data.accounts || []) {
          for (const campaign of account.campaigns || []) {
            if (campaign.insights) {
              t.spend += parseFloat(campaign.insights.spend || '0')
              t.impressions += parseInt(campaign.insights.impressions || '0')
              t.clicks += parseInt(campaign.insights.clicks || '0')
              t.reach += parseInt(campaign.insights.reach || '0')
              // Count lead actions
              const leadAction = campaign.insights.actions?.find((a: any) => a.action_type === 'lead')
              t.leads += parseInt(leadAction?.value || '0')
            }
          }
        }
        setTotals(t)
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten')
    }
    setLoading(false)
  }

  async function toggleCampaignStatus(campaignId: string, currentStatus: string) {
    setToggling(campaignId)
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    
    try {
      const res = await fetch('/api/meta/ads/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, status: newStatus })
      })
      const data = await res.json()
      if (data.success) {
        loadData()
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannt'))
      }
    } catch (err) {
      alert('Netzwerkfehler')
    }
    setToggling(null)
  }

  function formatCurrency(amount: number | string, currency = 'CHF') {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency }).format(num)
  }

  function formatNumber(num: number | string) {
    const n = typeof num === 'string' ? parseInt(num) : num
    return new Intl.NumberFormat('de-CH').format(n)
  }

  function formatBudget(campaign: Campaign, currency: string) {
    if (campaign.daily_budget) {
      return formatCurrency(parseFloat(campaign.daily_budget) / 100, currency) + ' /Tag'
    }
    if (campaign.lifetime_budget) {
      return formatCurrency(parseFloat(campaign.lifetime_budget) / 100, currency) + ' total'
    }
    return '-'
  }

  function getLeadCount(campaign: Campaign) {
    const leadAction = campaign.insights?.actions?.find((a: any) => 
      a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
    )
    return leadAction?.value || '0'
  }

  const allCampaigns = adAccounts.flatMap(a => a.campaigns.map(c => ({ ...c, currency: a.currency })))

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/marketing" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="https://cdn.brandfetch.io/meta.com/w/512/h/512/icon"
              alt="Meta"
              style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', padding: '5px' }}
            />
            <div>
              <h1 style={{ fontSize: '22px' }}>Meta Ads</h1>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="input"
            style={{ width: 'auto', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none' }}
          >
            <option value="last_7d">Letzte 7 Tage</option>
            <option value="last_14d">Letzte 14 Tage</option>
            <option value="last_30d">Letzte 30 Tage</option>
            <option value="this_month">Dieser Monat</option>
          </select>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading} style={{ padding: '8px 12px' }}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <ExternalLink size={16} />
            Ads Manager
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0', 
        marginBottom: '20px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '4px',
        width: 'fit-content'
      }}>
        <button 
          onClick={() => setActiveTab('campaigns')}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'campaigns' ? 'rgba(139, 92, 246, 0.8)' : 'transparent',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'campaigns' ? '600' : '400'
          }}
        >
          Campaigns
        </button>
        <button 
          onClick={() => setActiveTab('adsets')}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'adsets' ? 'rgba(139, 92, 246, 0.8)' : 'transparent',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'adsets' ? '600' : '400',
            opacity: 0.5
          }}
          disabled
        >
          Ad Sets
        </button>
        <button 
          onClick={() => setActiveTab('ads')}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'ads' ? 'rgba(139, 92, 246, 0.8)' : 'transparent',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'ads' ? '600' : '400',
            opacity: 0.5
          }}
          disabled
        >
          Ads
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.6)' }}>Lade Kampagnen...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#fca5a5' }}>
          <p>❌ {error}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ margin: 0 }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '14px 16px', textAlign: 'left', width: '50px' }}>
                    <input type="checkbox" style={{ width: '18px', height: '18px' }} />
                  </th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: '70px' }}>On/Off</th>
                  <th style={{ padding: '14px 16px', textAlign: 'left' }}>Campaign Name</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: '100px' }}>Delivery</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', width: '120px' }}>Budget</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', width: '120px' }}>Ausgaben</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', width: '100px' }}>Impressionen</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', width: '80px' }}>Klicks</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right', width: '80px' }}>Leads</th>
                </tr>
              </thead>
              <tbody>
                {allCampaigns.map((campaign: any) => (
                  <tr 
                    key={campaign.id}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedCampaigns.includes(campaign.id)}
                        onChange={() => {
                          setSelectedCampaigns(prev => 
                            prev.includes(campaign.id) 
                              ? prev.filter(id => id !== campaign.id)
                              : [...prev, campaign.id]
                          )
                        }}
                        style={{ width: '18px', height: '18px' }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleCampaignStatus(campaign.id, campaign.effective_status)}
                        disabled={toggling === campaign.id}
                        style={{
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          border: 'none',
                          background: campaign.effective_status === 'ACTIVE' 
                            ? 'linear-gradient(135deg, #3B82F6, #2563EB)' 
                            : 'rgba(255,255,255,0.2)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.3s'
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          top: '3px',
                          left: campaign.effective_status === 'ACTIVE' ? '23px' : '3px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'white',
                          transition: 'left 0.3s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500', color: '#60A5FA' }}>{campaign.name}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                        {campaign.objective.replace('OUTCOME_', '')}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        color: campaign.effective_status === 'ACTIVE' ? '#22C55E' : 'rgba(255,255,255,0.5)'
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: campaign.effective_status === 'ACTIVE' ? '#22C55E' : 'rgba(255,255,255,0.3)'
                        }} />
                        {campaign.effective_status === 'ACTIVE' ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px' }}>
                      {formatBudget(campaign, campaign.currency)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>
                      {campaign.insights ? formatCurrency(campaign.insights.spend, campaign.currency) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                      {campaign.insights ? formatNumber(campaign.insights.impressions) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                      {campaign.insights ? formatNumber(campaign.insights.clicks) : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{
                        background: 'rgba(139, 92, 246, 0.3)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        {getLeadCount(campaign)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals Row */}
              <tfoot>
                <tr style={{ background: 'rgba(255,255,255,0.05)', fontWeight: '600' }}>
                  <td colSpan={5} style={{ padding: '14px 16px' }}>Totals</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(totals.spend)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatNumber(totals.impressions)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatNumber(totals.clicks)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span style={{
                      background: 'rgba(139, 92, 246, 0.3)',
                      padding: '4px 10px',
                      borderRadius: '6px'
                    }}>
                      {totals.leads}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
