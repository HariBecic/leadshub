'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, RefreshCw, TrendingUp, Image, LayoutGrid, Pencil, Check, X } from 'lucide-react'

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
  ctr: number
  cpc: number
}

interface DailyInsight {
  date: string
  spend: number
  impressions: number
  clicks: number
}

interface EditingState {
  campaignId: string
  field: 'name' | 'budget'
  value: string
}

export default function MetaAdsPage() {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'performance' | 'creative' | 'assets'>('performance')
  const [dateRange, setDateRange] = useState('last_7d')
  const [totals, setTotals] = useState<Totals>({ spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, ctr: 0, cpc: 0 })
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([])
  const [creatives, setCreatives] = useState<any[]>([])
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [dateRange])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/meta/ads?range=${dateRange}&detailed=true&creatives=true`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAdAccounts(data.accounts || [])
        setDailyInsights(data.dailyInsights || [])
        setCreatives(data.creatives || [])
        
        let t = { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, ctr: 0, cpc: 0 }
        for (const account of data.accounts || []) {
          for (const campaign of account.campaigns || []) {
            if (campaign.insights) {
              t.spend += parseFloat(campaign.insights.spend || '0')
              t.impressions += parseInt(campaign.insights.impressions || '0')
              t.clicks += parseInt(campaign.insights.clicks || '0')
              t.reach += parseInt(campaign.insights.reach || '0')
              const leadAction = campaign.insights.actions?.find((a: any) => a.action_type === 'lead')
              t.leads += parseInt(leadAction?.value || '0')
            }
          }
        }
        if (t.impressions > 0) t.ctr = (t.clicks / t.impressions) * 100
        if (t.clicks > 0) t.cpc = t.spend / t.clicks
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

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    
    try {
      const res = await fetch('/api/meta/ads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: editing.campaignId,
          field: editing.field,
          value: editing.value
        })
      })
      const data = await res.json()
      if (data.success) {
        setEditing(null)
        loadData()
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannt'))
      }
    } catch (err) {
      alert('Netzwerkfehler')
    }
    setSaving(false)
  }

  function startEdit(campaignId: string, field: 'name' | 'budget', currentValue: string) {
    setEditing({ campaignId, field, value: currentValue })
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

  function getBudgetValue(campaign: Campaign) {
    if (campaign.daily_budget) return (parseFloat(campaign.daily_budget) / 100).toString()
    if (campaign.lifetime_budget) return (parseFloat(campaign.lifetime_budget) / 100).toString()
    return ''
  }

  function getLeadCount(campaign: Campaign) {
    const leadAction = campaign.insights?.actions?.find((a: any) => 
      a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
    )
    return leadAction?.value || '0'
  }

  function renderChart() {
    if (dailyInsights.length === 0) return null
    const width = 800, height = 180, padding = 40
    const maxSpend = Math.max(...dailyInsights.map(d => d.spend), 1)
    const maxClicks = Math.max(...dailyInsights.map(d => d.clicks), 1)
    const xStep = (width - padding * 2) / (dailyInsights.length - 1 || 1)
    
    const spendPoints = dailyInsights.map((d, i) => `${padding + i * xStep},${height - padding - (d.spend / maxSpend) * (height - padding * 2)}`).join(' ')
    const clicksPoints = dailyInsights.map((d, i) => `${padding + i * xStep},${height - padding - (d.clicks / maxClicks) * (height - padding * 2)}`).join(' ')

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0,1,2,3,4].map(i => <line key={i} x1={padding} y1={padding + i*(height-padding*2)/4} x2={width-padding} y2={padding + i*(height-padding*2)/4} stroke="rgba(255,255,255,0.1)" />)}
        <polyline fill="none" stroke="#8B5CF6" strokeWidth="3" points={spendPoints} />
        <polyline fill="none" stroke="#22C55E" strokeWidth="3" points={clicksPoints} />
        {dailyInsights.map((d, i) => {
          const x = padding + i * xStep
          return (
            <g key={i}>
              <circle cx={x} cy={height - padding - (d.spend / maxSpend) * (height - padding * 2)} r="4" fill="#8B5CF6" />
              <circle cx={x} cy={height - padding - (d.clicks / maxClicks) * (height - padding * 2)} r="4" fill="#22C55E" />
              <text x={x} y={height - 10} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">{new Date(d.date).getDate()}.{new Date(d.date).getMonth()+1}</text>
            </g>
          )
        })}
      </svg>
    )
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
            <img src="https://cdn.brandfetch.io/meta.com/w/512/h/512/icon" alt="Meta" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', padding: '5px' }} />
            <h1 style={{ fontSize: '22px' }}>Meta Ads</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="input" style={{ width: 'auto', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none' }}>
            <option value="today">Heute</option>
            <option value="yesterday">Gestern</option>
            <option value="last_3d">Letzte 3 Tage</option>
            <option value="last_7d">Letzte 7 Tage</option>
            <option value="last_14d">Letzte 14 Tage</option>
            <option value="last_30d">Letzte 30 Tage</option>
            <option value="this_week_sun_today">Diese Woche</option>
            <option value="last_week_sun_sat">Letzte Woche</option>
            <option value="this_month">Dieser Monat</option>
            <option value="last_month">Letzter Monat</option>
          </select>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading} style={{ padding: '8px 12px' }}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <ExternalLink size={16} /> Ads Manager
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('performance')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'performance' ? 'rgba(139, 92, 246, 0.8)' : 'transparent', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'performance' ? '600' : '400', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={16} /> Performance
        </button>
        <button onClick={() => setActiveTab('creative')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'creative' ? 'rgba(139, 92, 246, 0.8)' : 'transparent', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'creative' ? '600' : '400', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Image size={16} /> Creatives
        </button>
        <button onClick={() => setActiveTab('assets')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: activeTab === 'assets' ? 'rgba(139, 92, 246, 0.8)' : 'transparent', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'assets' ? '600' : '400', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutGrid size={16} /> Assets
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.6)' }}>Lade Daten...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#fca5a5' }}>
          <p>❌ {error}</p>
        </div>
      ) : (
        <>
          {/* PERFORMANCE TAB */}
          {activeTab === 'performance' && (
            <>
              {/* Analytics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', padding: '16px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>Ausgaben</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatCurrency(totals.spend)}</div>
                </div>
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>Impressionen</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatNumber(totals.impressions)}</div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)', padding: '16px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>CTR</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{totals.ctr.toFixed(2)}%</div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', padding: '16px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>Klicks</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatNumber(totals.clicks)}</div>
                </div>
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>CPC</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{formatCurrency(totals.cpc)}</div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', padding: '16px' }}>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>Leads</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{totals.leads}</div>
                </div>
              </div>

              {/* Chart */}
              {dailyInsights.length > 0 && (
                <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Analytics</h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#8B5CF6' }}></span>Ausgaben</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22C55E' }}></span>Klicks</span>
                    </div>
                  </div>
                  {renderChart()}
                </div>
              )}

              {/* Campaigns Table with Inline Edit */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Kampagnen</h3>
                </div>
                <div className="table-container" style={{ margin: 0 }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'center', width: '70px' }}>On/Off</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left' }}>Kampagne</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', width: '90px' }}>Status</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', width: '130px' }}>Budget</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', width: '100px' }}>Ausgaben</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', width: '90px' }}>Klicks</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', width: '70px' }}>Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCampaigns.map((campaign: any) => (
                        <tr key={campaign.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button onClick={() => toggleCampaignStatus(campaign.id, campaign.effective_status)} disabled={toggling === campaign.id} style={{ width: '42px', height: '22px', borderRadius: '11px', border: 'none', background: campaign.effective_status === 'ACTIVE' ? '#3B82F6' : 'rgba(255,255,255,0.2)', cursor: 'pointer', position: 'relative' }}>
                              <span style={{ position: 'absolute', top: '2px', left: campaign.effective_status === 'ACTIVE' ? '22px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                            </button>
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            {editing?.campaignId === campaign.id && editing?.field === 'name' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="text"
                                  value={editing.value}
                                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                  className="input"
                                  style={{ padding: '6px 10px', fontSize: '14px' }}
                                  autoFocus
                                />
                                <button onClick={saveEdit} disabled={saving} className="btn btn-primary" style={{ padding: '6px 8px' }}>
                                  <Check size={14} />
                                </button>
                                <button onClick={() => setEditing(null)} className="btn btn-secondary" style={{ padding: '6px 8px' }}>
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div>
                                  <div style={{ fontWeight: '500', color: '#60A5FA', cursor: 'pointer' }} onClick={() => startEdit(campaign.id, 'name', campaign.name)}>
                                    {campaign.name}
                                    <Pencil size={12} style={{ marginLeft: '6px', opacity: 0.4 }} />
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{campaign.objective.replace('OUTCOME_', '')}</div>
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: campaign.effective_status === 'ACTIVE' ? '#22C55E' : 'rgba(255,255,255,0.5)' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: campaign.effective_status === 'ACTIVE' ? '#22C55E' : 'rgba(255,255,255,0.3)' }} />
                              {campaign.effective_status === 'ACTIVE' ? 'Active' : 'Paused'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            {editing?.campaignId === campaign.id && editing?.field === 'budget' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <input
                                  type="number"
                                  value={editing.value}
                                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                  className="input"
                                  style={{ padding: '6px 10px', fontSize: '13px', width: '80px', textAlign: 'right' }}
                                  autoFocus
                                />
                                <button onClick={saveEdit} disabled={saving} className="btn btn-primary" style={{ padding: '6px 8px' }}>
                                  <Check size={14} />
                                </button>
                                <button onClick={() => setEditing(null)} className="btn btn-secondary" style={{ padding: '6px 8px' }}>
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <span style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => startEdit(campaign.id, 'budget', getBudgetValue(campaign))}>
                                {formatBudget(campaign, campaign.currency)}
                                <Pencil size={10} style={{ marginLeft: '4px', opacity: 0.4 }} />
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500' }}>{campaign.insights ? formatCurrency(campaign.insights.spend, campaign.currency) : '-'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: '13px' }}>{campaign.insights ? formatNumber(campaign.insights.clicks) : '-'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <span style={{ background: 'rgba(139,92,246,0.3)', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>{getLeadCount(campaign)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', fontWeight: '600' }}>
                        <td colSpan={4} style={{ padding: '12px 16px' }}>Totals</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(totals.spend)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatNumber(totals.clicks)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}><span style={{ background: 'rgba(139,92,246,0.3)', padding: '3px 8px', borderRadius: '4px' }}>{totals.leads}</span></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* CREATIVE TAB */}
          {activeTab === 'creative' && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '20px' }}>Ad Creatives</h3>
              {creatives.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                  <Image size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p>Keine Creatives gefunden</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                  {creatives.map((creative) => (
                    <div key={creative.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                      <div style={{ height: '160px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {creative.thumbnail_url || creative.image_url ? (
                          <img src={creative.thumbnail_url || creative.image_url} alt={creative.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Image size={32} style={{ opacity: 0.3 }} />
                        )}
                      </div>
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>{creative.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                          <span>Spend: {formatCurrency(creative.spend)}</span>
                          <span>Clicks: {formatNumber(creative.clicks)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ASSETS TAB */}
          {activeTab === 'assets' && (
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '20px' }}>Ad Assets</h3>
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                <LayoutGrid size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p>Sitelinks, Headlines, Descriptions</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>Coming Soon</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
