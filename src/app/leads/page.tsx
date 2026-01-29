'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Lead, Broker } from '@/lib/supabase'
import { Plus } from 'lucide-react'

interface Contract {
  id: string
  pricing_model: string
  price_per_lead: number | null
  revenue_share_percent: number | null
  monthly_fee: number | null
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: leadsData } = await supabase.from('leads').select('*, category:lead_categories(*)').order('created_at', { ascending: false })
    setLeads(leadsData || [])
    const { data: brokersData } = await supabase.from('brokers').select('*').eq('status', 'active')
    setBrokers(brokersData || [])
  }

  const filtered = leads.filter(l => 
    (l.first_name + ' ' + l.last_name + ' ' + l.email).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Leads</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={20} />Neuer Lead
        </button>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px 24px' }}>
        <input 
          type="text" 
          placeholder="Suche nach Name oder E-Mail..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="input input-search"
        />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
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
                  <Link href={`/leads/${lead.id}`}>#{lead.lead_number}</Link>
                </td>
                <td>
                  <Link href={`/leads/${lead.id}`} style={{ fontWeight: 500, color: '#1e293b' }}>{lead.first_name} {lead.last_name}</Link>
                </td>
                <td style={{ color: '#64748b' }}>
                  <div>{lead.email}</div>
                  <div>{lead.phone}</div>
                </td>
                <td>
                  {lead.category && <span className="badge badge-info">{(lead.category as any)?.name}</span>}
                </td>
                <td>
                  <span className={`badge ${lead.status === 'new' ? 'badge-success' : lead.status === 'assigned' ? 'badge-warning' : 'badge-neutral'}`}>
                    {lead.status === 'new' ? 'Neu' : lead.status === 'assigned' ? 'Zugewiesen' : lead.status}
                  </span>
                </td>
                <td>
                  {(lead.status === 'new' || lead.status === 'available') && (
                    <button 
                      onClick={() => { setSelectedLead(lead); setShowAssignModal(true) }}
                      className="btn btn-accent btn-sm"
                    >
                      Zuweisen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NewLeadModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadData() }} />}
      
      {showAssignModal && selectedLead && (
        <AssignModal 
          lead={selectedLead} 
          brokers={brokers} 
          onClose={() => { setShowAssignModal(false); setSelectedLead(null) }} 
          onSave={() => { setShowAssignModal(false); setSelectedLead(null); loadData() }} 
        />
      )}
    </div>
  )
}

function NewLeadModal(props: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', plz: '', ort: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: lastLead } = await supabase.from('leads').select('lead_number').order('lead_number', { ascending: false }).limit(1).single()
    const nextNumber = (lastLead?.lead_number || 0) + 1
    await supabase.from('leads').insert([{ ...form, lead_number: nextNumber, status: 'new', ownership: 'managed', assignment_count: 0 }])
    setLoading(false)
    props.onSave()
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Neuer Lead</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>Erfasse einen neuen Lead manuell</p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div><label className="input-label">Vorname</label><input value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} className="input" required /></div>
            <div><label className="input-label">Nachname</label><input value={form.last_name} onChange={(e) => setForm({...form, last_name: e.target.value})} className="input" required /></div>
          </div>
          <div style={{ marginBottom: '16px' }}><label className="input-label">E-Mail</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input" /></div>
          <div style={{ marginBottom: '16px' }}><label className="input-label">Telefon</label><input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="input" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div><label className="input-label">PLZ</label><input value={form.plz} onChange={(e) => setForm({...form, plz: e.target.value})} className="input" /></div>
            <div><label className="input-label">Ort</label><input value={form.ort} onChange={(e) => setForm({...form, ort: e.target.value})} className="input" /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '...' : 'Speichern'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssignModal(props: { lead: Lead; brokers: Broker[]; onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [brokerId, setBrokerId] = useState(props.brokers[0]?.id || '')
  const [price, setPrice] = useState(35)
  const [contract, setContract] = useState<Contract | null>(null)
  const [loadingContract, setLoadingContract] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; email_sent?: boolean; error?: string } | null>(null)

  useEffect(() => {
    loadContract(brokerId)
  }, [brokerId])

  async function loadContract(broker_id: string) {
    if (!broker_id) return
    setLoadingContract(true)
    
    const categoryId = (props.lead as any).category_id
    
    let { data: contractData } = await supabase
      .from('contracts')
      .select('*')
      .eq('broker_id', broker_id)
      .eq('category_id', categoryId)
      .eq('status', 'active')
      .single()

    if (!contractData) {
      const { data: generalContract } = await supabase
        .from('contracts')
        .select('*')
        .eq('broker_id', broker_id)
        .is('category_id', null)
        .eq('status', 'active')
        .single()
      contractData = generalContract
    }

    setContract(contractData)
    setLoadingContract(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead_id: props.lead.id, 
          broker_id: brokerId,
          price: contract ? undefined : price
        })
      })
      const data = await res.json()
      
      if (data.success) {
        setResult({ success: true, email_sent: data.email_sent })
        setTimeout(() => props.onSave(), 1500)
      } else {
        setResult({ error: data.error || 'Fehler beim Zuweisen' })
      }
    } catch {
      setResult({ error: 'Netzwerkfehler' })
    }
    setLoading(false)
  }

  const renderContractInfo = () => {
    if (loadingContract) {
      return <div style={{ color: '#64748b', fontSize: '14px' }}>Lade Vertrag...</div>
    }
    if (!contract) {
      return (
        <div>
          <div style={{ marginBottom: '12px', padding: '12px', background: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '14px' }}>
            Kein aktiver Vertrag gefunden
          </div>
          <label className="input-label">Preis (CHF)</label>
          <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} className="input" />
        </div>
      )
    }
    
    if (contract.pricing_model === 'revenue_share') {
      return (
        <div style={{ padding: '16px', background: '#f3e8ff', color: '#7c3aed', borderRadius: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Beteiligungsvertrag</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{contract.revenue_share_percent}% bei Abschluss</div>
        </div>
      )
    } else if (contract.pricing_model === 'subscription') {
      return (
        <div style={{ padding: '16px', background: '#dbeafe', color: '#2563eb', borderRadius: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Abo-Vertrag</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>CHF {contract.monthly_fee}/Monat</div>
        </div>
      )
    } else {
      return (
        <div style={{ padding: '16px', background: '#dcfce7', color: '#166534', borderRadius: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Fixpreis-Vertrag</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>CHF {contract.price_per_lead} pro Lead</div>
        </div>
      )
    }
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Lead zuweisen</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>{props.lead.first_name} {props.lead.last_name}</p>
        
        {result?.success && (
          <div style={{ marginBottom: '16px', padding: '14px', background: '#dcfce7', color: '#166534', borderRadius: '10px' }}>
            Lead erfolgreich zugewiesen! {result.email_sent ? 'E-Mail wurde gesendet.' : ''}
          </div>
        )}
        
        {result?.error && (
          <div style={{ marginBottom: '16px', padding: '14px', background: '#fee2e2', color: '#991b1b', borderRadius: '10px' }}>{result.error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label className="input-label">Broker</label>
            <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className="select">
              {props.brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label className="input-label">Preismodell</label>
            {renderContractInfo()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading || result?.success} className="btn btn-primary">
              {loading ? 'Wird zugewiesen...' : 'Zuweisen & E-Mail senden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
