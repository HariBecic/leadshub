'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, Play, Pause, ExternalLink, RefreshCw, DollarSign, Eye, MousePointer } from 'lucide-react'

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
    cpc?: string
    ctr?: string
  }
}

interface AdAccount {
  id: string
  name: string
  currency: string
  campaigns: Campaign[]
}

export default function MarketingPage() {
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/meta/ads')
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAdAccounts(data.accounts || [])
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

  function formatBudget(amount: string | undefined, currency: string) {
    if (!amount) return '-'
    const value = parseFloat(amount) / 100
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency }).format(value)
  }

  function formatNumber(num: string | undefined) {
    if (!num) return '-'
    return new Intl.NumberFormat('de-CH').format(parseInt(num))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Marketing</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
            Werbekanäle und Plattformen verwalten
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* Meta Ads Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: 'linear-gradient(135deg, #1877F2, #0866FF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px'
          }}>
            f
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Meta Ads</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              Facebook & Instagram Kampagnen
            </p>
          </div>
          <a 
            href="https://adsmanager.facebook.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ marginLeft: 'auto' }}
          >
            <ExternalLink size={16} />
            Ads Manager öffnen
          </a>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={24} className="spin" />
            <p>Lade Kampagnen...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#fca5a5' }}>
            <p>❌ {error}</p>
          </div>
        ) : adAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.6)' }}>
            <p>Keine Ad Accounts gefunden</p>
          </div>
        ) : (
          adAccounts.map(account => (
            <div key={account.id} style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>
                {account.name} <span style={{ color: 'rgba(255,255,255,0.4)' }}>({account.currency})</span>
              </h3>
              
              {account.campaigns.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.5)' }}>Keine Kampagnen</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Kampagne</th>
                        <th>Status</th>
                        <th>Budget/Tag</th>
                        <th>Ausgaben</th>
                        <th>Impressionen</th>
                        <th>Klicks</th>
                        <th>Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.campaigns.map(campaign => (
                        <tr key={campaign.id}>
                          <td>
                            <strong>{campaign.name}</strong>
                            <br />
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                              {campaign.objective}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${campaign.effective_status === 'ACTIVE' ? 'active' : 'paused'}`}>
                              {campaign.effective_status === 'ACTIVE' ? 'Aktiv' : 
                               campaign.effective_status === 'PAUSED' ? 'Pausiert' : 
                               campaign.effective_status}
                            </span>
                          </td>
                          <td>{formatBudget(campaign.daily_budget, account.currency)}</td>
                          <td>{campaign.insights ? formatBudget(campaign.insights.spend, account.currency) : '-'}</td>
                          <td>{formatNumber(campaign.insights?.impressions)}</td>
                          <td>{formatNumber(campaign.insights?.clicks)}</td>
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
          ))
        )}
      </div>

      {/* Coming Soon Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* TikTok */}
        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, #000, #25F4EE)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}>
              T
            </div>
            <div>
              <h3 style={{ margin: 0 }}>TikTok Ads</h3>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                Demnächst verfügbar
              </p>
            </div>
          </div>
        </div>

        {/* Google */}
        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, #4285F4, #34A853)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}>
              G
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Google Ads</h3>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                Demnächst verfügbar
              </p>
            </div>
          </div>
        </div>

        {/* Plattformen */}
        <div className="card" style={{ opacity: 0.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}>
              P
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Plattformen</h3>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                praemien-vergleichen.ch & mehr
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
