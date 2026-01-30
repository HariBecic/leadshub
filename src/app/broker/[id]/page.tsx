'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Mail, Phone, Plus, Edit, Trash2, Power, Send } from 'lucide-react'

export default function BrokerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [broker, setBroker] = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', contact_person: '', email: '', phone: ''
  })

  useEffect(() => { loadData() }, [params.id])

  async function loadData() {
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', params.id)
      .single()
    
    // Use 'contracts' table (not broker_contracts)
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('*, category:lead_categories(name)')
      .eq('broker_id', params.id)
      .order('created_at', { ascending: false })
    
    const { data: assignmentsData } = await supabase
      .from('lead_assignments')
      .select('*, lead:leads(first_name, last_name)')
      .eq('broker_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    const { data: categoriesData } = await supabase.from('lead_categories').select('*')
    
    setBroker(brokerData)
    setContracts(contractsData || [])
    setAssignments(assignmentsData || [])
    setCategories(categoriesData || [])
    
    if (brokerData) {
      setEditForm({
        name: brokerData.name || '',
        contact_person: brokerData.contact_person || '',
        email: brokerData.email || '',
        phone: brokerData.phone || ''
      })
    }
    
    setLoading(false)
  }

  async function updateBroker(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('brokers').update(editForm).eq('id', params.id)
    setShowEditModal(false)
    loadData()
  }

  async function toggleBrokerStatus() {
    await supabase.from('brokers').update({ is_active: !broker.is_active }).eq('id', params.id)
    loadData()
  }

  async function deleteBroker() {
    if (!confirm('Broker wirklich löschen?')) return
    await supabase.from('brokers').delete().eq('id', params.id)
    router.push('/broker')
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  if (!broker) {
    return <div className="card">Broker nicht gefunden</div>
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="badge badge-success">Aktiv</span>
      case 'pending': return <span className="badge badge-warning">Warte auf Bestätigung</span>
      case 'expired': return <span className="badge badge-neutral">expired</span>
      case 'inactive': return <span className="badge badge-neutral">Inaktiv</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  const pricingBadge = (model: string) => {
    switch (model) {
      case 'fixed': return <span className="badge" style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac' }}>Fixpreis</span>
      case 'subscription': return <span className="badge" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>Abo</span>
      case 'revenue_share': return <span className="badge" style={{ background: 'rgba(167,139,250,0.2)', color: '#c4b5fd' }}>Beteiligung</span>
      default: return <span className="badge badge-neutral">{model}</span>
    }
  }

  return (
    <div>
      {/* Back Link */}
      <Link href="/broker" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', textDecoration: 'none', marginBottom: '24px' }}>
        <ArrowLeft size={20} /> Zurück zu Broker
      </Link>

      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>{broker.name}</h1>
              <span className={`badge ${broker.is_active ? 'badge-success' : 'badge-danger'}`}>
                {broker.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
            {broker.contact_person && (
              <div style={{ fontSize: '16px', opacity: 0.7 }}>{broker.contact_person}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowEditModal(true)} className="btn btn-secondary btn-sm">
              <Edit size={16} /> Bearbeiten
            </button>
            <button onClick={toggleBrokerStatus} className="btn btn-secondary btn-sm">
              <Power size={16} /> {broker.is_active ? 'Deaktivieren' : 'Aktivieren'}
            </button>
          </div>
        </div>

        {/* Contact Info */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '24px', flexWrap: 'wrap' }}>
          {broker.email && (
            <a href={`mailto:${broker.email}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '12px', textDecoration: 'none', color: 'white' }}>
              <Mail size={20} style={{ color: '#93c5fd' }} />
              <span>{broker.email}</span>
            </a>
          )}
          {broker.phone && (
            <a href={`tel:${broker.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', background: 'rgba(34, 197, 94, 0.15)', borderRadius: '12px', textDecoration: 'none', color: 'white' }}>
              <Phone size={20} style={{ color: '#86efac' }} />
              <span>{broker.phone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Contracts */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Verträge</h2>
          <button onClick={() => setShowContractModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Neuer Vertrag
          </button>
        </div>
        
        {contracts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', opacity: 0.6 }}>Noch keine Verträge</div>
        ) : (
          <div className="table-responsive">
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
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="two-col-grid" style={{ marginBottom: '24px' }}>
        {/* Stats */}
        <div className="card">
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Statistiken</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <span style={{ opacity: 0.7 }}>Aktive Verträge</span>
              <span style={{ fontWeight: 700, color: '#86efac' }}>{contracts.filter(c => c.status === 'active').length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <span style={{ opacity: 0.7 }}>Zugewiesene Leads</span>
              <span style={{ fontWeight: 700, color: '#a78bfa' }}>{assignments.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <span style={{ opacity: 0.7 }}>Erstellt am</span>
              <span style={{ fontWeight: 500 }}>{new Date(broker.created_at).toLocaleDateString('de-CH')}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button onClick={deleteBroker} className="btn btn-secondary" style={{ color: '#fca5a5', width: '100%' }}>
              <Trash2 size={18} /> Broker löschen
            </button>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="card">
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Letzte Leads</h2>
          {assignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', opacity: 0.6 }}>Noch keine Leads zugewiesen</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {assignments.slice(0, 5).map((a) => (
                <Link href={`/leads/${a.lead_id}`} key={a.id} style={{ textDecoration: 'none', color: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.lead?.first_name} {a.lead?.last_name}</div>
                      <div style={{ fontSize: '13px', opacity: 0.6 }}>{new Date(a.created_at).toLocaleDateString('de-CH')}</div>
                    </div>
                    <span className={`badge ${a.status === 'success' ? 'badge-success' : a.status === 'sent' ? 'badge-info' : 'badge-neutral'}`}>
                      {a.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contract Modal */}
      {showContractModal && (
        <NewContractModal 
          brokerId={broker.id}
          categories={categories}
          onClose={() => setShowContractModal(false)} 
          onSave={() => { setShowContractModal(false); loadData() }} 
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Broker bearbeiten</h2>
            <form onSubmit={updateBroker} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Firmenname</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Kontaktperson</label>
                <input className="input" value={editForm.contact_person} onChange={e => setEditForm({...editForm, contact_person: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">E-Mail</label>
                <input type="email" className="input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Telefon</label>
                <input className="input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEditModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Speichern</button>
              </div>
            </form>
          </div>
        </div>
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
        <p style={{ opacity: 0.7, marginBottom: '24px' }}>Vertrag erstellen und per E-Mail zur Bestätigung senden</p>

        {success && (
          <div style={{ marginBottom: '16px', padding: '16px', background: 'rgba(34,197,94,0.2)', color: '#86efac', borderRadius: '10px', textAlign: 'center' }}>
            <Send size={24} style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 600 }}>Vertrag wurde per E-Mail gesendet!</div>
            <div style={{ fontSize: '14px', marginTop: '4px', opacity: 0.8 }}>Der Broker kann ihn jetzt bestätigen.</div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderRadius: '8px' }}>
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
                className="input"
              >
                <option value="">Alle Kategorien</option>
                {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Vertragstyp</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { value: 'revenue_share', label: 'Beteiligung', desc: 'Provision bei Abschluss' },
                  { value: 'subscription', label: 'Abo', desc: 'Monatliche Gebühr' },
                  { value: 'fixed', label: 'Fixpreis', desc: 'Pro Lead' }
                ].map((opt) => (
                  <label key={opt.value} style={{ 
                    flex: 1, 
                    padding: '14px', 
                    border: form.pricing_model === opt.value ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: form.pricing_model === opt.value ? 'rgba(167,139,250,0.1)' : 'transparent',
                    textAlign: 'center'
                  }}>
                    <input 
                      type="radio" 
                      name="pricing_model" 
                      checked={form.pricing_model === opt.value}
                      onChange={() => setForm({...form, pricing_model: opt.value})}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontWeight: 600, color: form.pricing_model === opt.value ? '#a78bfa' : 'white' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>{opt.desc}</div>
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

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={props.onClose} className="btn btn-secondary" style={{ flex: 1 }}>Abbrechen</button>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
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
