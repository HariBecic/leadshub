'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Lead, LeadAssignment, Broker } from '@/lib/supabase'
import { ArrowLeft, Mail, Phone, MapPin, Tag, User, Shield } from 'lucide-react'

interface Contract {
  id: string
  pricing_model: string
  price_per_lead: number | null
  revenue_share_percent: number | null
  monthly_fee: number | null
}

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
    const { data: leadData } = await supabase.from('leads').select('*, category:lead_categories(*), source:lead_sources(*)').eq('id', params.id).single()
    setLead(leadData)
    const { data: assignmentsData } = await supabase.from('lead_assignments').select('*, broker:brokers(*)').eq('lead_id', params.id).order('assigned_at', { ascending: false })
    setAssignments(assignmentsData || [])
    const { data: brokersData } = await supabase.from('brokers').select('*').eq('status', 'active')
    setBrokers(brokersData || [])
    setLoading(false)
  }

  async function deleteLead() {
    if (!confirm('Lead wirklich loeschen?')) return
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
      default: return <span className="badge badge-neutral">{status}</span>
    }
  }

  const extraData = lead.extra_data || {}
  const baseFields = ['first_name', 'last_name', 'email', 'phone', 'plz', 'ort', 'category']
  
  const formatLabel = (key: string) => {
    return key.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein'
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {value.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              {typeof item === 'object' ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(item).map(([k, v]) => {
                    if (!v || v === '') return null
                    return (
                      <div key={k}>
                        <span className="text-xs text-gray-500">{formatLabel(k)}:</span>
                        <span className="ml-1 text-sm font-medium">{String(v)}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span>{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      )
    }
    if (typeof value === 'object') {
      return (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(value).map(([k, v]) => {
              if (!v || v === '') return null
              return (
                <div key={k}>
                  <span className="text-xs text-gray-500">{formatLabel(k)}:</span>
                  <span className="ml-1 text-sm font-medium">{String(v)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return String(value)
  }

  const filteredExtraData = Object.entries(extraData).filter(([key, value]) => {
    if (baseFields.includes(key)) return false
    if (value === null || value === undefined || value === '') return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  })

  const personsData = filteredExtraData.filter(([key]) => key === 'persons' || key === 'people')
  const otherData = filteredExtraData.filter(([key]) => key !== 'persons' && key !== 'people' && key !== 'extra_data')
  const nestedExtra = extraData.extra_data ? Object.entries(extraData.extra_data as Record<string, unknown>).filter(([, v]) => v && v !== '') : []

  const formatPricing = (a: any) => {
    if (a.pricing_model === 'revenue_share') {
      return <span className="text-purple-600 font-medium">{a.revenue_share_percent}% Beteiligung</span>
    } else if (a.pricing_model === 'subscription') {
      return <span className="text-blue-600 font-medium">Abo</span>
    } else {
      return <span className="font-medium">CHF {a.price_charged}</span>
    }
  }

  return (
    <div>
      <Link href="/leads" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={20} />Zurueck
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{lead.first_name} {lead.last_name}</h1>
                <p className="text-gray-500">Lead #{lead.lead_number}</p>
              </div>
              <div>{statusBadge(lead.status)}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lead.email && <div className="flex items-center gap-3"><Mail className="text-gray-400" size={20} /><a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a></div>}
              {lead.phone && <div className="flex items-center gap-3"><Phone className="text-gray-400" size={20} /><a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a></div>}
              {(lead.plz || lead.ort) && <div className="flex items-center gap-3"><MapPin className="text-gray-400" size={20} /><span>{lead.plz} {lead.ort}</span></div>}
              {lead.category && <div className="flex items-center gap-3"><Tag className="text-gray-400" size={20} /><span className="badge badge-info">{(lead.category as any)?.name}</span></div>}
            </div>
          </div>

          {personsData.length > 0 && personsData.map(([key, value]) => (
            <div key={key} className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="text-gray-400" size={20} />Versicherte Personen
              </h2>
              {renderValue(value)}
            </div>
          ))}

          {(otherData.length > 0 || nestedExtra.length > 0) && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="text-gray-400" size={20} />Anfrage-Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherData.map(([key, value]) => {
                  const rendered = renderValue(value)
                  if (!rendered) return null
                  return (
                    <div key={key} className="border-b border-gray-100 pb-2">
                      <div className="text-sm text-gray-500">{formatLabel(key)}</div>
                      <div className="font-medium">{rendered}</div>
                    </div>
                  )
                })}
                {nestedExtra.map(([key, value]) => {
                  const rendered = renderValue(value)
                  if (!rendered) return null
                  return (
                    <div key={key} className="border-b border-gray-100 pb-2">
                      <div className="text-sm text-gray-500">{formatLabel(key)}</div>
                      <div className="font-medium">{rendered}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Zuweisungs-Historie</h2>
            {assignments.length === 0 ? (
              <p className="text-gray-500 text-sm">Noch keine Zuweisungen</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{a.broker?.name}</div>
                      <div className="text-sm text-gray-500">{new Date(a.assigned_at).toLocaleDateString('de-CH')}</div>
                    </div>
                    <div className="text-right">
                      {formatPricing(a)}
                      <div className="mt-1">
                        <span className={`badge ${a.status === 'sent' ? 'badge-warning' : a.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                          {a.status === 'sent' ? 'Gesendet' : a.status === 'success' ? 'Erfolgreich' : 'Zurueck'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Aktionen</h2>
            <div className="space-y-3">
              {(lead.status === 'new' || lead.status === 'available') && (
                <button onClick={() => setShowAssignModal(true)} className="btn btn-primary w-full">Lead zuweisen</button>
              )}
              <button onClick={deleteLead} className="btn btn-ghost w-full text-red-500">Lead loeschen</button>
            </div>
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Erstellt</span><span>{new Date(lead.created_at).toLocaleDateString('de-CH')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Quelle</span><span>{(lead.source as any)?.name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Zuweisungen</span><span>{lead.assignment_count}x</span></div>
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && <AssignModal lead={lead} brokers={brokers} onClose={() => setShowAssignModal(false)} onSave={() => { setShowAssignModal(false); loadData() }} />}
    </div>
  )
}

function AssignModal(props: { lead: Lead; brokers: Broker[]; onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [brokerId, setBrokerId] = useState(props.brokers[0]?.id || '')
  const [price, setPrice] = useState(35)
  const [contract, setContract] = useState<Contract | null>(null)
  const [loadingContract, setLoadingContract] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; email_sent?: boolean; error?: string } | null>(null)

  // Load contract when broker changes
  useEffect(() => {
    loadContract(brokerId)
  }, [brokerId, props.lead.category_id])

  async function loadContract(broker_id: string) {
    if (!broker_id) return
    setLoadingContract(true)
    
    // Try category-specific contract first
    let { data: contractData } = await supabase
      .from('contracts')
      .select('*')
      .eq('broker_id', broker_id)
      .eq('category_id', props.lead.category_id)
      .eq('status', 'active')
      .single()

    // If no category-specific, try general contract
    if (!contractData) {
      const { data: generalContract } = await supabase
        .from('contracts')
        .select('*')
        .eq('broker_id', broker_id)
        .is('category_id', null)
        .eq('status', 'active')
        .single()
      contractData = generalContract
    }

    setContract(contractData)
    setLoadingContract(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead_id: props.lead.id, 
          broker_id: brokerId, 
          price: contract ? undefined : price // Only send price if no contract
        })
      })
      const data = await res.json()
      
      if (data.success) {
        setResult({ success: true, email_sent: data.email_sent })
        setTimeout(() => props.onSave(), 1500)
      } else {
        setResult({ error: data.error || 'Fehler beim Zuweisen' })
      }
    } catch {
      setResult({ error: 'Netzwerkfehler' })
    }
    setLoading(false)
  }

  const renderContractInfo = () => {
    if (loadingContract) {
      return <div className="text-gray-500 text-sm">Lade Vertrag...</div>
    }
    if (!contract) {
      return (
        <div>
          <div className="mb-2 p-2 bg-yellow-50 text-yellow-700 rounded text-sm">
            Kein aktiver Vertrag gefunden
          </div>
          <label className="input-label">Preis (CHF)</label>
          <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} className="input" />
        </div>
      )
    }
    
    if (contract.pricing_model === 'revenue_share') {
      return (
        <div className="p-3 bg-purple-50 text-purple-700 rounded-lg">
          <div className="font-medium">Beteiligungsvertrag</div>
          <div className="text-lg">{contract.revenue_share_percent}% bei Abschluss</div>
        </div>
      )
    } else if (contract.pricing_model === 'subscription') {
      return (
        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
          <div className="font-medium">Abo-Vertrag</div>
          <div className="text-lg">CHF {contract.monthly_fee}/Monat</div>
        </div>
      )
    } else {
      return (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg">
          <div className="font-medium">Fixpreis-Vertrag</div>
          <div className="text-lg">CHF {contract.price_per_lead} pro Lead</div>
        </div>
      )
    }
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Lead zuweisen</h2>
        <p className="mb-4 text-gray-600">{props.lead.first_name} {props.lead.last_name}</p>
        
        {result?.success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg">
            Lead erfolgreich zugewiesen! {result.email_sent ? 'E-Mail wurde gesendet.' : 'E-Mail konnte nicht gesendet werden.'}
          </div>
        )}
        
        {result?.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{result.error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Broker</label>
            <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className="select">
              {props.brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="input-label">Preismodell</label>
            {renderContractInfo()}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={props.onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading || result?.success} className="btn btn-primary">
              {loading ? 'Wird zugewiesen...' : 'Zuweisen & E-Mail senden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
