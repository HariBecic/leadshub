'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Users, Trash2, UserPlus } from 'lucide-react'

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({
    broker_id: '', pricing_model: 'fixed', price_charged: '', revenue_share_percent: '50'
  })

  useEffect(() => { loadData() }, [params.id])

  async function loadData() {
    const { data: leadData } = await supabase
      .from('leads')
      .select('*, category:lead_categories(name), source:lead_sources(name)')
      .eq('id', params.id)
      .single()
    
    const { data: assignmentsData } = await supabase
      .from('lead_assignments')
      .select('*, broker:brokers(name)')
      .eq('lead_id', params.id)
      .order('created_at', { ascending: false })
    
    const { data: brokersData } = await supabase
      .from('brokers')
      .select('*')
      .eq('is_active', true)
    
    setLead(leadData)
    setAssignments(assignmentsData || [])
    setBrokers(brokersData || [])
    
    if (leadData?.category?.default_price) {
      setAssignForm(f => ({ ...f, price_charged: leadData.category.default_price.toString() }))
    }
    
    setLoading(false)
  }

  async function assignLead(e: React.FormEvent) {
    e.preventDefault()
    
    const res = await fetch('/api/leads/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: params.id,
        broker_id: assignForm.broker_id,
        pricing_model: assignForm.pricing_model,
        price_charged: parseFloat(assignForm.price_charged) || 0,
        revenue_share_percent: assignForm.pricing_model === 'commission' ? parseInt(assignForm.revenue_share_percent) : null
      })
    })
    
    if (res.ok) {
      setShowAssignModal(false)
      loadData()
    }
  }

  async function deleteLead() {
    if (!confirm('Lead wirklich löschen?')) return
    await supabase.from('leads').delete().eq('id', params.id)
    router.push('/leads')
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  if (!lead) {
    return <div className="card">Lead nicht gefunden</div>
  }

  return (
    <div>
      {/* Back Link */}
      <Link href="/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', textDecoration: 'none', marginBottom: '24px' }}>
        <ArrowLeft size={20} /> Zurück
      </Link>

      {/* Header Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{lead.first_name} {lead.last_name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ opacity: 0.7 }}>Lead #{lead.lead_number}</span>
              {lead.category && <span className="badge badge-info">{lead.category.name}</span>}
              <span className={`badge ${lead.status === 'new' ? 'badge-success' : lead.status === 'assigned' ? 'badge-warning' : 'badge-neutral'}`}>
                {lead.status === 'new' ? 'Neu' : lead.status === 'assigned' ? 'Zugewiesen' : lead.status}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
          {lead.email && (
            <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', textDecoration: 'none', color: 'white' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={20} style={{ color: '#93c5fd' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.6 }}>E-Mail</div>
                <div style={{ fontWeight: 500 }}>{lead.email}</div>
              </div>
            </a>
          )}
          {lead.phone && (
            <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', textDecoration: 'none', color: 'white' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone size={20} style={{ color: '#86efac' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.6 }}>Telefon</div>
                <div style={{ fontWeight: 500 }}>{lead.phone}</div>
              </div>
            </a>
          )}
          {(lead.plz || lead.ort) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} style={{ color: '#fde047' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.6 }}>Standort</div>
                <div style={{ fontWeight: 500 }}>{lead.plz} {lead.ort}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="two-col-grid" style={{ marginBottom: '24px' }}>
        {/* Assignments */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Zuweisungs-Historie</h2>
            {lead.status === 'new' && (
              <button onClick={() => setShowAssignModal(true)} className="btn btn-primary btn-sm">
                <UserPlus size={16} /> Zuweisen
              </button>
            )}
          </div>
          
          {assignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', opacity: 0.6 }}>Noch keine Zuweisungen</div>
          ) : (
            assignments.map((a) => (
              <div key={a.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600 }}>{a.broker?.name}</div>
                  <span className={`badge ${
                    a.status === 'success' ? 'badge-success' : 
                    a.status === 'failed' ? 'badge-danger' : 
                    a.status === 'pending' ? 'badge-warning' : 'badge-info'
                  }`}>
                    {a.status === 'success' ? 'Abgeschlossen' : 
                     a.status === 'failed' ? 'Fehlgeschlagen' : 
                     a.status === 'pending' ? 'Ausstehend' : a.status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', opacity: 0.7, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>CHF {Number(a.price_charged || 0).toFixed(2)}</span>
                  <span>{a.pricing_model === 'commission' ? `${a.revenue_share_percent}% Beteiligung` : 'Fixpreis'}</span>
                  <span>{new Date(a.created_at).toLocaleDateString('de-CH')}</span>
                </div>
                {a.followup_response && (
                  <div style={{ marginTop: '8px', fontSize: '13px' }}>
                    <span className="badge badge-neutral">{a.followup_response}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Details & Actions */}
        <div>
          {/* Actions */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Aktionen</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {lead.status === 'new' && (
                <button onClick={() => setShowAssignModal(true)} className="btn btn-primary">
                  <UserPlus size={18} /> Lead zuweisen
                </button>
              )}
              <button onClick={deleteLead} className="btn btn-secondary" style={{ color: '#fca5a5' }}>
                <Trash2 size={18} /> Löschen
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="card">
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Details</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span style={{ opacity: 0.7 }}>Erstellt</span>
                <span style={{ fontWeight: 500 }}>{new Date(lead.created_at).toLocaleDateString('de-CH')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span style={{ opacity: 0.7 }}>Quelle</span>
                <span style={{ fontWeight: 500 }}>{lead.source?.name || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span style={{ opacity: 0.7 }}>Zuweisungen</span>
                <span style={{ fontWeight: 500 }}>{assignments.length}x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Lead zuweisen</h2>
            <p style={{ opacity: 0.7, marginBottom: '20px' }}>{lead.first_name} {lead.last_name}</p>
            
            <form onSubmit={assignLead}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Broker</label>
                <select className="input" value={assignForm.broker_id} onChange={e => setAssignForm({...assignForm, broker_id: e.target.value})} required>
                  <option value="">-- Auswählen --</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Preismodell</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['fixed', 'commission', 'single'].map((model) => (
                    <label key={model} style={{ 
                      flex: 1, 
                      padding: '14px', 
                      border: assignForm.pricing_model === model ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)', 
                      borderRadius: '12px', 
                      cursor: 'pointer', 
                      background: assignForm.pricing_model === model ? 'rgba(167, 139, 250, 0.1)' : 'transparent',
                      textAlign: 'center'
                    }}>
                      <input type="radio" name="pricing" value={model} checked={assignForm.pricing_model === model} onChange={e => setAssignForm({...assignForm, pricing_model: e.target.value})} style={{ display: 'none' }} />
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        {model === 'fixed' ? 'Fixpreis' : model === 'commission' ? 'Provision' : 'Einzelkauf'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Preis (CHF)</label>
                <input type="number" step="0.01" className="input" value={assignForm.price_charged} onChange={e => setAssignForm({...assignForm, price_charged: e.target.value})} required />
              </div>

              {assignForm.pricing_model === 'commission' && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Beteiligung (%)</label>
                  <input type="number" className="input" value={assignForm.revenue_share_percent} onChange={e => setAssignForm({...assignForm, revenue_share_percent: e.target.value})} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAssignModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Zuweisen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
