'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Package } from 'lucide-react'

export default function PaketePage() {
  const [packages, setPackages] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '', broker_id: '', category_id: '', lead_count: '10', price: '500', delivery_type: 'instant'
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: packagesData } = await supabase
      .from('lead_packages')
      .select('*, broker:brokers(name), category:lead_categories(name)')
      .order('created_at', { ascending: false })
    const { data: brokersData } = await supabase.from('brokers').select('*').eq('is_active', true)
    const { data: categoriesData } = await supabase.from('lead_categories').select('*').eq('is_active', true)
    
    setPackages(packagesData || [])
    setBrokers(brokersData || [])
    setCategories(categoriesData || [])
    setLoading(false)
  }

  async function createPackage(e: React.FormEvent) {
    e.preventDefault()
    
    const res = await fetch('/api/packages/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name,
        broker_id: formData.broker_id,
        category_id: formData.category_id || null,
        lead_count: parseInt(formData.lead_count),
        price: parseFloat(formData.price),
        delivery_type: formData.delivery_type
      })
    })
    
    if (res.ok) {
      setShowModal(false)
      setFormData({ name: '', broker_id: '', category_id: '', lead_count: '10', price: '500', delivery_type: 'instant' })
      loadData()
    }
  }

  async function markAsPaid(packageId: string) {
    await fetch('/api/packages/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: packageId })
    })
    loadData()
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lead-Pakete</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Neues Paket
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Paket</th>
                <th>Broker</th>
                <th>Kategorie</th>
                <th>Leads</th>
                <th>Typ</th>
                <th>Preis</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td style={{ fontWeight: 500 }}>{pkg.name}</td>
                  <td>{pkg.broker?.name}</td>
                  <td>{pkg.category?.name || '-'}</td>
                  <td>{pkg.leads_delivered} / {pkg.lead_count}</td>
                  <td>
                    <span className="badge badge-info">
                      {pkg.delivery_type === 'instant' ? 'Sofort' : 'Verteilt'}
                    </span>
                  </td>
                  <td>CHF {Number(pkg.price).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${
                      pkg.status === 'completed' ? 'badge-success' : 
                      pkg.status === 'active' ? 'badge-info' : 
                      pkg.status === 'paid' ? 'badge-accent' : 'badge-warning'
                    }`}>
                      {pkg.status === 'completed' ? 'Abgeschlossen' : 
                       pkg.status === 'active' ? 'Aktiv' : 
                       pkg.status === 'paid' ? 'Bezahlt' : 'Warte auf Zahlung'}
                    </span>
                  </td>
                  <td>
                    {pkg.status === 'pending' && (
                      <button onClick={() => markAsPaid(pkg.id)} className="btn btn-sm btn-primary">
                        Bezahlt
                      </button>
                    )}
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
            <h2>Neues Paket</h2>
            <form onSubmit={createPackage} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Paketname</label>
                <input className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="z.B. 10er Paket" required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Broker</label>
                <select className="input" value={formData.broker_id} onChange={e => setFormData({...formData, broker_id: e.target.value})} required>
                  <option value="">-- Auswählen --</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Kategorie (optional)</label>
                <select className="input" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                  <option value="">Alle Kategorien</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="input-label">Anzahl Leads</label>
                  <input type="number" className="input" value={formData.lead_count} onChange={e => setFormData({...formData, lead_count: e.target.value})} required />
                </div>
                <div>
                  <label className="input-label">Preis (CHF)</label>
                  <input type="number" className="input" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Lieferart</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <label style={{ flex: 1, padding: '16px', border: formData.delivery_type === 'instant' ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)', borderRadius: '12px', cursor: 'pointer', background: formData.delivery_type === 'instant' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                    <input type="radio" name="delivery" value="instant" checked={formData.delivery_type === 'instant'} onChange={e => setFormData({...formData, delivery_type: e.target.value})} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 600 }}>Sofort</div>
                    <div style={{ fontSize: '13px', opacity: 0.7 }}>Alle Leads auf einmal</div>
                  </label>
                  <label style={{ flex: 1, padding: '16px', border: formData.delivery_type === 'distributed' ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)', borderRadius: '12px', cursor: 'pointer', background: formData.delivery_type === 'distributed' ? 'rgba(167, 139, 250, 0.1)' : 'transparent' }}>
                    <input type="radio" name="delivery" value="distributed" checked={formData.delivery_type === 'distributed'} onChange={e => setFormData({...formData, delivery_type: e.target.value})} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 600 }}>Verteilt</div>
                    <div style={{ fontSize: '13px', opacity: 0.7 }}>Täglich 1-2 Leads</div>
                  </label>
                </div>
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
