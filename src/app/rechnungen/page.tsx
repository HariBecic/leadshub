'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Eye, Unlock } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  broker_id: string
  broker?: { name: string; email: string }
  type: string
  status: string
  amount: number
  period_start?: string
  period_end?: string
  due_date?: string
  created_at: string
}

export default function RechnungenPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [unlocking, setUnlocking] = useState<string | null>(null)

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    const { data } = await supabase
      .from('invoices')
      .select('*, broker:brokers(name, email)')
      .order('created_at', { ascending: false })
    setInvoices(data || [])
    setLoading(false)
  }

  async function markAsPaid(invoice: Invoice) {
    setUnlocking(invoice.id)
    
    // Update invoice status
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoice.id)

    // If single purchase, unlock the lead
    if (invoice.type === 'single') {
      // Get the assignment from invoice items
      const { data: items } = await supabase
        .from('invoice_items')
        .select('lead_assignment_id')
        .eq('invoice_id', invoice.id)

      if (items && items.length > 0) {
        for (const item of items) {
          if (item.lead_assignment_id) {
            // Unlock the assignment
            await supabase
              .from('lead_assignments')
              .update({ unlocked: true })
              .eq('id', item.lead_assignment_id)

            // Send unlock email
            await fetch('/api/send-unlock-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assignment_id: item.lead_assignment_id })
            })
          }
        }
      }
    }

    setUnlocking(null)
    loadInvoices()
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="badge badge-warning">Offen</span>
      case 'paid': return <span className="badge badge-success">Bezahlt</span>
      case 'cancelled': return <span className="badge badge-danger">Storniert</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  const typeBadge = (type: string) => {
    switch (type) {
      case 'single': return <span className="badge badge-info">Einzelkauf</span>
      case 'subscription': return <span className="badge badge-accent">Abo</span>
      case 'commission': return <span className="badge" style={{ background: '#f3e8ff', color: '#7c3aed' }}>Provision</span>
      default: return <span className="badge badge-neutral">{type}</span>
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rechnungen</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={20} />Neue Rechnung
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Noch keine Rechnungen vorhanden
          </div>
        ) : (
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
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td style={{ fontWeight: 600 }}>{invoice.invoice_number}</td>
                  <td>{invoice.broker?.name}</td>
                  <td>{typeBadge(invoice.type)}</td>
                  <td style={{ fontWeight: 600 }}>CHF {Number(invoice.amount).toFixed(2)}</td>
                  <td style={{ color: '#64748b' }}>{new Date(invoice.created_at).toLocaleDateString('de-CH')}</td>
                  <td>{statusBadge(invoice.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a 
                        href={`/api/invoice/${invoice.id}`} 
                        target="_blank"
                        className="btn btn-secondary btn-sm"
                        title="Anzeigen"
                      >
                        <Eye size={16} />
                      </a>
                      {invoice.status === 'pending' && (
                        <button 
                          onClick={() => markAsPaid(invoice)}
                          disabled={unlocking === invoice.id}
                          className="btn btn-sm"
                          style={{ background: '#dcfce7', color: '#166534' }}
                        >
                          {unlocking === invoice.id ? '...' : (
                            <>
                              {invoice.type === 'single' && <Unlock size={14} style={{ marginRight: '4px' }} />}
                              Bezahlt
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <NewInvoiceModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadInvoices() }} />}
    </div>
  )
}

function NewInvoiceModal(props: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [brokers, setBrokers] = useState<any[]>([])
  const [brokerId, setBrokerId] = useState('')
  const [type, setType] = useState('subscription')
  const [error, setError] = useState('')

  useEffect(() => {
    loadBrokers()
  }, [])

  async function loadBrokers() {
    const { data } = await supabase.from('brokers').select('*').eq('status', 'active')
    setBrokers(data || [])
    if (data && data.length > 0) setBrokerId(data[0].id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker_id: brokerId, type })
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

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Neue Rechnung erstellen</h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>Wähle Broker und Rechnungstyp</p>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Broker</label>
            <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className="select">
              {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="input-label">Rechnungstyp</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="select">
              <option value="subscription">Abo (monatlich)</option>
              <option value="commission">Provisionen (monatlich)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Wird erstellt...' : 'Rechnung erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
