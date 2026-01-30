'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Mail, Phone, MapPin, Trash2, UserPlus } from 'lucide-react'

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [lead, setLead] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignForm, setAssignForm] = useState({
    broker_id: '', pricing_model: 'single', price_charged: '', revenue_share_percent: '50'
  })
  const [selectedBrokerContract, setSelectedBrokerContract] = useState<any>(null)

  useEffect(() => { loadData() }, [params.id])

  async function loadData() {
    const { data: leadData } = await supabase
      .from('leads')
      .select('*, category:lead_categories(id, name, default_price)')
      .eq('id', params.id)
      .single()
    
    const { data: assignmentsData } = await supabase
      .from('lead_assignments')
      .select('*, broker:brokers(name)')
      .eq('lead_id', params.id)
      .order('assigned_at', { ascending: false })
    
    // Load brokers with their active contracts
    const { data: brokersData } = await supabase
      .from('brokers')
      .select('*')
      .eq('status', 'active')
    
    // Load contracts for each broker
    const brokersWithContracts = await Promise.all((brokersData || []).map(async (broker) => {
      const { data: contracts } = await supabase
        .from('contracts')
        .select('*')
        .eq('broker_id', broker.id)
        .eq('status', 'active')
      return { ...broker, contracts: contracts || [] }
    }))
    
    setLead(leadData)
    setAssignments(assignmentsData || [])
    setBrokers(brokersWithContracts)
    
    if (leadData?.category?.default_price) {
      setAssignForm(f => ({ ...f, price_charged: leadData.category.default_price.toString() }))
    }
    
    setLoading(false)
  }

  // When broker changes, check for active contract
  function handleBrokerChange(brokerId: string) {
    const broker = brokers.find(b => b.id === brokerId)
    const leadCategoryId = lead?.category?.id
    
    // Find matching contract (category-specific or general)
    let contract = broker?.contracts?.find((c: any) => c.category_id === leadCategoryId)
    if (!contract) {
      contract = broker?.contracts?.find((c: any) => c.category_id === null)
    }
    
    setSelectedBrokerContract(contract)
    
    if (contract) {
      // Auto-fill from contract
      if (contract.pricing_model === 'revenue_share') {
        setAssignForm({
          broker_id: brokerId,
          pricing_model: 'commission',
          price_charged: '0',
          revenue_share_percent: contract.revenue_share_percent?.toString() || '50'
        })
      } else if (contract.pricing_model === 'subscription') {
        setAssignForm({
          broker_id: brokerId,
          pricing_model: 'subscription',
          price_charged: '0',
          revenue_share_percent: '0'
        })
      } else {
        setAssignForm({
          broker_id: brokerId,
          pricing_model: 'fixed',
          price_charged: contract.price_per_lead?.toString() || lead?.category?.default_price?.toString() || '35',
          revenue_share_percent: '0'
        })
      }
    } else {
      // No contract = Einzelkauf
      setAssignForm({
        broker_id: brokerId,
        pricing_model: 'single',
        price_charged: lead?.category?.default_price?.toString() || '35',
        revenue_share_percent: '0'
      })
    }
  }

  async function assignLead(e: React.FormEvent) {
    e.preventDefault()
    
    try {
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
      
      const data = await res.json()
      console.log('Assign response:', data)
      
      if (res.ok && data.success) {
        setShowAssignModal(false)
        setSelectedBrokerContract(null)
        loadData()
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (err) {
      console.error('Assign error:', err)
      alert('Netzwerkfehler beim Zuweisen')
    }
  }

  async function deleteLead() {
    if (!confirm('Lead wirklich löschen?')) return
    await supabase.from('leads').delete().eq('id', params.id)
    router.push('/leads')
  }

  // Parse extra_data - handle nested structure
  function getExtraData() {
    if (!lead?.extra_data) return null
    
    // Check if data is nested in extra_data.extra_data
    const data = lead.extra_data.extra_data || lead.extra_data
    return data
  }

  // Format label nicely
  function formatLabel(key: string): string {
    const labels: Record<string, string> = {
      fahrzeugmarke: 'Fahrzeugmarke',
      baujahr: 'Baujahr',
      fahrzeugtyp: 'Fahrzeugtyp',
      type: 'Typ',
      situation: 'Situation',
      kanton: 'Kanton',
      source: 'Quelle',
      timestamp: 'Zeitpunkt',
      aktuelle_kasse: 'Aktuelle Kasse',
      gewaehlte_kasse: 'Gewählte Kasse',
      gewaehlte_praemie: 'Prämie',
      franchise: 'Franchise',
      geburtsdatum: 'Geburtsdatum',
      geschlecht: 'Geschlecht'
    }
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  function renderKeyValue(key: string, value: any) {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'object') return null // Skip nested objects
    
    const labels: Record<string, string> = {
      kanton: 'Kanton',
      source: 'Quelle',
      type: 'Typ',
      situation: 'Situation',
      franchise: 'Franchise',
      geburtsdatum: 'Geburtsdatum',
      aktuelle_kasse: 'Aktuelle Kasse',
      gewaehlte_kasse: 'Gewählte Kasse',
      gewaehlte_praemie: 'Gewählte Prämie',
      zusatz_zahn: 'Zahnversicherung',
      zusatz_spital: 'Spitalversicherung',
      zusatz_komplementaer: 'Komplementärmedizin',
      zusatz_freie_arztwahl: 'Freie Arztwahl',
      timestamp: 'Erfasst'
    }
    
    let displayValue = String(value)
    if (key === 'timestamp') {
      displayValue = new Date(value).toLocaleString('de-CH')
    } else if (key === 'gewaehlte_praemie') {
      displayValue = `CHF ${value}`
    } else if (key.startsWith('zusatz_') && value === 'ja') {
      displayValue = '✓ Ja'
    } else if (key.startsWith('zusatz_') && value === 'nein') {
      displayValue = '✗ Nein'
    }
    
    return (
      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ opacity: 0.6 }}>{labels[key] || key.replace(/_/g, ' ')}</span>
        <span style={{ fontWeight: 500 }}>{displayValue}</span>
      </div>
    )
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  if (!lead) {
    return <div className="card">Lead nicht gefunden</div>
  }

  const extraData = getExtraData()
  const persons = extraData?.persons || []

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
                  <span>{a.pricing_model === 'commission' ? `${a.revenue_share_percent}% Beteiligung` : a.pricing_model === 'single' ? 'Einzelkauf' : 'Fixpreis'}</span>
                  <span>{new Date(a.assigned_at).toLocaleDateString('de-CH')}</span>
                </div>
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
                <span style={{ fontWeight: 500 }}>{lead.source || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                <span style={{ opacity: 0.7 }}>Zuweisungen</span>
                <span style={{ fontWeight: 500 }}>{assignments.length}x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extra Data */}
      {extraData && Object.keys(extraData).length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Zusätzliche Informationen</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* General Extra Fields */}
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#a5b4fc' }}>Anfrage-Details</h3>
              {Object.entries(extraData).map(([key, value]) => {
                // Skip nested objects and internal meta fields
                if (typeof value === 'object' || key === 'persons' || key.startsWith('meta_')) return null
                return renderKeyValue(key, value as string)
              })}
            </div>

            {/* Meta Info (if present) */}
            {(extraData.meta_leadgen_id || extraData.meta_form_id) && (
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#86efac' }}>Meta Ads Info</h3>
                {extraData.meta_leadgen_id && renderKeyValue('Lead ID', extraData.meta_leadgen_id)}
                {extraData.meta_form_id && renderKeyValue('Formular ID', extraData.meta_form_id)}
                {extraData.meta_created_time && renderKeyValue('Erstellt', extraData.meta_created_time)}
              </div>
            )}

            {/* Persons (for health insurance) */}
            {persons.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#c4b5fd' }}>Versicherte Personen</h3>
                {persons.map((person: any, index: number) => (
                  <div key={index} style={{ marginBottom: index < persons.length - 1 ? '16px' : 0, paddingBottom: index < persons.length - 1 ? '16px' : 0, borderBottom: index < persons.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>{person.name || `Person ${index + 1}`}</div>
                    <div style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
                      {Object.entries(person).filter(([k]) => k !== 'name').map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.6 }}>{formatLabel(key)}</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Lead zuweisen</h2>
            <p style={{ opacity: 0.7, marginBottom: '20px' }}>{lead.first_name} {lead.last_name}</p>
            
            <form onSubmit={assignLead}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Broker</label>
                <select className="input" value={assignForm.broker_id} onChange={e => handleBrokerChange(e.target.value)} required>
                  <option value="">-- Auswählen --</option>
                  {brokers.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.contracts?.length > 0 ? '(Vertrag)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show contract info if broker has one */}
              {assignForm.broker_id && selectedBrokerContract && (
                <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(167, 139, 250, 0.15)', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Aktiver Vertrag</div>
                  <div style={{ fontWeight: 600, color: '#c4b5fd' }}>
                    {selectedBrokerContract.pricing_model === 'revenue_share' && `Beteiligung: ${selectedBrokerContract.revenue_share_percent}%`}
                    {selectedBrokerContract.pricing_model === 'subscription' && `Abo: CHF ${selectedBrokerContract.monthly_fee}/Monat`}
                    {selectedBrokerContract.pricing_model === 'fixed' && `Fixpreis: CHF ${selectedBrokerContract.price_per_lead}/Lead`}
                  </div>
                </div>
              )}

              {/* Show single purchase info if no contract */}
              {assignForm.broker_id && !selectedBrokerContract && (
                <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                  <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Kein Vertrag</div>
                  <div style={{ fontWeight: 600, color: '#fde047' }}>Einzelkauf</div>
                </div>
              )}

              {/* Only show price input for fixed/single */}
              {assignForm.broker_id && (assignForm.pricing_model === 'fixed' || assignForm.pricing_model === 'single') && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Preis (CHF)</label>
                  <input type="number" step="0.01" className="input" value={assignForm.price_charged} onChange={e => setAssignForm({...assignForm, price_charged: e.target.value})} required />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAssignModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!assignForm.broker_id}>Zuweisen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
