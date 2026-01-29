'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Zap, Users, TrendingUp, DollarSign, Clock, FileText, CheckCircle, PieChart, Percent } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({ 
    leads: 0, 
    brokers: 0, 
    assigned: 0, 
    fixedRevenue: 0,
    commissionRevenue: 0,
    totalRevenue: 0,
    openInvoices: 0,
    openInvoicesAmount: 0,
    pendingFollowups: 0,
    successfulDeals: 0
  })
  const [recentLeads, setRecentLeads] = useState<any[]>([])
  const [openInvoices, setOpenInvoices] = useState<any[]>([])
  const [pendingFollowups, setPendingFollowups] = useState<any[]>([])
  const [recentCommissions, setRecentCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    // Basic stats
    const { count: leadsCount } = await supabase.from('leads').select('*', { count: 'exact', head: true })
    const { count: brokersCount } = await supabase.from('brokers').select('*', { count: 'exact', head: true })
    
    // Get all assignments for revenue calculation
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('price_charged, commission_amount, pricing_model, status')
    
    // Calculate revenues
    let fixedRevenue = 0
    let commissionRevenue = 0
    let successfulDeals = 0

    assignments?.forEach(a => {
      if (a.pricing_model === 'fixed' || a.pricing_model === 'single') {
        fixedRevenue += Number(a.price_charged) || 0
      }
      if (a.commission_amount && a.status === 'success') {
        commissionRevenue += Number(a.commission_amount) || 0
        successfulDeals++
      }
    })

    // Open invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, broker:brokers(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    const openAmount = invoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0

    // Pending followups
    const { data: followups } = await supabase
      .from('lead_assignments')
      .select('*, lead:leads(first_name, last_name), broker:brokers(name)')
      .eq('pricing_model', 'revenue_share')
      .not('followup_sent_at', 'is', null)
      .is('followup_response', null)
      .order('response_deadline', { ascending: true })
      .limit(5)

    // Recent leads
    const { data: recent } = await supabase
      .from('leads')
      .select('*, category:lead_categories(name)')
      .order('created_at', { ascending: false })
      .limit(5)

    // Recent commissions (successful deals)
    const { data: commissions } = await supabase
      .from('lead_assignments')
      .select('*, lead:leads(first_name, last_name), broker:brokers(name)')
      .eq('status', 'success')
      .not('commission_amount', 'is', null)
      .order('followup_responded_at', { ascending: false })
      .limit(5)

    setStats({
      leads: leadsCount || 0,
      brokers: brokersCount || 0,
      assigned: assignments?.length || 0,
      fixedRevenue,
      commissionRevenue,
      totalRevenue: fixedRevenue + commissionRevenue,
      openInvoices: invoices?.length || 0,
      openInvoicesAmount: openAmount,
      pendingFollowups: followups?.length || 0,
      successfulDeals
    })
    setRecentLeads(recent || [])
    setOpenInvoices(invoices || [])
    setPendingFollowups(followups || [])
    setRecentCommissions(commissions || [])
    setLoading(false)
  }

  async function markAsPaid(invoiceId: string) {
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId)
    loadDashboard()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* Stats Grid */}
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
          <div className="value">CHF {stats.totalRevenue.toFixed(0)}</div>
          <div className="label">Umsatz total</div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #3A29A6 0%, #4D3BBF 100%)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <DollarSign size={20} />
            <span style={{ fontSize: '14px', opacity: 0.9 }}>Fixpreis-Einnahmen</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>CHF {stats.fixedRevenue.toFixed(2)}</div>
          <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Einzelkäufe & Fixpreis-Verträge</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Percent size={20} />
            <span style={{ fontSize: '14px', opacity: 0.9 }}>Provisionen (Beteiligung)</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>CHF {stats.commissionRevenue.toFixed(2)}</div>
          <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>{stats.successfulDeals} erfolgreiche Abschlüsse</div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #F26444 0%, #D94E30 100%)', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <PieChart size={20} />
            <span style={{ fontSize: '14px', opacity: 0.9 }}>Gesamt-Umsatz</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>CHF {stats.totalRevenue.toFixed(2)}</div>
          <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Fixpreis + Provisionen</div>
        </div>
      </div>

      {/* Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {stats.openInvoices > 0 && (
          <div style={{ background: '#fef3c7', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: '#fbbf24', borderRadius: '10px', padding: '12px', color: 'white' }}>
              <FileText size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#92400e' }}>{stats.openInvoices} offene Rechnungen</div>
              <div style={{ color: '#b45309', fontSize: '14px' }}>CHF {stats.openInvoicesAmount.toFixed(2)} ausstehend</div>
            </div>
            <Link href="/rechnungen" style={{ marginLeft: 'auto', color: '#92400e', fontWeight: 600, fontSize: '14px' }}>
              Anzeigen →
            </Link>
          </div>
        )}

        {stats.pendingFollowups > 0 && (
          <div style={{ background: '#dbeafe', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: '#3b82f6', borderRadius: '10px', padding: '12px', color: 'white' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#1e40af' }}>{stats.pendingFollowups} Follow-ups offen</div>
              <div style={{ color: '#1d4ed8', fontSize: '14px' }}>Warten auf Broker-Feedback</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Open Invoices */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Offene Rechnungen</h2>
            <Link href="/rechnungen" style={{ fontSize: '14px', color: '#3A29A6' }}>Alle →</Link>
          </div>
          {openInvoices.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>Keine offenen Rechnungen</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {openInvoices.map((invoice) => (
                <div key={invoice.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{invoice.invoice_number}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{invoice.broker?.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontWeight: 600 }}>CHF {Number(invoice.amount).toFixed(2)}</div>
                    <button 
                      onClick={() => markAsPaid(invoice.id)}
                      className="btn btn-sm"
                      style={{ background: '#dcfce7', color: '#166534' }}
                    >
                      Bezahlt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Commissions */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Letzte Provisionen</h2>
          </div>
          {recentCommissions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
              <Percent size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>Noch keine Provisionen</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentCommissions.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f3e8ff', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#7c3aed' }}>{c.lead?.first_name} {c.lead?.last_name}</div>
                    <div style={{ fontSize: '13px', color: '#9333ea' }}>{c.broker?.name} • {c.revenue_share_percent}%</div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '18px' }}>
                    CHF {Number(c.commission_amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Followups */}
      {pendingFollowups.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Offene Follow-ups</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            {pendingFollowups.map((f) => {
              const deadline = f.response_deadline ? new Date(f.response_deadline) : null
              const isOverdue = deadline && deadline < new Date()
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isOverdue ? '#fee2e2' : '#f8fafc', borderRadius: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{f.lead?.first_name} {f.lead?.last_name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{f.broker?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isOverdue ? (
                      <span className="badge badge-danger">Überfällig</span>
                    ) : deadline ? (
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Frist: {deadline.toLocaleDateString('de-CH')}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Leads */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>Neueste Leads</h2>
          <Link href="/leads" style={{ fontSize: '14px', color: '#3A29A6' }}>Alle →</Link>
        </div>
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
                <td>
                  <Link href={`/leads/${lead.id}`} style={{ fontWeight: 500, color: '#1e293b' }}>
                    {lead.first_name} {lead.last_name}
                  </Link>
                </td>
                <td>{lead.category?.name && <span className="badge badge-info">{lead.category.name}</span>}</td>
                <td style={{ color: '#64748b' }}>{new Date(lead.created_at).toLocaleDateString('de-CH')}</td>
                <td>
                  <span className={`badge ${lead.status === 'new' ? 'badge-success' : lead.status === 'assigned' ? 'badge-warning' : lead.status === 'available' ? 'badge-info' : 'badge-neutral'}`}>
                    {lead.status === 'new' ? 'Neu' : lead.status === 'assigned' ? 'Zugewiesen' : lead.status === 'available' ? 'Verfügbar' : lead.status === 'closed' ? 'Geschlossen' : lead.status}
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
