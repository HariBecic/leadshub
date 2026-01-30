'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Mail, Phone, Plus, Edit, Trash2, Power } from 'lucide-react'

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
  const [contractForm, setContractForm] = useState({
    category_id: '', pricing_model: 'commission', fixed_price: '', revenue_share_percent: '50'
  })
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
    
    const { data: contractsData } = await supabase
      .from('broker_contracts')
      .select('*, category:lead_categories(name)')
      .eq('broker_id', params.id)
      .order('created_at', { ascending: false })
    
    const { data: assignmentsData } = await supabase
      .from('lead_assignments')
      .select('*, lead:leads(first_name, last_name)')
      .eq('broker_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    const { data: categoriesData } = await supabase.from('lead_categories').select('*').eq('is_active', true)
    
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

  async function createContract(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('broker_contracts').insert({
      broker_id: params.id,
      category_id: contractForm.category_id || null,
      pricing_model: contractForm.pricing_model,
      fixed_price: contractForm.pricing_model === 'fixed' ? parseFloat(contractForm.fixed_price) : null,
      revenue_share_percent: contractForm.pricing_model === 'commission' ? parseInt(contractForm.revenue_share_percent) : null,
      status: 'pending'
    })
    setShowContractModal(false)
    setContractForm({ category_id: '', pricing_model: 'commission', fixed_price: '', revenue_share_percent: '50' })
    loadData()
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

      {/* Two Column Layout */}
      <div className="two-col-grid" style={{ marginBottom: '24px' }}>
        {/* Contracts */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Verträge</h2>
            <button onClick={() => setShowContractModal(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> Neuer Vertrag
            </button>
          </div>
          
          {contracts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', opacity: 0.6 }}>Noch keine Verträge</div>
          ) : (
            contracts.map((contract) => (
              <div key={contract.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{contract.category?.name || 'Alle Kategorien'}</div>
                    <span className={`badge ${contract.pricing_model === 'commission' ? 'badge-accent' : 'badge-info'}`}>
                      {contract.pricing_model === 'commission' ? 'Beteiligung' : 'Fixpreis'}
                    </span>
                  </div>
                  <span className={`badge ${
                    contract.status === 'active' ? 'badge-success' : 
                    contract.status === 'pending' ? 'badge-warning' : 'badge-neutral'
                  }`}>
                    {contract.status === 'active' ? 'Aktiv' : 
                     contract.status === 'pending' ? 'Warte auf Bestätigung' : contract.status}
                  </span>
                </div>
                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                  {contract.pricing_model === 'commission' 
                    ? `${contract.revenue_share_percent}% Beteiligung` 
                    : `CHF ${Number(contract.fixed_price).toFixed(2)}/Lead`}
                </div>
              </div>
            ))
          )}
        </div>

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
      </div>

      {/* Recent Leads */}
      <div className="card">
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Letzte Leads</h2>
        {assignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', opacity: 0.6 }}>Noch keine Leads zugewiesen</div>
        ) : (
          <div className="table-responsive">
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
                    <td>
                      <Link href={`/leads/${a.lead_id}`} style={{ fontWeight: 500, color: 'white', textDecoration: 'none' }}>
                        {a.lead?.first_name} {a.lead?.last_name}
                      </Link>
                    </td>
                    <td style={{ opacity: 0.7 }}>{new Date(a.created_at).toLocaleDateString('de-CH')}</td>
                    <td>CHF {Number(a.price_charged || 0).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${
                        a.status === 'success' ? 'badge-success' : 
                        a.status === 'sent' ? 'badge-info' : 
                        a.status === 'pending' ? 'badge-warning' : 'badge-neutral'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contract Modal */}
      {showContractModal && (
        <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Neuer Vertrag</h2>
            <form onSubmit={createContract} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Kategorie</label>
                <select className="input" value={contractForm.category_id} onChange={e => setContractForm({...contractForm, category_id: e.target.value})}>
                  <option value="">Alle Kategorien</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Preismodell</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['commission', 'fixed'].map((model) => (
                    <label key={model} style={{ 
                      flex: 1, 
                      padding: '16px', 
                      border: contractForm.pricing_model === model ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)', 
                      borderRadius: '12px', 
                      cursor: 'pointer', 
                      background: contractForm.pricing_model === model ? 'rgba(167, 139, 250, 0.1)' : 'transparent',
                      textAlign: 'center'
                    }}>
                      <input type="radio" name="pricing" value={model} checked={contractForm.pricing_model === model} onChange={e => setContractForm({...contractForm, pricing_model: e.target.value})} style={{ display: 'none' }} />
                      <div style={{ fontWeight: 600 }}>{model === 'commission' ? 'Beteiligung' : 'Fixpreis'}</div>
                      <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                        {model === 'commission' ? 'Provision bei Abschluss' : 'Fester Preis pro Lead'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {contractForm.pricing_model === 'fixed' && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Preis pro Lead (CHF)</label>
                  <input type="number" step="0.01" className="input" value={contractForm.fixed_price} onChange={e => setContractForm({...contractForm, fixed_price: e.target.value})} required />
                </div>
              )}

              {contractForm.pricing_model === 'commission' && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Beteiligung (%)</label>
                  <input type="number" className="input" value={contractForm.revenue_share_percent} onChange={e => setContractForm({...contractForm, revenue_share_percent: e.target.value})} required />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowContractModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Erstellen</button>
              </div>
            </form>
          </div>
        </div>
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
