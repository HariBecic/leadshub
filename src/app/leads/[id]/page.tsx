'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Lead, LeadAssignment, Broker } from '@/lib/supabase'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, User, Tag } from 'lucide-react'

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [assignments, setAssignments] = useState<LeadAssignment[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)

  useEffect(() => { loadData() }, [params.id])

  async function loadData() {
    const { data: leadData } = await supabase
      .from('leads')
      .select('*, category:lead_categories(*), source:lead_sources(*)')
      .eq('id', params.id)
      .single()
    setLead(leadData)

    const { data: assignmentsData } = await supabase
      .from('lead_assignments')
      .select('*, broker:brokers(*)')
      .eq('lead_id', params.id)
      .order('assigned_at', { ascending: false })
    setAssignments(assignmentsData || [])

    const { data: brokersData } = await supabase
      .from('brokers')
      .select('*')
      .eq('status', 'active')
    setBrokers(brokersData || [])

    setLoading(false)
  }

  async function deleteLead() {
    if (!confirm('Lead wirklich löschen?')) return
    await supabase.from('leads').delete().eq('id', params.id)
    router.push('/leads')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  if (!lead) return <div>Lead nicht gefunden</div>

  const statusBadge = (status: string) => {
    switch (status) {
      case 'new': return <span className="badge badge-success">Neu</span>
      case 'assigned': return <span className="badge badge-warning">Zugewiesen</span>
      case 'closed': return <span className="badge badge-info">Abgeschlossen</span>
      case 'available': return <span className="badge badge-neutral">Verfügbar</span>
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  return (
    <div>
      <Link href="/leads" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={20} />Zurück
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte - Lead Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{lead.first_name} {lead.last_name}</h1>
                <p className="text-gray-500">Lead #{lead.lead_number}</p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(lead.status)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lead.email && (
                <div className="flex items-center gap-3">
                  <Mail className="text-gray-400" size={20} />
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="text-gray-400" size={20} />
                  <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a>
                </div>
              )}
              {(lead.plz || lead.ort) && (
                <div className="flex items-center gap-3">
                  <MapPin className="text-gray-400" size={20} />
                  <span>{lead.plz} {lead.ort}</span>
                </div>
              )}
              {lead.category && (
                <div className="flex items-center gap-3">
                  <Tag className="text-gray-400" size={20} />
                  <span className="badge badge-neutral">{(lead.category as any).name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Extra Data */}
          {lead.extra_data && Object.keys(lead.extra_data).length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Zusätzliche Informationen</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(lead.extra_data).map(([key, value]) => {
                  if (['first_name', 'last_name', 'email', 'phone', 'plz', 'ort', 'category'].includes(key)) return null
                  if (!value) return null
                  return (
                    <div key={key} className="border-b border-gray-100 pb-2">
                      <div className="text-sm text-gray-500">{key.replace(/_/g, ' ')}</div>
                      <div className="font-medium">{String(value)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Zuweisungs-Historie */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Zuweisungs-Historie</h2>
            {assignments.length === 0 ? (
              <p className="text-gray-500 text-sm">Noch keine Zuweisungen</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{(a.broker as any)?.name}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(a.assigned_at).toLocaleDateString('de-CH')} - {new Date(a.assigned_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      {a.price_charged && <div className="font-medium">CHF {a.price_charged}</div>}
                      <span className={`badge ${a.status === 'sent' ? 'badge-warning' : a.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                        {a.status === 'sent' ? 'Gesendet' : a.status === 'success' ? 'Erfolgreich' : 'Zurück'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rechte Spalte - Aktionen */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Aktionen</h2>
            <div className="space-y-3">
              {(lead.status === 'new' || lead.status === 'available') && (
                <button onClick={() => setShowAssignModal(true)} className="btn btn-primary w-full">
                  Lead zuweisen
                </button>
              )}
              <button onClick={deleteLead} className="btn btn-ghost w-full text-red-500">
                Lead löschen
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Erstellt</span>
                <span>{new Date(lead.created_at).toLocaleDateString('de-CH')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quelle</span>
                <span>{(lead.source as any)?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ownership</span>
                <span>{lead.ownership === 'sold' ? 'Verkauft' : 'Verwaltet'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Zuweisungen</span>
                <span>{lead.assignment_count}x</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && (
        <AssignModal 
          lead={lead} 
          brokers={brokers} 
          onClose={() => setShowAssignModal(false)} 
          onSave={() => { setShowAssignModal(false); loadData() }} 
        />
      )}
    </div>
  )
}

function AssignModal(props: { lead: Lead; brokers: Broker[]; onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [brokerId, setBrokerId] = useState(props.brokers[0]?.id || '')
  const [price, setPrice] = useState(35)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('lead_assignments').insert([{ 
      lead_id: props.lead.id, 
      broker_id: brokerId, 
      status: 'sent', 
      price_charged: price 
    }])
    await supabase.from('leads').update({ 
      status: 'assigned', 
      ownership: 'sold',
      assignment_count: props.lead.assignment_count + 1
    }).eq('id', props.lead.id)
    setLoading(false)
    props.onSave()
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Lead zuweisen</h2>
        <p className="mb-4 text-gray-600">{props.lead.first_name} {props.lead.last_name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Broker</label>
            <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className="select">
              {props.brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Preis (CHF)</label>
            <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} className="input" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '...' : 'Zuweisen'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
// force rebuild

