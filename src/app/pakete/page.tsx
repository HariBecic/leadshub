'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Package, Play, CheckCircle, Clock, Eye } from 'lucide-react'

interface LeadPackage {
  id: string
  broker_id: string
  broker?: { name: string }
  category_id?: string
  category?: { name: string }
  name: string
  total_leads: number
  delivered_leads: number
  price: number
  distribution_type: 'instant' | 'distributed'
  leads_per_day: number
  status: string
  invoice_id?: string
  start_date?: string
  next_delivery_date?: string
  created_at: string
}

export default function PaketePage() {
  const [packages, setPackages] = useState<LeadPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { loadPackages() }, [])

  async function loadPackages() {
    const { data } = await supabase
      .from('lead_packages')
      .select('*, broker:brokers(name), category:lead_categories(name)')
      .order('created_at', { ascending: false })
    setPackages(data || [])
    setLoading(false)
  }

  async function markAsPaid(pkg: LeadPackage) {
    // Update package status
    const now = new Date()
    const updateData: any = {
      status: pkg.distribution_type === 'instant' ? 'active' : 'paid',
      paid_at: now.toISOString()
    }

    if (pkg.distribution_type === 'distributed') {
      // Calculate next business day
      let nextDate = new Date(now)
      nextDate.setDate(nextDate.getDate() + 1)
      while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
        nextDate.setDate(nextDate.getDate() + 1)
      }
      updateData.status = 'active'
      updateData.start_date = now.toISOString().split('T')[0]
      updateData.next_delivery_date = nextDate.toISOString().split('T')[0]
    }

    await supabase
      .from('lead_packages')
      .update(updateData)
      .eq('id', pkg.id)

    // Update invoice if exists
    if (pkg.invoice_id) {
      await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: now.toISOString() })
        .eq('id', pkg.invoice_id)
    }

    // If instant delivery, trigger lead assignment
    if (pkg.distribution_type === 'instant') {
      await fetch('/api/packages/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkg.id, count: pkg.total_leads })
      })
    }

    loadPackages()
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="badge badge-warning">Warte auf Zahlung</span>
      case 'paid': return <span className="badge badge-info">Bezahlt</span>
      case 'active': return <span className="badge badge-success">Aktiv</span>
      case 'completed': return <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>Abgeschlossen</span>
      case 'cancelled': return <span className="badge badge-danger">Storniert</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  const typeBadge = (type: string) => {
    if (type === 'instant') {
      return <span className="badge badge-accent">Sofort</span>
    }
    return <span className="badge badge-info">Verteilt</span>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lead-Pakete</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={20} />Neues Paket
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        ) : packages.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <Package size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <div>Noch keine Pakete vorhanden</div>
          </div>
        ) : (
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
                  <td style={{ fontWeight: 600 }}>{pkg.name}</td>
                  <td>{pkg.broker?.name}</td>
                  <td>{pkg.category?.name || '-'}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{pkg.delivered_leads}</span>
                    <span style={{ color: '#64748b' }}> / {pkg.total_leads}</span>
                  </td>
                  <td>{typeBadge(pkg.distribution_type)}</td>
                  <td style={{ fontWeight: 600 }}>CHF {Number(pkg.price).toFixed(2)}</td>
                  <td>{statusBadge(pkg.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {pkg.status === 'pending' && (
                        <button 
                          onClick={() => markAsPaid(pkg)}
                          className="btn btn-sm"
                          style={{ background: '#dcfce7', color: '#166534' }}
                        >
                          Bezahlt
                        </button>
                      )}
                      {pkg.status === 'active' && pkg.distribution_type === 'distributed' && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Nächste: {pkg.next_delivery_date ? new Date(pkg.next_delivery_date).toLocaleDateString('de-CH') : '-'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewPackageModal 
          onClose={() => setShowModal(false)} 
          onSave={() => { setShowModal(false); loadPackages() }} 
        />
      )}
    </div>
  )
}

function NewPackageModal(props: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [brokers, setBrokers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({
    broker_id: '',
    category_id: '',
    name: '',
    total_leads: 20,
    price: 500,
    distribution_type: 'instant',
    leads_per_day: 1
  })
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: brokersData } = await supabase.from('brokers').select('*').eq('status', 'active')
    const { data: categoriesData } = await supabase.from('lead_categories').select('*')
    setBrokers(brokersData || [])
    setCategories(categoriesData || [])
    if (brokersData && brokersData.length > 0) {
      setForm(f => ({ ...f, broker_id: brokersData[0].id }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/packages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      
      if (data.success) {
        props.onSave()
      } else {
        setError(data.error || 'Fehler beim Erstellen')
      }
    } catch {
      setError('Netzwerkfehler')
    }
    setLoading(false)
  }

  const pricePerLead = form.total_leads > 0 ? (form.price / form.total_leads).toFixed(2) : '0.00'

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Neues Lead-Paket</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>Erstelle ein Paket-Angebot für einen Broker</p>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Broker</label>
            <select 
              value={form.broker_id} 
              onChange={(e) => setForm({...form, broker_id: e.target.value})} 
              className="select"
              required
            >
              <option value="">Broker wählen...</option>
              {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Kategorie</label>
            <select 
              value={form.category_id} 
              onChange={(e) => setForm({...form, category_id: e.target.value})} 
              className="select"
            >
              <option value="">Alle Kategorien</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Paket-Name</label>
            <input 
              value={form.name} 
              onChange={(e) => setForm({...form, name: e.target.value})} 
              className="input"
              placeholder="z.B. 20 Krankenkassen-Leads"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="input-label">Anzahl Leads</label>
              <input 
                type="number" 
                value={form.total_leads} 
                onChange={(e) => setForm({...form, total_leads: parseInt(e.target.value) || 0})} 
                className="input"
                min="1"
                required
              />
            </div>
            <div>
              <label className="input-label">Paket-Preis (CHF)</label>
              <input 
                type="number" 
                value={form.price} 
                onChange={(e) => setForm({...form, price: parseFloat(e.target.value) || 0})} 
                className="input"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
            <span style={{ color: '#166534', fontWeight: 600 }}>= CHF {pricePerLead} pro Lead</span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Lieferung</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ 
                flex: 1, 
                padding: '16px', 
                border: form.distribution_type === 'instant' ? '2px solid #F26444' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                background: form.distribution_type === 'instant' ? '#fff7ed' : 'white'
              }}>
                <input 
                  type="radio" 
                  name="distribution" 
                  checked={form.distribution_type === 'instant'}
                  onChange={() => setForm({...form, distribution_type: 'instant'})}
                  style={{ display: 'none' }}
                />
                <div style={{ fontWeight: 600, color: '#1e293b' }}>Sofort</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Alle Leads auf einmal</div>
              </label>
              <label style={{ 
                flex: 1, 
                padding: '16px', 
                border: form.distribution_type === 'distributed' ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                borderRadius: '10px',
                cursor: 'pointer',
                background: form.distribution_type === 'distributed' ? '#eff6ff' : 'white'
              }}>
                <input 
                  type="radio" 
                  name="distribution" 
                  checked={form.distribution_type === 'distributed'}
                  onChange={() => setForm({...form, distribution_type: 'distributed'})}
                  style={{ display: 'none' }}
                />
                <div style={{ fontWeight: 600, color: '#1e293b' }}>Verteilt</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Über Arbeitstage verteilt</div>
              </label>
            </div>
          </div>

          {form.distribution_type === 'distributed' && (
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Leads pro Tag</label>
              <input 
                type="number" 
                value={form.leads_per_day} 
                onChange={(e) => setForm({...form, leads_per_day: parseInt(e.target.value) || 1})} 
                className="input"
                min="1"
              />
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Dauer: ca. {Math.ceil(form.total_leads / form.leads_per_day)} Arbeitstage
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Wird erstellt...' : 'Paket erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
