'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Plus, Search, RefreshCw, Download, Zap, Check, X, Users, ChevronDown } from 'lucide-react'

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
  }
}

interface LeadCategory {
  id: string
  name: string
}

interface Broker {
  id: string
  name: string
  contact_person: string
  email: string
  status: string
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

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [leadsRes, categoriesRes, brokersRes] = await Promise.all([
        supabase.from('leads').select('*, category:lead_categories(id, name)').order('created_at', { ascending: false }),
        supabase.from('lead_categories').select('*'),
        supabase.from('brokers').select('*')
      ])
      
      if (leadsRes.data) setLeads(leadsRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
      if (brokersRes.data) {
        console.log('Loaded brokers:', brokersRes.data)
        setBrokers(brokersRes.data)
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
      setImportStatus(`${data.imported || 0} neue Leads importiert (${data.pages || 0} Seiten geprüft)`)
      loadData()
      setTimeout(() => setImportStatus(null), 5000)
    } catch (error) {
      console.error('Error fetching meta leads:', error)
    }
    setFetchingMeta(false)
  }

  async function bulkAssignLeads() {
    if (!bulkBrokerId || selectedLeads.size === 0) return
    setBulkAssigning(true)
    
    try {
      const leadIds = Array.from(selectedLeads)
      
      // Use the same API as lead detail page
      for (const leadId of leadIds) {
        const res = await fetch('/api/leads/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            broker_id: bulkBrokerId,
            pricing_model: 'single',
            price_charged: 0
          })
        })
        
        if (!res.ok) {
          const data = await res.json()
          console.error('Assignment error:', data)
        }
      }
      
      setImportStatus(`${leadIds.length} Leads zugewiesen`)
      setSelectedLeads(new Set())
      setShowBulkAssign(false)
      setBulkBrokerId('')
      loadData()
      setTimeout(() => setImportStatus(null), 3000)
    } catch (error) {
      console.error('Error bulk assigning:', error)
      alert('Fehler beim Zuweisen')
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

  // Filter und Sortieren
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
          <button 
            onClick={generateTestLeads} 
            disabled={generating}
            className="btn btn-secondary"
          >
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 22px',
              borderRadius: '11px',
              fontWeight: 550,
              fontSize: '14px',
              cursor: 'pointer',
              border: 'none',
              background: 'linear-gradient(135deg, #0081FB 0%, #0064E0 100%)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(0, 129, 251, 0.35)',
              transition: 'all 0.2s'
            }}
          >
            {fetchingMeta ? (
              <RefreshCw size={16} className="spin" />
            ) : (
              <img 
                src="https://cdn.brandfetch.io/meta.com/w/512/h/512/icon" 
                alt="Meta" 
                style={{ width: '18px', height: '18px', borderRadius: '4px' }} 
              />
            )}
            Meta Leads abrufen
          </button>
        </div>
      </div>

      {/* Import Status */}
      {importStatus && (
        <div style={{ 
          background: 'rgba(34, 197, 94, 0.15)', 
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#4ade80'
        }}>
          <Check size={18} />
          {importStatus}
        </div>
      )}

      {/* Selection Bar */}
      {selectedLeads.size > 0 && (
        <div style={{ 
          background: 'rgba(139, 92, 246, 0.15)', 
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Users size={18} style={{ color: '#a78bfa' }} />
            <span style={{ color: 'white', fontWeight: 500 }}>{selectedLeads.size} Leads ausgewählt</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => setSelectedLeads(new Set())}
              className="btn btn-secondary"
              style={{ padding: '8px 16px' }}
            >
              <X size={16} /> Auswahl aufheben
            </button>
            <button 
              onClick={() => setShowBulkAssign(true)}
              className="btn btn-primary"
              style={{ padding: '8px 16px' }}
            >
              <Users size={16} /> Alle zuweisen
            </button>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssign && (
        <div 
          className="modal-overlay" 
          onClick={() => { setShowBulkAssign(false); setBrokerDropdownOpen(false) }}
        >
          <div 
            className="modal" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '450px' }}
          >
            <h2 style={{ marginBottom: '20px', color: 'white' }}>{selectedLeads.size} Leads zuweisen</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                Broker auswählen
              </label>
              
              {brokers.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  <p>Keine Broker gefunden.</p>
                  <Link href="/broker" style={{ color: '#60a5fa', marginTop: '8px', display: 'inline-block' }}>
                    Broker erstellen →
                  </Link>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  {/* Custom Dropdown Button */}
                  <button
                    type="button"
                    onClick={() => setBrokerDropdownOpen(!brokerDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      borderRadius: '11px',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      background: 'rgba(30, 27, 75, 0.8)',
                      color: 'white',
                      fontSize: '15px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>
                      {selectedBroker 
                        ? `${selectedBroker.name}${selectedBroker.contact_person ? ` (${selectedBroker.contact_person})` : ''}`
                        : '-- Broker wählen --'
                      }
                    </span>
                    <ChevronDown size={18} style={{ opacity: 0.6 }} />
                  </button>
                  
                  {/* Dropdown List */}
                  {brokerDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: '#1e1b4b',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '11px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 100
                    }}>
                      {brokers.map(broker => (
                        <div
                          key={broker.id}
                          onClick={() => {
                            setBulkBrokerId(broker.id)
                            setBrokerDropdownOpen(false)
                          }}
                          style={{
                            padding: '12px 18px',
                            cursor: 'pointer',
                            color: 'white',
                            background: bulkBrokerId === broker.id ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                            borderBottom: '1px solid rgba(255,255,255,0.1)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = bulkBrokerId === broker.id ? 'rgba(139, 92, 246, 0.3)' : 'transparent'}
                        >
                          <div style={{ fontWeight: 500 }}>{broker.name}</div>
                          {broker.contact_person && (
                            <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '2px' }}>
                              {broker.contact_person}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Debug info */}
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                {brokers.length} Broker geladen
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { setShowBulkAssign(false); setBrokerDropdownOpen(false) }}
                className="btn btn-secondary"
              >
                Abbrechen
              </button>
              <button 
                onClick={bulkAssignLeads}
                disabled={!bulkBrokerId || bulkAssigning}
                className="btn btn-primary"
              >
                {bulkAssigning ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
                Zuweisen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              placeholder="Suche nach Name, E-Mail oder Telefon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: '44px' }}
            />
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="select"
            style={{ minWidth: '160px' }}
          >
            <option value="">Alle Kategorien</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select"
            style={{ minWidth: '140px' }}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Sort Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleSort('created_at')}
              className="btn btn-secondary"
              style={{ 
                padding: '10px 14px',
                background: sortBy === 'created_at' ? 'rgba(139, 92, 246, 0.3)' : undefined
              }}
            >
              Datum {sortBy === 'created_at' && (sortDir === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('lead_number')}
              className="btn btn-secondary"
              style={{ 
                padding: '10px 14px',
                background: sortBy === 'lead_number' ? 'rgba(139, 92, 246, 0.3)' : undefined
              }}
            >
              ID {sortBy === 'lead_number' && (sortDir === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('name')}
              className="btn btn-secondary"
              style={{ 
                padding: '10px 14px',
                background: sortBy === 'name' ? 'rgba(139, 92, 246, 0.3)' : undefined
              }}
            >
              Name {sortBy === 'name' && (sortDir === 'desc' ? '↓' : '↑')}
            </button>
          </div>

          {/* Refresh */}
          <button onClick={loadData} className="btn btn-secondary" style={{ padding: '10px 12px' }}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Results Count */}
        <div style={{ marginTop: '14px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
          {filtered.length} von {leads.length} Leads
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <RefreshCw size={32} className="spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <p style={{ marginTop: '16px', color: 'rgba(255,255,255,0.5)' }}>Lade Leads...</p>
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
                    <input 
                      type="checkbox" 
                      checked={selectedLeads.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
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
                    <tr 
                      key={lead.id} 
                      style={{ 
                        cursor: 'pointer',
                        background: selectedLeads.has(lead.id) ? 'rgba(139, 92, 246, 0.15)' : undefined
                      }}
                      onClick={() => window.location.href = `/leads/${lead.id}`}
                    >
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ color: 'rgba(255,255,255,0.6)' }}>
                        #{lead.lead_number}
                      </td>
                      <td>
                        <Link 
                          href={`/leads/${lead.id}`} 
                          style={{ 
                            color: 'white', 
                            fontWeight: 500, 
                            fontSize: '15px',
                            textDecoration: 'none'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {lead.first_name} {lead.last_name}
                        </Link>
                      </td>
                      <td>
                        <div style={{ color: 'white' }}>{lead.email}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{lead.phone}</div>
                      </td>
                      <td style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {lead.category?.name || '-'}
                      </td>
                      <td>
                        <div style={{ color: 'white' }}>{dt.date}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{dt.time}</div>
                      </td>
                      <td>
                        {getStatusBadge(lead.status)}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {lead.status === 'new' && (
                          <Link
                            href={`/leads/${lead.id}`}
                            className="btn btn-primary"
                            style={{ padding: '6px 14px', fontSize: '13px' }}
                          >
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
