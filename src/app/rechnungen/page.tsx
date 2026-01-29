'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Eye, Lock } from 'lucide-react'

export default function RechnungenPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    broker_id: '', amount: '', description: '', type: 'single'
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('*, broker:brokers(name)')
      .order('created_at', { ascending: false })
    const { data: brokersData } = await supabase.from('brokers').select('*').eq('is_active', true)
    
    setInvoices(invoicesData || [])
    setBrokers(brokersData || [])
    setLoading(false)
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault()
    
    const year = new Date().getFullYear()
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).like('invoice_number', `${year}-%`)
    const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`
    
    await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      broker_id: formData.broker_id,
      amount: parseFloat(formData.amount),
      description: formData.description,
      type: formData.type,
      status: 'pending'
    })
    
    setShowModal(false)
    setFormData({ broker_id: '', amount: '', description: '', type: 'single' })
    loadData()
  }

  async function markAsPaid(invoiceId: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId)
    
    // Check if this unlocks leads
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
    if (invoice?.type === 'single' && invoice?.lead_assignment_id) {
      await fetch('/api/send-unlock-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: invoice.lead_assignment_id })
      })
    }
    
    loadData()
  }

  async function downloadPdf(invoiceId: string) {
    const res = await fetch(`/api/invoice/generate?id=${invoiceId}`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rechnung-${invoiceId}.pdf`
    a.click()
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rechnungen</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Neue Rechnung
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Broker</th>
                <th>Typ</th>
                <th>Betrag</th>
                <th>Datum</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                  <td>{inv.broker?.name}</td>
                  <td>
                    <span className={`badge ${inv.type === 'commission' ? 'badge-accent' : 'badge-info'}`}>
                      {inv.type === 'commission' ? 'Provision' : inv.type === 'package' ? 'Paket' : 'Einzelkauf'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>CHF {Number(inv.amount).toFixed(2)}</td>
                  <td style={{ opacity: 0.7 }}>{new Date(inv.created_at).toLocaleDateString('de-CH')}</td>
                  <td>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                      {inv.status === 'paid' ? 'Bezahlt' : 'Offen'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => downloadPdf(inv.id)} className="btn btn-sm btn-secondary">
                        <Eye size={16} />
                      </button>
                      {inv.status === 'pending' && (
                        <button onClick={() => markAsPaid(inv.id)} className="btn btn-sm btn-primary">
                          <Lock size={16} /> Bezahlt
                        </button>
                      )}
                    </div>
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
            <h2>Neue Rechnung</h2>
            <form onSubmit={createInvoice} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Broker</label>
                <select className="input" value={formData.broker_id} onChange={e => setFormData({...formData, broker_id: e.target.value})} required>
                  <option value="">-- Auswählen --</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Typ</label>
                <select className="input" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="single">Einzelkauf</option>
                  <option value="package">Paket</option>
                  <option value="commission">Provision</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Betrag (CHF)</label>
                <input type="number" step="0.01" className="input" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Beschreibung</label>
                <textarea className="input" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
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
