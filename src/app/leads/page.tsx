'use client'

import { useEffect, useState } from 'react'
import { supabase, Lead, LeadCategory, Broker } from '@/lib/supabase'
import { Plus, Search } from 'lucide-react'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [categories, setCategories] = useState<LeadCategory[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [leadsRes, categoriesRes, brokersRes] = await Promise.all([
      supabase.from('leads').select('*, category:lead_categories(*)').order('created_at', { ascending: false }).limit(100),
      supabase.from('lead_categories').select('*').eq('active', true),
      supabase.from('brokers').select('*').eq('status', 'active'),
    ])
    setLeads(leadsRes.data || [])
    setCategories(categoriesRes.data || [])
    setBrokers(brokersRes.data || [])
    setLoading(false)
  }

  const filteredLeads = leads.filter(lead => {
    const s = search.toLowerCase()
    return (lead.first_name || '').toLowerCase().includes(s) || (lead.last_name || '').toLowerCase().includes(s)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Leads</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={20} />Neuer Lead
        </button>
      </div>
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Suche..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
      </div>
      {filteredLeads.length === 0 ? (
        <div className="card empty-state"><p>Keine Leads</p></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Name</th><th>Kontakt</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>#{lead.lead_number}</td>
                  <td>{lead.first_name} {lead.last_name}</td>
                  <td><div>{lead.email}</div><div>{lead.phone}</div></td>
                  <td><span className="badge badge-success">{lead.status}</span></td>
                  <td>
                    {(lead.status === 'new' || lead.status === 'available') && (
                      <button onClick={() => { setSelectedLead(lead); setShowAssignModal(true) }} className="btn btn-secondary">
                        Zuweisen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && <CreateModal categories={categories} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadData() }} />}
      {showAssignModal && selectedLead && <AssignModal lead={selectedLead} brokers={brokers} onClose={() => { setShowAssignModal(false); setSelectedLead(null) }} onSave={() => { setShowAssignModal(false); setSelectedLead(null); loadData() }} />}
    </div>
  )
}

function CreateModal(props: { categories: LeadCategory[]; onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ category_id: props.categories[0]?.id || '', first_name: '', last_name: '', email: '', phone: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('leads').insert([{ ...form, status: 'new', ownership: 'managed' }])
    setLoading(false)
    props.onSave()
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Neuer Lead</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Kategorie</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="select">
              {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Vorname</label>
            <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="input-label">Nachname</label>
            <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="input-label">E-Mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          </div>
          <div>
            <label className="input-label">Telefon</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('lead_assignments').insert([{ lead_id: props.lead.id, broker_id: brokerId, status: 'sent', price_charged: 35 }])
    await supabase.from('leads').update({ status: 'assigned', ownership: 'sold' }).eq('id', props.lead.id)
    setLoading(false)
    props.onSave()
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Lead zuweisen</h2>
        <p className="mb-4">{props.lead.first_name} {props.lead.last_name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Broker</label>
            <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className="select">
              {props.brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '...' : 'Zuweisen'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
