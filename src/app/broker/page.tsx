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
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading brokers:', error)
    }
    
    // Load contracts separately
    const brokersWithContracts = await Promise.all((data || []).map(async (broker) => {
      const { data: contracts } = await supabase
        .from('broker_contracts')
        .select('id, status')
        .eq('broker_id', broker.id)
      return { ...broker, contracts: contracts || [] }
    }))
    
    setBrokers(brokersWithContracts)
    setLoading(false)
  }

  async function createBroker(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('brokers').insert({ ...formData, is_active: true })
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

      {/* Broker Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {filtered.map((broker) => {
          const activeContracts = broker.contracts?.filter((c: any) => c.status === 'active').length || 0
          return (
            <Link href={`/broker/${broker.id}`} key={broker.id} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'all 0.2s', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{broker.name}</h3>
                    <div style={{ fontSize: '14px', opacity: 0.7 }}>{broker.contact_person}</div>
                  </div>
                  <span className={`badge ${broker.is_active ? 'badge-success' : 'badge-neutral'}`}>
                    {broker.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {broker.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <span style={{ opacity: 0.5 }}>✉</span>
                      <span>{broker.email}</span>
                    </div>
                  )}
                  {broker.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <span style={{ opacity: 0.5 }}>☎</span>
                      <span>{broker.phone}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#a78bfa' }}>{activeContracts}</div>
                    <div style={{ fontSize: '12px', opacity: 0.6 }}>Aktive Verträge</div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#86efac' }}>{broker.contracts?.length || 0}</div>
                    <div style={{ fontSize: '12px', opacity: 0.6 }}>Verträge Total</div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
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
