'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, ExternalLink, RefreshCw } from 'lucide-react'

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

export default function MetaAdsPage() {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/marketing" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="https://cdn.brandfetch.io/meta.com/w/512/h/512/icon"
              alt="Meta"
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px',
                objectFit: 'contain',
                background: 'rgba(255,255,255,0.1)',
                padding: '6px'
              }}
            />
            <div>
              <h1>Meta Ads</h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '2px', fontSize: '14px' }}>
                Facebook & Instagram Kampagnen
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            Aktualisieren
          </button>
          <a 
            href="https://adsmanager.facebook.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <ExternalLink size={16} />
            Ads Manager
          </a>
        </div>
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
      ) : adAccounts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.6)' }}>
          <p>Keine Ad Accounts gefunden</p>
        </div>
      ) : (
        adAccounts.map(account => (
          <div key={account.id} className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '18px' }}>
              {account.name} 
              <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'normal', marginLeft: '8px' }}>
                ({account.currency})
              </span>
            </h2>
            
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
                      <th>Ausgaben (30T)</th>
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
                            {campaign.objective.replace('OUTCOME_', '')}
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
  )
}
