'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Plus, Search, RefreshCw, Download, Filter, ArrowUpDown, ChevronDown, Zap } from 'lucide-react'

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [categories, setCategories] = useState<LeadCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'lead_number' | 'name'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [fetchingMeta, setFetchingMeta] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [leadsRes, categoriesRes] = await Promise.all([
        supabase.from('leads').select('*, category:lead_categories(id, name)').order('created_at', { ascending: false }),
        supabase.from('lead_categories').select('*')
      ])
      
      if (leadsRes.data) setLeads(leadsRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
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

  function handleSort(field: 'created_at' | 'lead_number' | 'name') {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
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
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #1877F2, #0d65d9)' }}
          >
            {fetchingMeta ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
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
          <span style={{ fontSize: '18px' }}>✓</span>
          {importStatus}
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
            style={{ width: '180px' }}
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
            style={{ width: '160px' }}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Sort */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleSort('created_at')}
              className={`btn btn-secondary`}
              style={{ 
                padding: '10px 14px',
                background: sortBy === 'created_at' ? 'rgba(139, 92, 246, 0.3)' : undefined
              }}
            >
              Datum {sortBy === 'created_at' && (sortDir === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('lead_number')}
              className={`btn btn-secondary`}
              style={{ 
                padding: '10px 14px',
                background: sortBy === 'lead_number' ? 'rgba(139, 92, 246, 0.3)' : undefined
              }}
            >
              ID {sortBy === 'lead_number' && (sortDir === 'desc' ? '↓' : '↑')}
            </button>
            <button
              onClick={() => handleSort('name')}
              className={`btn btn-secondary`}
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
                  <th style={{ width: '80px' }}>ID</th>
                  <th>NAME</th>
                  <th>KONTAKT</th>
                  <th>KATEGORIE</th>
                  <th style={{ width: '120px' }}>STATUS</th>
                  <th style={{ width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, index) => (
                  <tr 
                    key={lead.id} 
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.location.href = `/leads/${lead.id}`}
                  >
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>
                      #{lead.lead_number || (leads.length - index)}
                    </td>
                    <td>
                      <Link 
                        href={`/leads/${lead.id}`} 
                        style={{ 
                          color: 'white', 
                          fontWeight: 500, 
                          textDecoration: 'none',
                          fontSize: '15px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.first_name} {lead.last_name}
                      </Link>
                    </td>
                    <td>
                      <div style={{ color: 'white' }}>{lead.email}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '2px' }}>
                        {lead.phone}
                      </div>
                    </td>
                    <td style={{ color: 'white' }}>
                      {lead.category?.name || '-'}
                    </td>
                    <td>
                      {getStatusBadge(lead.status)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {lead.status === 'new' && (
                        <Link 
                          href={`/leads/${lead.id}`}
                          className="btn btn-primary"
                          style={{ padding: '6px 16px', fontSize: '13px' }}
                        >
                          Zuweisen
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
