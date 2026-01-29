'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Lead, Broker } from '@/lib/supabase'
import { Search, Plus } from 'lucide-react'

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

  const statusBadge = (status: string) => {
    switch (status) {
      case 'new': return <span className="badge badge-success">new</span>
      case 'assigned': return <span className="badge badge-warning">assigned</span>
      case 'closed': return <span className="badge badge-info">closed</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Leads</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus size={20} />Neuer Lead
        </button>
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Suche..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-3">ID</th>
              <th className="pb-3">Name</th>
              <th className="pb-3">Kontakt</th>
              <th className="pb-3">Kategorie</th>
              <th className="pb-3">Status</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-4">
                  <Link href={`/leads/${lead.id}`} className="text-blue-600 hover:underline">#{lead.lead_number}</Link>
                </td>
                <td className="py-4">
                  <Link href={`/leads/${lead.id}`} className="font-medium hover:text-blue-600">{lead.first_name} {lead.last_name}</Link>
                </td>
                <td className="py-4 text-gray-500">
                  <div>{lead.email}</div>
                  <div>{lead.phone}</div>
                </td>
                <td className="py-4">
                  {lead.category && <span className="badge badge-info">{(lead.category as any)?.name}</span>}
                </td>
                <td className="py-4">{statusBadge(lead.status)}</td>
                <td className="py-4">
                  {(lead.status === 'new' || lead.status === 'available') && (
                    <button 
                      onClick={() => { setSelectedLead(lead); setShowAssignModal(true) }}
                      className="btn btn-secondary btn-sm"
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
        <h2 className="text-xl font-bold mb-4">Neuer Lead</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="input-label">Vorname</label><input value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} className="input" required /></div>
            <div><label className="input-label">Nachname</label><input value={form.last_name} onChange={(e) => setForm({...form, last_name: e.target.value})} className="input" required /></div>
          </div>
          <div><label className="input-label">E-Mail</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input" /></div>
          <div><label className="input-label">Telefon</label><input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="input" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="input-label">PLZ</label><input value={form.plz} onChange={(e) => setForm({...form, plz: e.target.value})} className="input" /></div>
            <div><label className="input-label">Ort</label><input value={form.ort} onChange={(e) => setForm({...form, ort: e.target.value})} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3">
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
      return <div className="text-gray-500 text-sm">Lade Vertrag...</div>
    }
    if (!contract) {
      return (
        <div>
          <div className="mb-2 p-2 bg-yellow-50 text-yellow-700 rounded text-sm">
            Kein aktiver Vertrag gefunden
          </div>
          <label className="input-label">Preis (CHF)</label>
          <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} className="input" />
        </div>
      )
    }
    
    if (contract.pricing_model === 'revenue_share') {
      return (
        <div className="p-3 bg-purple-50 text-purple-700 rounded-lg">
          <div className="font-medium">Beteiligungsvertrag</div>
          <div className="text-lg">{contract.revenue_share_percent}% bei Abschluss</div>
        </div>
      )
    } else if (contract.pricing_model === 'subscription') {
      return (
        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
          <div className="font-medium">Abo-Vertrag</div>
          <div className="text-lg">CHF {contract.monthly_fee}/Monat</div>
        </div>
      )
    } else {
      return (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg">
          <div className="font-medium">Fixpreis-Vertrag</div>
          <div className="text-lg">CHF {contract.price_per_lead} pro Lead</div>
        </div>
      )
    }
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Lead zuweisen</h2>
        <p className="mb-4 text-gray-600">{props.lead.first_name} {props.lead.last_name}</p>
        
        {result?.success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg">
            Lead erfolgreich zugewiesen! {result.email_sent ? 'E-Mail wurde gesendet.' : 'E-Mail konnte nicht gesendet werden.'}
          </div>
        )}
        
        {result?.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{result.error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Broker</label>
            <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className="select">
              {props.brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="input-label">Preismodell</label>
            {renderContractInfo()}
          </div>

          <div className="flex justify-end gap-3">
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
