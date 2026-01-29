'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Broker } from '@/lib/supabase'
import { Plus } from 'lucide-react'

export default function BrokerPage() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { loadBrokers() }, [])

  async function loadBrokers() {
    const { data } = await supabase.from('brokers').select('*').order('name')
    setBrokers(data || [])
  }

  const filtered = brokers.filter(b => 
    (b.name + ' ' + b.email + ' ' + b.contact_person).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Broker</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={20} />Neuer Broker
        </button>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px 24px' }}>
        <input 
          type="text" 
          placeholder="Suche nach Name, Kontakt oder E-Mail..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          className="input input-search"
        />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kontaktperson</th>
              <th>Kontakt</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((broker) => (
              <tr key={broker.id}>
                <td>
                  <Link href={`/broker/${broker.id}`} style={{ fontWeight: 500 }}>{broker.name}</Link>
                </td>
                <td style={{ color: '#64748b' }}>{broker.contact_person}</td>
                <td style={{ color: '#64748b' }}>
                  <div>{broker.email}</div>
                  <div>{broker.phone}</div>
                </td>
                <td>
                  <span className={`badge ${broker.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                    {broker.status === 'active' ? 'Aktiv' : broker.status}
                  </span>
                </td>
                <td>
                  <Link href={`/broker/${broker.id}`} className="btn btn-secondary btn-sm">Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NewBrokerModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadBrokers() }} />}
    </div>
  )
}

function NewBrokerModal(props: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('brokers').insert([{ ...form, status: 'active' }])
    setLoading(false)
    props.onSave()
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Neuer Broker</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>Erfasse einen neuen Broker</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Firmenname</label>
            <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="input" required />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Kontaktperson</label>
            <input value={form.contact_person} onChange={(e) => setForm({...form, contact_person: e.target.value})} className="input" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">E-Mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input" required />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label className="input-label">Telefon</label>
            <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="input" />
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
