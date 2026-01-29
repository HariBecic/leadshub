'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Plus, Mail, Phone, FileText, Send } from 'lucide-react'

export default function BrokerDetailPage() {
  const params = useParams()
  const [broker, setBroker] = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showContractModal, setShowContractModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [params.id])

  async function loadData() {
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', params.id)
      .single()
    
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('*, category:lead_categories(name)')
      .eq('broker_id', params.id)
      .order('created_at', { ascending: false })

    const { data: assignmentsData } = await supabase
      .from('lead_assignments')
      .select('*, lead:leads(first_name, last_name)')
      .eq('broker_id', params.id)
      .order('assigned_at', { ascending: false })
      .limit(10)

    const { data: categoriesData } = await supabase
      .from('lead_categories')
      .select('*')

    setBroker(brokerData)
    setContracts(contractsData || [])
    setAssignments(assignmentsData || [])
    setCategories(categoriesData || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!broker) {
    return <div>Broker nicht gefunden</div>
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Aktiv</span>
      case 'pending': return <span className="badge badge-warning">Warte auf Bestätigung</span>
      case 'inactive': return <span className="badge badge-neutral">Inaktiv</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  const pricingBadge = (model: string) => {
    switch (model) {
      case 'fixed': return <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Fixpreis</span>
      case 'subscription': return <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>Abo</span>
      case 'revenue_share': return <span className="badge" style={{ background: '#f3e8ff', color: '#7c3aed' }}>Beteiligung</span>
      default: return <span className="badge badge-neutral">{model}</span>
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/broker" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px' }}>
          <ArrowLeft size={16} />
          Zurück zu Broker
        </Link>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{broker.name}</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>{broker.contact_person}</p>
        </div>
        <span className={`badge ${broker.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
          {broker.status === 'active' ? 'Aktiv' : broker.status}
        </span>
      </div>

      {/* Contact Info */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Kontaktdaten</h2>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          {broker.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} color="#64748b" />
              <a href={`mailto:${broker.email}`} style={{ color: '#3A29A6' }}>{broker.email}</a>
            </div>
          )}
          {broker.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={18} color="#64748b" />
              <a href={`tel:${broker.phone}`} style={{ color: '#3A29A6' }}>{broker.phone}</a>
            </div>
          )}
        </div>
      </div>

      {/* Contracts */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Verträge</h2>
          <button onClick={() => setShowContractModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} />Neuer Vertrag
          </button>
        </div>

        {contracts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
            Noch keine Verträge
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Typ</th>
                <th>Konditionen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>{contract.category?.name || 'Alle'}</td>
                  <td>{pricingBadge(contract.pricing_model)}</td>
                  <td style={{ fontWeight: 500 }}>
                    {contract.pricing_model === 'fixed' && `CHF ${contract.price_per_lead}/Lead`}
                    {contract.pricing_model === 'subscription' && `CHF ${contract.monthly_fee}/Monat`}
                    {contract.pricing_model === 'revenue_share' && `${contract.revenue_share_percent}%`}
                  </td>
                  <td>{statusBadge(contract.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Assignments */}
      <div className="card">
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Letzte Leads</h2>
        {assignments.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
            Noch keine Leads zugewiesen
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Datum</th>
                <th>Preis</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.lead?.first_name} {a.lead?.last_name}</td>
                  <td style={{ color: '#64748b' }}>{new Date(a.assigned_at).toLocaleDateString('de-CH')}</td>
                  <td>
                    {a.pricing_model === 'revenue_share' 
                      ? `${a.revenue_share_percent}%` 
                      : `CHF ${a.price_charged}`}
                  </td>
                  <td>
                    <span className={`badge ${a.status === 'success' ? 'badge-success' : a.status === 'sent' ? 'badge-info' : 'badge-neutral'}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showContractModal && (
        <NewContractModal 
          brokerId={broker.id}
          categories={categories}
          onClose={() => setShowContractModal(false)} 
          onSave={() => { setShowContractModal(false); loadData() }} 
        />
      )}
    </div>
  )
}

function NewContractModal(props: { brokerId: string; categories: any[]; onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    category_id: '',
    pricing_model: 'revenue_share',
    price_per_lead: 35,
    monthly_fee: 299,
    revenue_share_percent: 50,
    followup_days: 3
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          broker_id: props.brokerId,
          ...form
        })
      })
      const data = await res.json()
      
      if (data.success) {
        setSuccess(true)
        setTimeout(() => props.onSave(), 2000)
      } else {
        setError(data.error || 'Fehler beim Erstellen')
      }
    } catch {
      setError('Netzwerkfehler')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Neuer Vertrag</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>Vertrag erstellen und per E-Mail zur Bestätigung senden</p>

        {success && (
          <div style={{ marginBottom: '16px', padding: '16px', background: '#dcfce7', color: '#166534', borderRadius: '10px', textAlign: 'center' }}>
            <Send size={24} style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600 }}>Vertrag wurde per E-Mail gesendet!</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>Der Broker kann ihn jetzt bestätigen.</div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Kategorie</label>
              <select 
                value={form.category_id} 
                onChange={(e) => setForm({...form, category_id: e.target.value})} 
                className="select"
              >
                <option value="">Alle Kategorien</option>
                {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Vertragstyp</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { value: 'revenue_share', label: 'Beteiligung', color: '#7c3aed', bg: '#f3e8ff' },
                  { value: 'subscription', label: 'Abo', color: '#1e40af', bg: '#dbeafe' },
                  { value: 'fixed', label: 'Fixpreis', color: '#166534', bg: '#dcfce7' }
                ].map((opt) => (
                  <label key={opt.value} style={{ 
                    flex: 1, 
                    padding: '14px', 
                    border: form.pricing_model === opt.value ? `2px solid ${opt.color}` : '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: form.pricing_model === opt.value ? opt.bg : 'white',
                    textAlign: 'center'
                  }}>
                    <input 
                      type="radio" 
                      name="pricing_model" 
                      checked={form.pricing_model === opt.value}
                      onChange={() => setForm({...form, pricing_model: opt.value})}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontWeight: 600, color: form.pricing_model === opt.value ? opt.color : '#1e293b' }}>
                      {opt.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {form.pricing_model === 'revenue_share' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Beteiligung (%)</label>
                  <input 
                    type="number" 
                    value={form.revenue_share_percent} 
                    onChange={(e) => setForm({...form, revenue_share_percent: parseInt(e.target.value) || 0})} 
                    className="input"
                    min="1"
                    max="100"
                  />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Follow-up nach (Tage)</label>
                  <input 
                    type="number" 
                    value={form.followup_days} 
                    onChange={(e) => setForm({...form, followup_days: parseInt(e.target.value) || 3})} 
                    className="input"
                    min="1"
                  />
                </div>
              </>
            )}

            {form.pricing_model === 'subscription' && (
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Monatliche Gebühr (CHF)</label>
                <input 
                  type="number" 
                  value={form.monthly_fee} 
                  onChange={(e) => setForm({...form, monthly_fee: parseFloat(e.target.value) || 0})} 
                  className="input"
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            {form.pricing_model === 'fixed' && (
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Preis pro Lead (CHF)</label>
                <input 
                  type="number" 
                  value={form.price_per_lead} 
                  onChange={(e) => setForm({...form, price_per_lead: parseFloat(e.target.value) || 0})} 
                  className="input"
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                <Send size={16} />
                {loading ? 'Wird gesendet...' : 'Vertrag senden'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
