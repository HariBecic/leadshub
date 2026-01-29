'use client'

import { useEffect, useState } from 'react'
import { supabase, Lead } from '@/lib/supabase'
import { TrendingUp, Users, Zap } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({ totalLeadsToday: 0, totalLeadsMonth: 0, assignedToday: 0, availableLeads: 0, activeBrokers: 0 })
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboardData() }, [])

  async function loadDashboardData() {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    const { count: leadsToday } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', startOfDay)
    const { count: leadsMonth } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth)
    const { count: assignedToday } = await supabase.from('lead_assignments').select('*', { count: 'exact', head: true }).gte('assigned_at', startOfDay)
    const { count: availableLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', ['new', 'available'])
    const { count: activeBrokers } = await supabase.from('brokers').select('*', { count: 'exact', head: true }).eq('status', 'active')
    const { data: recent } = await supabase.from('leads').select('*, category:lead_categories(*)').order('created_at', { ascending: false }).limit(5)

    setStats({ totalLeadsToday: leadsToday || 0, totalLeadsMonth: leadsMonth || 0, assignedToday: assignedToday || 0, availableLeads: availableLeads || 0, activeBrokers: activeBrokers || 0 })
    setRecentLeads(recent || [])
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-value">{stats.totalLeadsToday}</div>
              <div className="stat-label">Leads heute</div>
            </div>
            <Zap className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-value">{stats.assignedToday}</div>
              <div className="stat-label">Zugewiesen heute</div>
            </div>
            <TrendingUp className="text-green-500" size={32} />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-value">{stats.availableLeads}</div>
              <div className="stat-label">Verfuegbare Leads</div>
            </div>
            <Zap className="text-orange-500" size={32} />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-value">{stats.activeBrokers}</div>
              <div className="stat-label">Aktive Broker</div>
            </div>
            <Users className="text-purple-500" size={32} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Dieser Monat</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-bold">{stats.totalLeadsMonth}</div>
              <div className="text-sm text-gray-500">Total Leads</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">CHF 0</div>
              <div className="text-sm text-gray-500">Umsatz</div>
            </div>
          </div>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Letzte Leads</h2>
          {recentLeads.length === 0 ? (
            <p className="text-gray-500 text-sm">Noch keine Leads</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{lead.first_name} {lead.last_name}</span>
                  <span className="badge badge-success">Neu</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
