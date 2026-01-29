'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Zap, Users, TrendingUp, DollarSign } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({ leads: 0, brokers: 0, assigned: 0, revenue: 0 })
  const [recentLeads, setRecentLeads] = useState<any[]>([])

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { count: leadsCount } = await supabase.from('leads').select('*', { count: 'exact', head: true })
    const { count: brokersCount } = await supabase.from('brokers').select('*', { count: 'exact', head: true })
    const { data: assignments } = await supabase.from('lead_assignments').select('price_charged')
    const totalRevenue = assignments?.reduce((sum, a) => sum + (a.price_charged || 0), 0) || 0
    const { data: recent } = await supabase.from('leads').select('*, category:lead_categories(name)').order('created_at', { ascending: false }).limit(5)
    
    setStats({
      leads: leadsCount || 0,
      brokers: brokersCount || 0,
      assigned: assignments?.length || 0,
      revenue: totalRevenue
    })
    setRecentLeads(recent || [])
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon primary"><Zap size={24} /></div>
          <div className="value">{stats.leads}</div>
          <div className="label">Leads total</div>
        </div>
        <div className="stat-card">
          <div className="icon accent"><TrendingUp size={24} /></div>
          <div className="value">{stats.assigned}</div>
          <div className="label">Zugewiesen</div>
        </div>
        <div className="stat-card">
          <div className="icon success"><Users size={24} /></div>
          <div className="value">{stats.brokers}</div>
          <div className="label">Broker</div>
        </div>
        <div className="stat-card">
          <div className="icon primary"><DollarSign size={24} /></div>
          <div className="value">CHF {stats.revenue}</div>
          <div className="label">Umsatz</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: '#1e293b' }}>Neueste Leads</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kategorie</th>
              <th>Datum</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentLeads.map((lead) => (
              <tr key={lead.id}>
                <td style={{ fontWeight: 500 }}>{lead.first_name} {lead.last_name}</td>
                <td>{lead.category?.name && <span className="badge badge-info">{lead.category.name}</span>}</td>
                <td style={{ color: '#64748b' }}>{new Date(lead.created_at).toLocaleDateString('de-CH')}</td>
                <td>
                  <span className={`badge ${lead.status === 'new' ? 'badge-success' : lead.status === 'assigned' ? 'badge-warning' : 'badge-neutral'}`}>
                    {lead.status === 'new' ? 'Neu' : lead.status === 'assigned' ? 'Zugewiesen' : lead.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
