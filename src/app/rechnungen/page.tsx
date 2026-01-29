'use client'

import { useEffect, useState } from 'react'
import { supabase, Invoice, Broker } from '@/lib/supabase'
import { Plus, Search, FileText, Mail, Download } from 'lucide-react'

export default function RechnungenPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [invRes, brkRes] = await Promise.all([
        supabase.from('invoices').select('*, broker:brokers(*)').order('created_at', { ascending: false }),
        supabase.from('brokers').select('*').eq('status', 'active'),
      ])
      setInvoices(invRes.data || [])
      setBrokers(brkRes.data || [])
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() }
      if (status === 'paid') updates.paid_at = new Date().toISOString()
      if (status === 'sent') updates.sent_at = new Date().toISOString()
      
      const { error } = await supabase.from('invoices').update(updates).eq('id', id)
      if (error) throw error
      loadData()
    } catch (error) { console.error('Error:', error) }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <span className="badge badge-neutral">Entwurf</span>
      case 'sent': return <span className="badge badge-warning">Gesendet</span>
      case 'paid': return <span className="badge badge-success">Bezahlt</span>
      case 'overdue': return <span className="badge badge-danger">Überfällig</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rechnungen</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus size={20} />Neue Rechnung</button>
      </div>

      {invoices.length === 0 ? (
        <div className="card empty-state">
          <FileText className="empty-state-icon mx-auto" size={48} />
          <p>Keine Rechnungen vorhanden</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary mt-4"><Plus size={20} />Erste Rechnung erstellen</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead><tr><th>Nr.</th><th>Broker</th><th>Betrag</th><th>Status</th><th>Erstellt</th><th></th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono">{inv.invoice_number}</td>
                  <td>{(inv.broker as any)?.name || '-'}</td>
                  <td className="font-medium">CHF {inv.total_amount.toFixed(2)}</td>
                  <td>{getStatusBadge(inv.status)}</td>
                  <td className="text-sm text-gray-500">{new Date(inv.created_at).toLocaleDateString('de-CH')}</td>
                  <td>
                    <div className="flex gap-2">
                      {inv.status === 'draft' && <button onClick={() => updateStatus(inv.id, 'sent')} className="btn btn-ghost text-xs"><Mail size={14} />Senden</button>}
                      {inv.status === 'sent' && <button onClick={() => updateStatus(inv.id, 'paid')} className="btn btn-ghost text-xs text-green-600">Als bezahlt</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <CreateInvoiceModal brokers={brokers} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadData() }} />}
    </div>
  )
}

function CreateInvoiceModal({ brokers, onClose, onSave }: { brokers: Broker[], onClose: () => void, onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    broker_id: brokers[0]?.id || '',
    subtotal: 0,
    description: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const vatRate = 8.1
      const vatAmount = formData.subtotal * (vatRate / 100)
      const totalAmount = formData.subtotal + vatAmount
      
      // Generate invoice number
      const year = new Date().getFullYear()
      const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).gte('created_at', `${year}-01-01`)
      const invoiceNumber = `LH-${year}-${String((count || 0) + 1).padStart(3, '0')}`
      
      const { error } = await supabase.from('invoices').insert([{
        broker_id: formData.broker_id,
        invoice_number: invoiceNumber,
        subtotal: formData.subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        status: 'draft',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }])
      if (error) throw error
      onSave()
    } catch (error) { console.error('Error:', error); alert('Fehler beim Erstellen') }
    finally { setLoading(false) }
  }

  const vatAmount = formData.subtotal * 0.081
  const total = formData.subtotal + vatAmount

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Neue Rechnung</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="input-label">Broker *</label><select required value={formData.broker_id} onChange={(e) => setFormData({ ...formData, broker_id: e.target.value })} className="select">{brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div><label className="input-label">Betrag (CHF, ohne MwSt) *</label><input type="number" required value={formData.subtotal} onChange={(e) => setFormData({ ...formData, subtotal: parseFloat(e.target.value) || 0 })} className="input" min="0" step="0.01" /></div>
          
          <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>CHF {formData.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-500"><span>MwSt 8.1%</span><span>CHF {vatAmount.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>CHF {total.toFixed(2)}</span></div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Erstellen...' : 'Rechnung erstellen'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
