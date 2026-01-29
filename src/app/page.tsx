'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Zap, TrendingUp, Users, DollarSign, FileText, Clock, Percent, ArrowRight } from 'lucide-react'

interface Stats {
  leads: number
  brokers: number
  assigned: number
  fixedRevenue: number
  commissionRevenue: number
  totalRevenue: number
  successfulDeals: number
  openInvoices: number
  openInvoicesAmount: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    leads: 0, brokers: 0, assigned: 0, fixedRevenue: 0, commissionRevenue: 0,
    totalRevenue: 0, successfulDeals: 0, openInvoices: 0, openInvoicesAmount: 0
  })
  const [recentLeads, setRecentLeads] = useState<any[]>([])
  const [openInvoices, setOpenInvoices] = useState<any[]>([])
  const [recentCommissions, setRecentCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const { count: leadsCount } = await supabase.from('leads').select('*', { count: 'exact', head: true })
    const { count: brokersCount } = await supabase.from('brokers').select('*', { count: 'exact', head: true })
    const { count: assignedCount } = await supabase.from('lead_assignments').select('*', { count: 'exact', head: true })

    const { data: fixedAssignments } = await supabase
      .from('lead_assignments')
      .select('price_charged')
      .in('pricing_model', ['fixed', 'single'])
    const fixedRevenue = fixedAssignments?.reduce((sum, a) => sum + (Number(a.price_charged) || 0), 0) || 0

    const { data: commissionAssignments } = await supabase
      .from('lead_assignments')
      .select('commission_amount, revenue_share_percent, lead:leads(first_name, last_name), broker:brokers(name)')
      .not('commission_amount', 'is', null)
      .gt('commission_amount', 0)
      .order('updated_at', { ascending: false })
    
    const commissionRevenue = commissionAssignments?.reduce((sum, a) => sum + (Number(a.commission_amount) || 0), 0) || 0
    const successfulDeals = commissionAssignments?.length || 0

    const { data: openInvoicesData } = await supabase
      .from('invoices')
      .select('*, broker:brokers(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const openInvoicesAmount = openInvoicesData?.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0) || 0

    const { data: recentLeadsData } = await supabase
      .from('leads')
      .select('*, category:lead_categories(name)')
      .order('created_at', { ascending: false })
      .limit(5)

    setStats({
      leads: leadsCount || 0,
      brokers: brokersCount || 0,
      assigned: assignedCount || 0,
      fixedRevenue,
      commissionRevenue,
      totalRevenue: fixedRevenue + commissionRevenue,
      successfulDeals,
      openInvoices: openInvoicesData?.length || 0,
      openInvoicesAmount
    })

    setRecentLeads(recentLeadsData || [])
    setOpenInvoices(openInvoicesData || [])
    setRecentCommissions(commissionAssignments?.slice(0, 3) || [])
    setLoading(false)
  }

  async function markAsPaid(invoiceId: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId)
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        {[
          { icon: Zap, value: stats.leads, label: 'Leads total', bg: 'rgba(77, 59, 191, 0.5)' },
          { icon: TrendingUp, value: stats.assigned, label: 'Zugewiesen', bg: 'rgba(242, 100, 68, 0.5)' },
          { icon: Users, value: stats.brokers, label: 'Broker', bg: 'rgba(34, 197, 94, 0.5)' },
          { icon: DollarSign, value: `CHF ${stats.totalRevenue}`, label: 'Umsatz total', bg: 'rgba(77, 59, 191, 0.5)' },
        ].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(20px)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.15)', height: '160px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <item.icon size={24} color="white" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>{item.value}</div>
            <div style={{ fontSize: '14px', opacity: 0.7 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
        {[
          { icon: DollarSign, title: 'Fixpreis-Einnahmen', value: stats.fixedRevenue.toFixed(2), sub: 'Einzelkäufe & Fixpreis-Verträge', bg: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' },
          { icon: Percent, title: 'Provisionen (Beteiligung)', value: stats.commissionRevenue.toFixed(2), sub: `${stats.successfulDeals} erfolgreiche Abschlüsse`, bg: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' },
          { icon: Clock, title: 'Gesamt-Umsatz', value: stats.totalRevenue.toFixed(2), sub: 'Fixpreis + Provisionen', bg: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' },
        ].map((item, i) => (
          <div key={i} style={{ background: item.bg, borderRadius: '20px', padding: '24px', height: '140px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <item.icon size={20} />
              <span style={{ fontSize: '14px', opacity: 0.9 }}>{item.title}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>CHF {item.value}</div>
            <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {stats.openInvoices > 0 && (
        <div style={{ background: 'rgba(251, 191, 36, 0.15)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(251, 191, 36, 0.3)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={24} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{stats.openInvoices} offene Rechnungen</div>
                <div style={{ fontSize: '14px', opacity: 0.8 }}>CHF {stats.openInvoicesAmount.toFixed(2)} ausstehend</div>
              </div>
            </div>
            <Link href="/rechnungen" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontWeight: 600, textDecoration: 'none' }}>
              Anzeigen <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      )}

      {/* Two Column Section - EXACT SAME SIZE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.15)', height: '220px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Offene Rechnungen</h2>
            <Link href="/rechnungen" style={{ fontSize: '14px', color: '#a5b4fc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Alle <ArrowRight size={14} />
            </Link>
          </div>
          {openInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', opacity: 0.6 }}>Keine offenen Rechnungen</div>
          ) : (
            openInvoices.slice(0, 2).map((inv) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{inv.invoice_number}</div>
                  <div style={{ fontSize: '13px', opacity: 0.7 }}>{inv.broker?.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 600 }}>CHF {Number(inv.amount).toFixed(2)}</span>
                  <button onClick={() => markAsPaid(inv.id)} className="btn btn-sm" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: 'none' }}>
                    Bezahlt
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', borderRadius: '20px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.15)', height: '220px', overflow: 'hidden' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, marginBottom: '20px' }}>Letzte Provisionen</h2>
          {recentCommissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', opacity: 0.6 }}>Noch keine Provisionen</div>
          ) : (
            recentCommissions.slice(0, 2).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '10px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#c4b5fd' }}>{c.lead?.first_name} {c.lead?.last_name}</div>
                  <div style={{ fontSize: '13px', opacity: 0.7 }}>{c.broker?.name} • {c.revenue_share_percent}%</div>
                </div>
                <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: '16px' }}>CHF {Number(c.commission_amount).toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Neueste Leads</h2>
          <Link href="/leads" style={{ fontSize: '14px', color: '#a5b4fc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Alle <ArrowRight size={14} />
          </Link>
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
                <td style={{ fontWeight: 500 }}>{lead.first_name} {lead.last_name}</td>
                <td>{lead.category && <span className="badge badge-info">{lead.category.name}</span>}</td>
                <td style={{ opacity: 0.7 }}>{new Date(lead.created_at).toLocaleDateString('de-CH')}</td>
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
