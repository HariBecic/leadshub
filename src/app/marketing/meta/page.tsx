'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, ExternalLink, RefreshCw, TrendingUp, ChevronDown, Check } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  objective: string
}

interface AdAccount {
  id: string
  name: string
  currency: string
  campaigns: Campaign[]
}

interface Insights {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  reach: number
}

interface DailyInsight {
  date: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
}

export default function MetaAdsPage() {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'performance' | 'creative' | 'assets'>('performance')
  const [dateRange, setDateRange] = useState('last_7d')
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false)

  useEffect(() => {
    loadData()
  }, [dateRange, selectedCampaigns])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const campaignIds = selectedCampaigns.length > 0 ? `&campaigns=${selectedCampaigns.join(',')}` : ''
      const res = await fetch(`/api/meta/ads?range=${dateRange}${campaignIds}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAdAccounts(data.accounts || [])
        setInsights(data.insights || null)
        setDailyInsights(data.dailyInsights || [])
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten')
    }
    setLoading(false)
  }

  async function toggleCampaign(campaignId: string, currentStatus: string) {
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

  function toggleCampaignSelection(campaignId: string) {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    )
  }

  function selectAllCampaigns() {
    const allIds = adAccounts.flatMap(a => a.campaigns.map(c => c.id))
    setSelectedCampaigns(allIds)
  }

  function clearCampaignSelection() {
    setSelectedCampaigns([])
  }

  function formatCurrency(amount: number, currency = 'CHF') {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency }).format(amount)
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat('de-CH').format(Math.round(num))
  }

  function formatPercent(num: number) {
    return num.toFixed(2) + '%'
  }

  const allCampaigns = adAccounts.flatMap(a => a.campaigns)

  // Simple SVG Line Chart
  function renderChart() {
    if (dailyInsights.length === 0) return null
    
    const width = 800
    const height = 200
    const padding = 40
    
    const maxSpend = Math.max(...dailyInsights.map(d => d.spend), 1)
    const maxClicks = Math.max(...dailyInsights.map(d => d.clicks), 1)
    
    const xStep = (width - padding * 2) / (dailyInsights.length - 1 || 1)
    
    const spendPoints = dailyInsights.map((d, i) => {
      const x = padding + i * xStep
      const y = height - padding - (d.spend / maxSpend) * (height - padding * 2)
      return `${x},${y}`
    }).join(' ')
    
    const clicksPoints = dailyInsights.map((d, i) => {
      const x = padding + i * xStep
      const y = height - padding - (d.clicks / maxClicks) * (height - padding * 2)
      return `${x},${y}`
    }).join(' ')

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ marginTop: '20px' }}>
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <line 
            key={i}
            x1={padding} 
            y1={padding + i * (height - padding * 2) / 4} 
            x2={width - padding} 
            y2={padding + i * (height - padding * 2) / 4}
            stroke="rgba(255,255,255,0.1)"
          />
        ))}
        
        {/* Spend line */}
        <polyline
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="3"
          points={spendPoints}
        />
        
        {/* Clicks line */}
        <polyline
          fill="none"
          stroke="#22C55E"
          strokeWidth="3"
          points={clicksPoints}
        />
        
        {/* Data points - Spend */}
        {dailyInsights.map((d, i) => {
          const x = padding + i * xStep
          const y = height - padding - (d.spend / maxSpend) * (height - padding * 2)
          return <circle key={`spend-${i}`} cx={x} cy={y} r="4" fill="#8B5CF6" />
        })}
        
        {/* Data points - Clicks */}
        {dailyInsights.map((d, i) => {
          const x = padding + i * xStep
          const y = height - padding - (d.clicks / maxClicks) * (height - padding * 2)
          return <circle key={`clicks-${i}`} cx={x} cy={y} r="4" fill="#22C55E" />
        })}
        
        {/* X-axis labels */}
        {dailyInsights.map((d, i) => {
          const x = padding + i * xStep
          const date = new Date(d.date)
          const label = `${date.getDate()}.${date.getMonth() + 1}`
          return (
            <text 
              key={`label-${i}`} 
              x={x} 
              y={height - 10} 
              fill="rgba(255,255,255,0.5)" 
              fontSize="11" 
              textAnchor="middle"
            >
              {label}
            </text>
          )
        })}
      </svg>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/marketing" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="https://cdn.brandfetch.io/meta.com/w/512/h/512/icon"
              alt="Meta"
              style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', padding: '6px' }}
            />
            <div>
              <h1>Meta Ads</h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '2px', fontSize: '14px' }}>
                Facebook & Instagram Kampagnen
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="input"
            style={{ width: 'auto', padding: '8px 12px' }}
          >
            <option value="last_7d">Letzte 7 Tage</option>
            <option value="last_14d">Letzte 14 Tage</option>
            <option value="last_30d">Letzte 30 Tage</option>
            <option value="this_month">Dieser Monat</option>
          </select>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <ExternalLink size={16} />
            Ads Manager
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('performance')}
          className={`btn ${activeTab === 'performance' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <TrendingUp size={16} />
          Performance Analyze
        </button>
        <button 
          onClick={() => setActiveTab('creative')}
          className={`btn ${activeTab === 'creative' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ opacity: 0.5 }}
          disabled
        >
          Creative Analyze
        </button>
        <button 
          onClick={() => setActiveTab('assets')}
          className={`btn ${activeTab === 'assets' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ opacity: 0.5 }}
          disabled
        >
          Ad Assets
        </button>
      </div>

      {/* Campaign Filter */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Kampagnen:</span>
          
          {/* Campaign Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
              className="btn btn-secondary"
              style={{ minWidth: '200px', justifyContent: 'space-between' }}
            >
              <span>
                {selectedCampaigns.length === 0 
                  ? 'Alle Kampagnen' 
                  : selectedCampaigns.length === allCampaigns.length
                    ? 'Alle Kampagnen'
                    : `${selectedCampaigns.length} ausgewählt`}
              </span>
              <ChevronDown size={16} />
            </button>
            
            {showCampaignDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'rgba(30, 27, 75, 0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '8px 0',
                minWidth: '300px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 100,
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}>
                {/* Quick actions */}
                <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={selectAllCampaigns}
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    Alle auswählen
                  </button>
                  <button 
                    onClick={clearCampaignSelection}
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    Auswahl löschen
                  </button>
                </div>
                
                {/* Campaign list */}
                {allCampaigns.map(campaign => (
                  <div 
                    key={campaign.id}
                    onClick={() => toggleCampaignSelection(campaign.id)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      background: selectedCampaigns.includes(campaign.id) ? '#8B5CF6' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {selectedCampaigns.includes(campaign.id) && <Check size={14} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px' }}>{campaign.name}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                        {campaign.objective.replace('OUTCOME_', '')} • {campaign.effective_status === 'ACTIVE' ? 'Aktiv' : 'Pausiert'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected campaign tags */}
          {selectedCampaigns.length > 0 && selectedCampaigns.length < allCampaigns.length && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {selectedCampaigns.map(id => {
                const campaign = allCampaigns.find(c => c.id === id)
                if (!campaign) return null
                return (
                  <span 
                    key={id}
                    style={{
                      background: 'rgba(139, 92, 246, 0.3)',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {campaign.name.substring(0, 25)}{campaign.name.length > 25 ? '...' : ''}
                    <span 
                      onClick={() => toggleCampaignSelection(id)}
                      style={{ cursor: 'pointer', opacity: 0.7 }}
                    >
                      ✕
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showCampaignDropdown && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setShowCampaignDropdown(false)}
        />
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.6)' }}>Lade Analytics...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#fca5a5' }}>
          <p>❌ {error}</p>
        </div>
      ) : (
        <>
          {/* Analytics Cards */}
          {insights && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="card" style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', padding: '20px' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Ausgaben</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(insights.spend)}</div>
              </div>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>Impressionen</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatNumber(insights.impressions)}</div>
              </div>
              <div className="card" style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)', padding: '20px' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>CTR</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatPercent(insights.ctr)}</div>
              </div>
              <div className="card" style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', padding: '20px' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>Klicks</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatNumber(insights.clicks)}</div>
              </div>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>CPC</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(insights.cpc)}</div>
              </div>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>Reichweite</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatNumber(insights.reach)}</div>
              </div>
            </div>
          )}

          {/* Chart */}
          {dailyInsights.length > 0 && (
            <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Analytics</h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#8B5CF6' }}></span>
                    Ausgaben
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#22C55E' }}></span>
                    Klicks
                  </span>
                </div>
              </div>
              {renderChart()}
            </div>
          )}

          {/* Campaigns Table */}
          <div className="card">
            <h3 style={{ marginBottom: '20px' }}>Kampagnen</h3>
            {adAccounts.map(account => (
              <div key={account.id}>
                <h4 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                  {account.name} ({account.currency})
                </h4>
                {account.campaigns.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.5)' }}>Keine Kampagnen</p>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Kampagne</th>
                          <th>Status</th>
                          <th>Typ</th>
                          <th>Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.campaigns.map(campaign => (
                          <tr 
                            key={campaign.id}
                            style={{ 
                              background: selectedCampaigns.includes(campaign.id) ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
                            }}
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div 
                                  onClick={() => toggleCampaignSelection(campaign.id)}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '4px',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    background: selectedCampaigns.includes(campaign.id) ? '#8B5CF6' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                >
                                  {selectedCampaigns.includes(campaign.id) && <Check size={12} />}
                                </div>
                                <strong>{campaign.name}</strong>
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge status-${campaign.effective_status === 'ACTIVE' ? 'active' : 'paused'}`}>
                                {campaign.effective_status === 'ACTIVE' ? 'Aktiv' : 'Pausiert'}
                              </span>
                            </td>
                            <td style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                              {campaign.objective.replace('OUTCOME_', '')}
                            </td>
                            <td>
                              <button
                                onClick={() => toggleCampaign(campaign.id, campaign.effective_status)}
                                disabled={toggling === campaign.id}
                                className={`btn ${campaign.effective_status === 'ACTIVE' ? 'btn-secondary' : 'btn-primary'}`}
                                style={{ padding: '6px 12px', fontSize: '13px' }}
                              >
                                {toggling === campaign.id ? (
                                  <RefreshCw size={14} className="spin" />
                                ) : campaign.effective_status === 'ACTIVE' ? (
                                  <><Pause size={14} /> Pause</>
                                ) : (
                                  <><Play size={14} /> Start</>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
