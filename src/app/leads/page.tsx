'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Plus, Search, RefreshCw, Zap, Check, X, Users, ChevronDown } from 'lucide-react'

interface Lead {
  id: string
  lead_number: number
  first_name: string
  last_name: string
  email: string
  phone: string
  plz: string
  status: string
  created_at: string
  category?: {
    id: string
    name: string
    default_price?: number
  }
}

interface LeadCategory {
  id: string
  name: string
  default_price?: number
}

interface Broker {
  id: string
  name: string
  contact_person: string
  email: string
  status: string
  contracts?: any[]
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [categories, setCategories] = useState<LeadCategory[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'lead_number' | 'name'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [fetchingMeta, setFetchingMeta] = useState(false)
  
  // Multi-select
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [bulkBrokerId, setBulkBrokerId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  
  // Custom dropdown
  const [brokerDropdownOpen, setBrokerDropdownOpen] = useState(false)
  
  // For contract detection (like lead detail)
  const [selectedBrokerContract, setSelectedBrokerContract] = useState<any>(null)
  const [assignForm, setAssignForm] = useState({
    pricing_model: 'single',
    price_charged: '35',
    revenue_share_percent: '50'
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [leadsRes, categoriesRes, brokersRes] = await Promise.all([
        supabase.from('leads').select('*, category:lead_categories(id, name, default_price)').order('created_at', { ascending: false }),
        supabase.from('lead_categories').select('*'),
        supabase.from('brokers').select('*').eq('status', 'active')
      ])
      
      if (leadsRes.data) setLeads(leadsRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
      
      // Load contracts for each broker (like lead detail)
      if (brokersRes.data) {
        const brokersWithContracts = await Promise.all(brokersRes.data.map(async (broker) => {
          const { data: contracts } = await supabase
            .from('contracts')
            .select('*')
            .eq('broker_id', broker.id)
            .eq('status', 'active')
          return { ...broker, contracts: contracts || [] }
        }))
        setBrokers(brokersWithContracts)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }

  async function generateTestLeads() {
    setGenerating(true)
    try {
      const res = await fetch('/api/leads/generate-test', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setImportStatus(`${data.count} Test-Leads erstellt`)
        loadData()
        setTimeout(() => setImportStatus(null), 3000)
      }
    } catch (error) {
      console.error('Error generating test leads:', error)
    }
    setGenerating(false)
  }

  async function fetchMetaLeads() {
    setFetchingMeta(true)
    try {
      const res = await fetch('/api/meta/leads/fetch', { method: 'POST' })
      const data = await res.json()
      setImportStatus(`${data.imported || 0} neue Leads importiert`)
      loadData()
      setTimeout(() => setImportStatus(null), 5000)
    } catch (error) {
      console.error('Error fetching meta leads:', error)
    }
    setFetchingMeta(false)
  }

  // Handle broker change - detect contract (same as lead detail)
  function handleBrokerChange(brokerId: string) {
    setBulkBrokerId(brokerId)
    setBrokerDropdownOpen(false)
    
    const broker = brokers.find(b => b.id === brokerId)
    
    // Find matching contract
    let contract = broker?.contracts?.find((c: any) => c.status === 'active')
    setSelectedBrokerContract(contract)
    
    if (contract) {
      if (contract.pricing_model === 'revenue_share') {
        setAssignForm({
          pricing_model: 'commission',
          price_charged: '0',
          revenue_share_percent: contract.revenue_share_percent?.toString() || '50'
        })
      } else if (contract.pricing_model === 'subscription') {
        setAssignForm({
          pricing_model: 'subscription',
          price_charged: '0',
          revenue_share_percent: '0'
        })
      } else {
        setAssignForm({
          pricing_model: 'fixed',
          price_charged: contract.price_per_lead?.toString() || '35',
          revenue_share_percent: '0'
        })
      }
    } else {
      setAssignForm({
        pricing_model: 'single',
        price_charged: '35',
        revenue_share_percent: '0'
      })
    }
  }

  // Bulk assign - use same API as lead detail
  async function bulkAssignLeads() {
    if (!bulkBrokerId || selectedLeads.size === 0) return
    setBulkAssigning(true)
    
    try {
      const leadIds = Array.from(selectedLeads)
      let successCount = 0
      let errorMsg = ''
      
      for (const leadId of leadIds) {
        const res = await fetch('/api/leads/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            broker_id: bulkBrokerId,
            pricing_model: assignForm.pricing_model,
            price_charged: parseFloat(assignForm.price_charged) || 0,
            revenue_share_percent: assignForm.pricing_model === 'commission' ? parseInt(assignForm.revenue_share_percent) : null
          })
        })
        
        const data = await res.json()
        
        if (res.ok && data.success) {
          successCount++
        } else {
          console.error('Assignment error for lead', leadId, data)
          errorMsg = data.error || 'Unbekannter Fehler'
        }
      }
      
      if (successCount > 0) {
        setImportStatus(`${successCount} von ${leadIds.length} Leads erfolgreich zugewiesen`)
      }
      if (errorMsg && successCount < leadIds.length) {
        alert(`Einige Zuweisungen fehlgeschlagen: ${errorMsg}`)
      }
      
      setSelectedLeads(new Set())
      setShowBulkAssign(false)
      setBulkBrokerId('')
      setSelectedBrokerContract(null)
      loadData()
      setTimeout(() => setImportStatus(null), 3000)
    } catch (error) {
      console.error('Error bulk assigning:', error)
      alert('Fehler beim Zuweisen: ' + (error as Error).message)
    }
    setBulkAssigning(false)
  }

  function handleSort(field: 'created_at' | 'lead_number' | 'name') {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  function toggleSelectLead(id: string) {
    const newSet = new Set(selectedLeads)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedLeads(newSet)
  }

  function toggleSelectAll() {
    if (selectedLeads.size === filtered.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(filtered.map(l => l.id)))
    }
  }

  function formatDateTime(dateString: string) {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const filtered = leads
    .filter(lead => {
      const matchesSearch = search === '' || 
        `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        lead.email?.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone?.includes(search)
      const matchesCategory = filterCategory === '' || lead.category?.id === filterCategory
      const matchesStatus = filterStatus === '' || lead.status === filterStatus
      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a, b) => {
      let comparison = 0
      if (sortBy === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortBy === 'lead_number') {
        comparison = (a.lead_number || 0) - (b.lead_number || 0)
      } else if (sortBy === 'name') {
        comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      }
      return sortDir === 'asc' ? comparison : -comparison
    })

  const selectedBroker = brokers.find(b => b.id === bulkBrokerId)

  const statusOptions = [
    { value: '', label: 'Alle Status' },
    { value: 'new', label: 'Neu' },
    { value: 'assigned', label: 'Zugewiesen' },
    { value: 'contacted', label: 'Kontaktiert' },
    { value: 'converted', label: 'Konvertiert' },
    { value: 'lost', label: 'Verloren' }
  ]

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string, color: string, label: string }> = {
      new: { bg: 'rgba(34, 197, 94, 0.25)', color: '#4ade80', label: 'Neu' },
      assigned: { bg: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', label: 'Zugewiesen' },
      contacted: { bg: 'rgba(251, 191, 36, 0.25)', color: '#fbbf24', label: 'Kontaktiert' },
      converted: { bg: 'rgba(139, 92, 246, 0.25)', color: '#a78bfa', label: 'Konvertiert' },
      lost: { bg: 'rgba(239, 68, 68, 0.25)', color: '#f87171', label: 'Verloren' }
    }
    const style = styles[status] || styles.new
    return (
      <span style={{ 
        background: style.bg, 
        color: style.color, 
        padding: '4px 12px', 
        borderRadius: '20px', 
        fontSize: '12px',
        fontWeight: 500
      }}>
        {style.label}
      </span>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1>Leads</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={generateTestLeads} disabled={generating} className="btn btn-secondary">
            {generating ? <RefreshCw size={16} className="spin" /> : <Zap size={16} />}
            10 Test-Leads
          </button>
          <Link href="/leads/new" className="btn btn-primary">
            <Plus size={16} /> Neuer Lead
          </Link>
          <button 
            onClick={fetchMetaLeads} 
            disabled={fetchingMeta}
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '11px 22px', borderRadius: '11px', fontWeight: 550, fontSize: '14px',
              cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #0081FB 0%, #0064E0 100%)',
              color: 'white', boxShadow: '0 4px 14px rgba(0, 129, 251, 0.35)'
            }}
          >
            {fetchingMeta ? <RefreshCw size={16} className="spin" /> : (
              <img src="https://cdn.brandfetch.io/meta.com/w/512/h/512/icon" alt="Meta" 
                style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
            )}
            Meta Leads abrufen
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {importStatus && (
        <div style={{ 
          background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '12px', padding: '14px 20px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px', color: '#4ade80'
        }}>
          <Check size={18} /> {importStatus}
        </div>
      )}

      {/* Selection Bar */}
      {selectedLeads.size > 0 && (
        <div style={{ 
          background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '12px', padding: '14px 20px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Users size={18} style={{ color: '#a78bfa' }} />
            <span style={{ color: 'white', fontWeight: 500 }}>{selectedLeads.size} Leads ausgewählt</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setSelectedLeads(new Set())} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              <X size={16} /> Auswahl aufheben
            </button>
            <button onClick={() => setShowBulkAssign(true)} className="btn btn-primary" style={{ padding: '8px 16px' }}>
              <Users size={16} /> Alle zuweisen
            </button>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal - Same as Lead Detail */}
      {showBulkAssign && (
        <div className="modal-overlay" onClick={() => { setShowBulkAssign(false); setBrokerDropdownOpen(false) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h2 style={{ marginBottom: '8px' }}>{selectedLeads.size} Leads zuweisen</h2>
            <p style={{ opacity: 0.7, marginBottom: '20px' }}>Mehrfachzuweisung</p>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Broker</label>
              <select 
                className="input" 
                value={bulkBrokerId} 
                onChange={e => handleBrokerChange(e.target.value)} 
                required
              >
                <option value="">-- Auswählen --</option>
                {brokers.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.contracts && b.contracts.length > 0 ? '(Vertrag)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Show contract info if broker has one */}
            {bulkBrokerId && selectedBrokerContract && (
              <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(167, 139, 250, 0.15)', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Aktiver Vertrag</div>
                <div style={{ fontWeight: 600, color: '#c4b5fd' }}>
                  {selectedBrokerContract.pricing_model === 'revenue_share' && `Beteiligung: ${selectedBrokerContract.revenue_share_percent}%`}
                  {selectedBrokerContract.pricing_model === 'subscription' && `Abo: CHF ${selectedBrokerContract.monthly_fee}/Monat`}
                  {selectedBrokerContract.pricing_model === 'fixed' && `Fixpreis: CHF ${selectedBrokerContract.price_per_lead}/Lead`}
                </div>
              </div>
            )}

            {/* Show single purchase info if no contract */}
            {bulkBrokerId && !selectedBrokerContract && (
              <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>Kein Vertrag</div>
                <div style={{ fontWeight: 600, color: '#fde047' }}>Einzelkauf</div>
              </div>
            )}

            {/* Only show price input for fixed/single */}
            {bulkBrokerId && (assignForm.pricing_model === 'fixed' || assignForm.pricing_model === 'single') && (
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Preis pro Lead (CHF)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input" 
                  value={assignForm.price_charged} 
                  onChange={e => setAssignForm({...assignForm, price_charged: e.target.value})} 
                  required 
                />
                <div style={{ fontSize: '13px', opacity: 0.7, marginTop: '6px' }}>
                  Total: CHF {(parseFloat(assignForm.price_charged || '0') * selectedLeads.size).toFixed(2)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                type="button"
                onClick={() => { setShowBulkAssign(false); setBrokerDropdownOpen(false); setSelectedBrokerContract(null) }} 
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Abbrechen
              </button>
              <button 
                onClick={bulkAssignLeads} 
                disabled={!bulkBrokerId || bulkAssigning} 
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {bulkAssigning ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
                {selectedLeads.size} Leads zuweisen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
            <input type="text" placeholder="Suche nach Name, E-Mail oder Telefon..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="input" style={{ paddingLeft: '44px' }} />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="select" style={{ minWidth: '160px' }}>
            <option value="">Alle Kategorien</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select" style={{ minWidth: '140px' }}>
            {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['created_at', 'lead_number', 'name'].map(field => (
              <button key={field} onClick={() => handleSort(field as any)} className="btn btn-secondary"
                style={{ padding: '10px 14px', background: sortBy === field ? 'rgba(139, 92, 246, 0.3)' : undefined }}>
                {field === 'created_at' ? 'Datum' : field === 'lead_number' ? 'ID' : 'Name'}
                {sortBy === field && (sortDir === 'desc' ? ' ↓' : ' ↑')}
              </button>
            ))}
          </div>
          <button onClick={loadData} className="btn btn-secondary" style={{ padding: '10px 12px' }}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
        </div>
        <div style={{ marginTop: '14px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
          {filtered.length} von {leads.length} Leads
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <RefreshCw size={32} className="spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.5)' }}>
            <p>Keine Leads gefunden</p>
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedLeads.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  </th>
                  <th style={{ width: '70px' }}>ID</th>
                  <th>NAME</th>
                  <th>KONTAKT</th>
                  <th>KATEGORIE</th>
                  <th style={{ width: '150px' }}>ERSTELLT</th>
                  <th style={{ width: '110px' }}>STATUS</th>
                  <th style={{ width: '110px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const dt = formatDateTime(lead.created_at)
                  return (
                    <tr key={lead.id} style={{ cursor: 'pointer', background: selectedLeads.has(lead.id) ? 'rgba(139, 92, 246, 0.15)' : undefined }}
                      onClick={() => window.location.href = `/leads/${lead.id}`}>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleSelectLead(lead.id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                      </td>
                      <td style={{ color: 'rgba(255,255,255,0.6)' }}>#{lead.lead_number}</td>
                      <td>
                        <Link href={`/leads/${lead.id}`} style={{ color: 'white', fontWeight: 500, fontSize: '15px', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}>
                          {lead.first_name} {lead.last_name}
                        </Link>
                      </td>
                      <td>
                        <div style={{ color: 'white' }}>{lead.email}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{lead.phone}</div>
                      </td>
                      <td style={{ color: 'rgba(255,255,255,0.7)' }}>{lead.category?.name || '-'}</td>
                      <td>
                        <div style={{ color: 'white' }}>{dt.date}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{dt.time}</div>
                      </td>
                      <td>{getStatusBadge(lead.status)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {lead.status === 'new' && (
                          <Link href={`/leads/${lead.id}`} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
                            Zuweisen
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
