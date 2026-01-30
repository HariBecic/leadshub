'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Eye, Download, Send, Check } from 'lucide-react'

export default function RechnungenPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [formData, setFormData] = useState({
    broker_id: '',
    type: 'single',
    amount: '',
    description: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('*, broker:brokers(name, email)')
      .order('created_at', { ascending: false })
    
    const { data: brokersData } = await supabase
      .from('brokers')
      .select('*')
      .eq('status', 'active')
    
    setInvoices(invoicesData || [])
    setBrokers(brokersData || [])
    setLoading(false)
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault()
    
    // Generate invoice number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
    
    const invoiceNumber = `${year}-${String((count || 0) + 1).padStart(4, '0')}`
    
    const { error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      broker_id: formData.broker_id,
      type: formData.type,
      amount: parseFloat(formData.amount) || 0,
      description: formData.description,
      status: 'pending',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 Tage
    })

    if (error) {
      alert('Fehler: ' + error.message)
      return
    }

    setShowModal(false)
    setFormData({ broker_id: '', type: 'single', amount: '', description: '' })
    loadData()
  }

  async function markAsPaid(invoiceId: string) {
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId)
    
    // TODO: If fixpreis invoice, send leads now
    loadData()
  }

  async function sendInvoice(invoiceId: string) {
    const res = await fetch('/api/invoices/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoiceId })
    })
    
    const data = await res.json()
    if (data.success) {
      alert('Rechnung wurde per E-Mail gesendet')
      loadData()
    } else {
      alert('Fehler: ' + (data.error || 'Unbekannt'))
    }
  }

  function openDetail(invoice: any) {
    setSelectedInvoice(invoice)
    setShowDetailModal(true)
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <span className="badge badge-success">Bezahlt</span>
      case 'pending': return <span className="badge badge-warning">Offen</span>
      case 'sent': return <span className="badge badge-info">Gesendet</span>
      case 'overdue': return <span className="badge badge-danger">Überfällig</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  const typeBadge = (type: string) => {
    switch (type) {
      case 'single': return <span className="badge" style={{ background: 'rgba(251,191,36,0.2)', color: '#fde047' }}>Einzelkauf</span>
      case 'fixed': return <span className="badge" style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac' }}>Fixpreis</span>
      case 'subscription': return <span className="badge" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>Abo</span>
      case 'commission': return <span className="badge" style={{ background: 'rgba(167,139,250,0.2)', color: '#c4b5fd' }}>Provision</span>
      case 'package': return <span className="badge" style={{ background: 'rgba(236,72,153,0.2)', color: '#f9a8d4' }}>Paket</span>
      default: return <span className="badge badge-neutral">{type}</span>
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  // Stats
  const totalOpen = invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((sum, i) => sum + Number(i.amount || 0), 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rechnungen</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={18} /> Neue Rechnung
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', opacity: 0.7 }}>Offene Rechnungen</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#fde047' }}>CHF {totalOpen.toFixed(2)}</div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', opacity: 0.7 }}>Bezahlt (Total)</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#86efac' }}>CHF {totalPaid.toFixed(2)}</div>
        </div>
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
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                    Noch keine Rechnungen
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                    <td>{inv.broker?.name || '-'}</td>
                    <td>{typeBadge(inv.type)}</td>
                    <td style={{ fontWeight: 600 }}>CHF {Number(inv.amount || 0).toFixed(2)}</td>
                    <td style={{ opacity: 0.7 }}>{new Date(inv.created_at).toLocaleDateString('de-CH')}</td>
                    <td>{statusBadge(inv.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => openDetail(inv)} className="btn btn-sm btn-secondary" title="Details">
                          <Eye size={16} />
                        </button>
                        {inv.status === 'pending' && (
                          <>
                            <button onClick={() => sendInvoice(inv.id)} className="btn btn-sm btn-secondary" title="Senden">
                              <Send size={16} />
                            </button>
                            <button onClick={() => markAsPaid(inv.id)} className="btn btn-sm btn-accent" title="Als bezahlt markieren">
                              <Check size={16} />
                            </button>
                          </>
                        )}
                        {inv.status === 'sent' && (
                          <button onClick={() => markAsPaid(inv.id)} className="btn btn-sm btn-accent" title="Als bezahlt markieren">
                            <Check size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Neue Rechnung</h2>
            <p style={{ opacity: 0.7, marginBottom: '20px' }}>Manuelle Rechnung erstellen</p>
            
            <form onSubmit={createInvoice}>
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
                <label className="input-label">Typ</label>
                <select 
                  className="input" 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="single">Einzelkauf</option>
                  <option value="fixed">Fixpreis</option>
                  <option value="subscription">Abo</option>
                  <option value="commission">Provision</option>
                  <option value="package">Paket</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Betrag (CHF)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="input" 
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: e.target.value})} 
                  required 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Beschreibung</label>
                <textarea 
                  className="input" 
                  rows={3}
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="z.B. 10 Leads Krankenkasse Januar 2026"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Erstellen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ marginBottom: '4px' }}>Rechnung {selectedInvoice.invoice_number}</h2>
                <div style={{ opacity: 0.7 }}>{selectedInvoice.broker?.name}</div>
              </div>
              {statusBadge(selectedInvoice.status)}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.7 }}>Typ</span>
                  {typeBadge(selectedInvoice.type)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.7 }}>Betrag</span>
                  <span style={{ fontWeight: 700, fontSize: '20px' }}>CHF {Number(selectedInvoice.amount || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.7 }}>Erstellt</span>
                  <span>{new Date(selectedInvoice.created_at).toLocaleDateString('de-CH')}</span>
                </div>
                {selectedInvoice.due_date && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.7 }}>Fällig</span>
                    <span>{new Date(selectedInvoice.due_date).toLocaleDateString('de-CH')}</span>
                  </div>
                )}
                {selectedInvoice.paid_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.7 }}>Bezahlt am</span>
                    <span style={{ color: '#86efac' }}>{new Date(selectedInvoice.paid_at).toLocaleDateString('de-CH')}</span>
                  </div>
                )}
              </div>
            </div>

            {selectedInvoice.description && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '8px' }}>Beschreibung</div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px' }}>
                  {selectedInvoice.description}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDetailModal(false)}>Schliessen</button>
              {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'sent') && (
                <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => { markAsPaid(selectedInvoice.id); setShowDetailModal(false) }}>
                  <Check size={16} /> Als bezahlt markieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
