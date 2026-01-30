'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, RefreshCw, UserPlus, Check } from 'lucide-react'
import Link from 'next/link'

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', plz: '', ort: '', category_id: ''
  })
  const [assignForm, setAssignForm] = useState({
    broker_id: '', pricing_model: 'fixed', price_charged: '', revenue_share_percent: '50'
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*, category:lead_categories(name, default_price)')
      .order('created_at', { ascending: false })
    const { data: categoriesData } = await supabase.from('lead_categories').select('*').eq('is_active', true)
    const { data: brokersData } = await supabase.from('brokers').select('*').eq('status', 'active')
    setLeads(leadsData || [])
    setCategories(categoriesData || [])
    setBrokers(brokersData || [])
    setLoading(false)
  }

  async function createLead(e: React.FormEvent) {
    e.preventDefault()
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true })
    const leadNumber = (count || 0) + 1
    
    await supabase.from('leads').insert({
      ...formData,
      lead_number: leadNumber,
      category_id: formData.category_id || null
    })
    
    setShowModal(false)
    setFormData({ first_name: '', last_name: '', email: '', phone: '', plz: '', ort: '', category_id: '' })
    loadData()
  }

  async function generateTestLeads() {
    const firstNames = ['Hans', 'Peter', 'Maria', 'Anna', 'Thomas', 'Sandra', 'Michael', 'Julia', 'Daniel', 'Lisa']
    const lastNames = ['Müller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Huber', 'Schneider', 'Fischer', 'Gerber', 'Brunner']
    const cities = [
      { plz: '8001', ort: 'Zürich' }, { plz: '3011', ort: 'Bern' }, { plz: '4001', ort: 'Basel' },
      { plz: '1201', ort: 'Genf' }, { plz: '6003', ort: 'Luzern' }, { plz: '9000', ort: 'St. Gallen' }
    ]
    
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true })
    let leadNumber = (count || 0) + 1
    
    const newLeads = []
    for (let i = 0; i < 10; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const city = cities[Math.floor(Math.random() * cities.length)]
      const category = categories[Math.floor(Math.random() * categories.length)]
      
      newLeads.push({
        lead_number: leadNumber++,
        first_name: firstName,
        last_name: lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@test.ch`,
        phone: `07${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        plz: city.plz,
        ort: city.ort,
        category_id: category?.id || null
      })
    }
    
    await supabase.from('leads').insert(newLeads)
    loadData()
  }

  function toggleSelectLead(leadId: string) {
    setSelectedLeads(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    )
  }

  function toggleSelectAll() {
    const newLeads = filtered.filter(l => l.status === 'new')
    if (selectedLeads.length === newLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(newLeads.map(l => l.id))
    }
  }

  function openAssignModal() {
    // Get default price from first selected lead's category
    const firstLead = leads.find(l => selectedLeads.includes(l.id))
    if (firstLead?.category?.default_price) {
      setAssignForm(f => ({ ...f, price_charged: firstLead.category.default_price.toString() }))
    }
    setShowAssignModal(true)
  }

  async function assignLeads(e: React.FormEvent) {
    e.preventDefault()
    
    for (const leadId of selectedLeads) {
      await fetch('/api/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          broker_id: assignForm.broker_id,
          pricing_model: assignForm.pricing_model,
          price_charged: parseFloat(assignForm.price_charged) || 0,
          revenue_share_percent: assignForm.pricing_model === 'commission' ? parseInt(assignForm.revenue_share_percent) : null
        })
      })
    }
    
    setShowAssignModal(false)
    setSelectedLeads([])
    setAssignForm({ broker_id: '', pricing_model: 'fixed', price_charged: '', revenue_share_percent: '50' })
    loadData()
  }

  const filtered = leads.filter(l => 
    `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const newLeadsCount = filtered.filter(l => l.status === 'new').length

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Leads</h1>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {selectedLeads.length > 0 && (
            <button onClick={openAssignModal} className="btn btn-accent">
              <UserPlus size={18} /> {selectedLeads.length} zuweisen
            </button>
          )}
          <button onClick={generateTestLeads} className="btn btn-secondary">
            <RefreshCw size={18} /> 10 Test-Leads
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={18} /> Neuer Lead
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Suche nach Name oder E-Mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ paddingLeft: '48px' }}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>
                  <div 
                    onClick={toggleSelectAll}
                    style={{ 
                      width: '22px', height: '22px', borderRadius: '6px', 
                      border: '2px solid rgba(255,255,255,0.3)', 
                      background: selectedLeads.length === newLeadsCount && newLeadsCount > 0 ? '#a78bfa' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedLeads.length === newLeadsCount && newLeadsCount > 0 && <Check size={14} />}
                  </div>
                </th>
                <th>ID</th>
                <th>Name</th>
                <th>Kontakt</th>
                <th>Kategorie</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    {lead.status === 'new' && (
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelectLead(lead.id) }}
                        style={{ 
                          width: '22px', height: '22px', borderRadius: '6px', 
                          border: '2px solid rgba(255,255,255,0.3)', 
                          background: selectedLeads.includes(lead.id) ? '#a78bfa' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedLeads.includes(lead.id) && <Check size={14} />}
                      </div>
                    )}
                  </td>
                  <td>#{lead.lead_number}</td>
                  <td>
                    <Link href={`/leads/${lead.id}`} style={{ fontWeight: 500, color: 'white', textDecoration: 'none' }}>
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td>
                    <div>{lead.email}</div>
                    <div style={{ opacity: 0.7, fontSize: '13px' }}>{lead.phone}</div>
                  </td>
                  <td>
                    {lead.category && <span className="badge badge-info">{lead.category.name}</span>}
                  </td>
                  <td>
                    <span className={`badge ${lead.status === 'new' ? 'badge-success' : lead.status === 'assigned' ? 'badge-warning' : 'badge-neutral'}`}>
                      {lead.status === 'new' ? 'Neu' : lead.status === 'assigned' ? 'Zugewiesen' : lead.status}
                    </span>
                  </td>
                  <td>
                    {lead.status === 'new' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedLeads([lead.id]); openAssignModal() }} 
                        className="btn btn-sm btn-accent"
                      >
                        <UserPlus size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Lead Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Neuer Lead</h2>
            <form onSubmit={createLead} style={{ marginTop: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Vorname</label>
                  <input className="input" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required />
                </div>
                <div>
                  <label className="input-label">Nachname</label>
                  <input className="input" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className="input-label">E-Mail</label>
                <input type="email" className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className="input-label">Telefon</label>
                <input className="input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginTop: '16px' }}>
                <div>
                  <label className="input-label">PLZ</label>
                  <input className="input" value={formData.plz} onChange={e => setFormData({...formData, plz: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Ort</label>
                  <input className="input" value={formData.ort} onChange={e => setFormData({...formData, ort: e.target.value})} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className="input-label">Kategorie</label>
                <select className="input" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                  <option value="">-- Auswählen --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Erstellen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Leads zuweisen</h2>
            <p style={{ opacity: 0.7, marginBottom: '20px' }}>{selectedLeads.length} Lead{selectedLeads.length > 1 ? 's' : ''} ausgewählt</p>
            
            <form onSubmit={assignLeads}>
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
                <label className="input-label">Preis pro Lead (CHF)</label>
                <input type="number" step="0.01" className="input" value={assignForm.price_charged} onChange={e => setAssignForm({...assignForm, price_charged: e.target.value})} required />
                {selectedLeads.length > 1 && assignForm.price_charged && (
                  <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '6px' }}>
                    Total: CHF {(parseFloat(assignForm.price_charged) * selectedLeads.length).toFixed(2)}
                  </div>
                )}
              </div>

              {assignForm.pricing_model === 'commission' && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Beteiligung (%)</label>
                  <input type="number" className="input" value={assignForm.revenue_share_percent} onChange={e => setAssignForm({...assignForm, revenue_share_percent: e.target.value})} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowAssignModal(false); setSelectedLeads([]) }}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {selectedLeads.length > 1 ? `${selectedLeads.length} Leads zuweisen` : 'Zuweisen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
