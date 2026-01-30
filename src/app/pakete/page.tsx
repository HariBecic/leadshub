'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Package } from 'lucide-react'
import Link from 'next/link'

export default function PaketePage() {
  const [packages, setPackages] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    broker_id: '',
    category_id: '',
    total_leads: 10,
    price: 500,
    distribution_type: 'instant',
    leads_per_day: 2
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: packagesData } = await supabase
      .from('lead_packages')
      .select('*, broker:brokers(name), category:lead_categories(name)')
      .order('created_at', { ascending: false })
    
    const { data: brokersData } = await supabase
      .from('brokers')
      .select('*')
      .eq('status', 'active')
    
    const { data: categoriesData } = await supabase
      .from('lead_categories')
      .select('*')
      .order('name')
    
    setPackages(packagesData || [])
    setBrokers(brokersData || [])
    setCategories(categoriesData || [])
    setLoading(false)
  }

  async function createPackage(e: React.FormEvent) {
    e.preventDefault()
    
    const { error } = await supabase.from('lead_packages').insert({
      name: formData.name,
      broker_id: formData.broker_id,
      category_id: formData.category_id || null,
      total_leads: formData.total_leads,
      delivered_leads: 0,
      price: formData.price,
      distribution_type: formData.distribution_type,
      leads_per_day: formData.distribution_type === 'distributed' ? formData.leads_per_day : null,
      status: 'active'
    })

    if (error) {
      alert('Fehler: ' + error.message)
      return
    }

    setShowModal(false)
    setFormData({
      name: '',
      broker_id: '',
      category_id: '',
      total_leads: 10,
      price: 500,
      distribution_type: 'instant',
      leads_per_day: 2
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
              </tr>
            </thead>
            <tbody>
              {packages.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                    Noch keine Pakete erstellt
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td style={{ fontWeight: 500 }}>{pkg.name}</td>
                    <td>{pkg.broker?.name || '-'}</td>
                    <td>{pkg.category?.name || 'Alle'}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: pkg.delivered_leads >= pkg.total_leads ? '#86efac' : '#fde047' }}>
                        {pkg.delivered_leads || 0}
                      </span>
                      <span style={{ opacity: 0.6 }}> / {pkg.total_leads}</span>
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {pkg.distribution_type === 'instant' ? 'Sofort' : `Verteilt (${pkg.leads_per_day}/Tag)`}
                      </span>
                    </td>
                    <td>CHF {Number(pkg.price || 0).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${
                        pkg.status === 'completed' ? 'badge-success' : 
                        pkg.status === 'active' ? 'badge-warning' : 'badge-neutral'
                      }`}>
                        {pkg.status === 'completed' ? 'Abgeschlossen' : 
                         pkg.status === 'active' ? 'Aktiv' : pkg.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Package Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Neues Paket</h2>
            
            <form onSubmit={createPackage} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Paketname</label>
                <input 
                  className="input" 
                  placeholder="z.B. 10er Paket"
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Broker</label>
                <select 
                  className="input" 
                  value={formData.broker_id} 
                  onChange={e => setFormData({...formData, broker_id: e.target.value})} 
                  required
                >
                  <option value="">-- Auswählen --</option>
                  {brokers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Kategorie (optional)</label>
                <select 
                  className="input" 
                  value={formData.category_id} 
                  onChange={e => setFormData({...formData, category_id: e.target.value})}
                >
                  <option value="">Alle Kategorien</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="input-label">Anzahl Leads</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={formData.total_leads} 
                    onChange={e => setFormData({...formData, total_leads: parseInt(e.target.value) || 0})} 
                    min="1"
                    required 
                  />
                </div>
                <div>
                  <label className="input-label">Preis (CHF)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input" 
                    value={formData.price} 
                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} 
                    min="0"
                    required 
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Lieferart</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ 
                    padding: '16px', 
                    border: formData.distribution_type === 'instant' ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)', 
                    borderRadius: '12px', 
                    cursor: 'pointer',
                    background: formData.distribution_type === 'instant' ? 'rgba(167, 139, 250, 0.1)' : 'transparent'
                  }}>
                    <input 
                      type="radio" 
                      name="distribution_type" 
                      checked={formData.distribution_type === 'instant'}
                      onChange={() => setFormData({...formData, distribution_type: 'instant'})}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontWeight: 600 }}>Sofort</div>
                    <div style={{ fontSize: '13px', opacity: 0.7 }}>Alle Leads auf einmal</div>
                  </label>
                  <label style={{ 
                    padding: '16px', 
                    border: formData.distribution_type === 'distributed' ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)', 
                    borderRadius: '12px', 
                    cursor: 'pointer',
                    background: formData.distribution_type === 'distributed' ? 'rgba(167, 139, 250, 0.1)' : 'transparent'
                  }}>
                    <input 
                      type="radio" 
                      name="distribution_type" 
                      checked={formData.distribution_type === 'distributed'}
                      onChange={() => setFormData({...formData, distribution_type: 'distributed'})}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontWeight: 600 }}>Verteilt</div>
                    <div style={{ fontSize: '13px', opacity: 0.7 }}>Täglich X Leads</div>
                  </label>
                </div>
              </div>

              {formData.distribution_type === 'distributed' && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="input-label">Leads pro Tag</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={formData.leads_per_day} 
                    onChange={e => setFormData({...formData, leads_per_day: parseInt(e.target.value) || 1})} 
                    min="1"
                    max="50"
                  />
                </div>
              )}

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
