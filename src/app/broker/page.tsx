'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'

export default function BrokerPage() {
  const [brokers, setBrokers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '', contact_person: '', email: '', phone: ''
  })

  useEffect(() => { loadBrokers() }, [])

  async function loadBrokers() {
    const { data } = await supabase.from('brokers').select('*').order('created_at', { ascending: false })
    setBrokers(data || [])
    setLoading(false)
  }

  async function createBroker(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('brokers').insert(formData)
    setShowModal(false)
    setFormData({ name: '', contact_person: '', email: '', phone: '' })
    loadBrokers()
  }

  const filtered = brokers.filter(b => 
    `${b.name} ${b.contact_person} ${b.email}`.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Broker</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Neuer Broker
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Suche nach Name, Kontakt oder E-Mail..."
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
                  <td style={{ fontWeight: 500 }}>{broker.name}</td>
                  <td>{broker.contact_person}</td>
                  <td>
                    <div>{broker.email}</div>
                    <div style={{ opacity: 0.7, fontSize: '13px' }}>{broker.phone}</div>
                  </td>
                  <td>
                    <span className={`badge ${broker.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {broker.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td>
                    <Link href={`/broker/${broker.id}`} className="btn btn-sm btn-secondary">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Neuer Broker</h2>
            <form onSubmit={createBroker} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Firmenname</label>
                <input className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Kontaktperson</label>
                <input className="input" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">E-Mail</label>
                <input type="email" className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Telefon</label>
                <input className="input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Erstellen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
