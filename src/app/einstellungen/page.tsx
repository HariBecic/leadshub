'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Copy, Check } from 'lucide-react'

export default function EinstellungenPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [company, setCompany] = useState({ name: '', address: '', iban: '' })
  const [loading, setLoading] = useState(true)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [editCategory, setEditCategory] = useState<any>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', default_price: '' })
  const [webhookForm, setWebhookForm] = useState({ name: '', category_id: '' })
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: categoriesData } = await supabase.from('lead_categories').select('*').order('name')
    const { data: webhooksData } = await supabase.from('lead_sources').select('*, category:lead_categories(name)')
    const { data: companyData } = await supabase.from('company_settings').select('*').single()
    
    setCategories(categoriesData || [])
    setWebhooks(webhooksData || [])
    if (companyData) setCompany(companyData)
    setLoading(false)
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (editCategory) {
      await supabase.from('lead_categories').update({
        name: categoryForm.name,
        default_price: parseFloat(categoryForm.default_price)
      }).eq('id', editCategory.id)
    } else {
      await supabase.from('lead_categories').insert({
        name: categoryForm.name,
        default_price: parseFloat(categoryForm.default_price)
      })
    }
    setShowCategoryModal(false)
    setCategoryForm({ name: '', default_price: '' })
    setEditCategory(null)
    loadData()
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault()
    const token = crypto.randomUUID()
    await supabase.from('lead_sources').insert({
      name: webhookForm.name,
      category_id: webhookForm.category_id || null,
      webhook_token: token
    })
    setShowWebhookModal(false)
    setWebhookForm({ name: '', category_id: '' })
    loadData()
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault()
    const { data: existing } = await supabase.from('company_settings').select('id').single()
    if (existing) {
      await supabase.from('company_settings').update(company).eq('id', existing.id)
    } else {
      await supabase.from('company_settings').insert(company)
    }
  }

  function copyWebhook(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/api/webhook/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  function openEditCategory(cat: any) {
    setEditCategory(cat)
    setCategoryForm({ name: cat.name, default_price: cat.default_price?.toString() || '' })
    setShowCategoryModal(true)
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><div className="spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Einstellungen</h1>
      </div>

      {/* Categories */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Lead-Kategorien</h2>
          <button onClick={() => { setEditCategory(null); setCategoryForm({ name: '', default_price: '' }); setShowCategoryModal(true) }} className="btn btn-primary btn-sm">
            <Plus size={16} /> Neue Kategorie
          </button>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Standardpreis</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 500 }}>{cat.name}</td>
                  <td>CHF {Number(cat.default_price || 0).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${cat.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {cat.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => openEditCategory(cat)} className="btn btn-sm btn-secondary">Bearbeiten</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhooks */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Lead-Quellen (Webhooks)</h2>
          <button onClick={() => setShowWebhookModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Neue Quelle
          </button>
        </div>
        {webhooks.map((wh) => (
          <div key={wh.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{wh.name}</div>
            <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '8px' }}>{wh.category?.name || 'Alle Kategorien'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                /api/webhook/{wh.webhook_token?.slice(0, 8)}...
              </code>
              <button onClick={() => copyWebhook(wh.webhook_token)} className="btn btn-sm btn-secondary">
                {copied === wh.webhook_token ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Company Settings */}
      <div className="card">
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Firmenangaben (für Rechnungen)</h2>
        <form onSubmit={saveCompany}>
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Firmenname</label>
            <input className="input" value={company.name} onChange={e => setCompany({...company, name: e.target.value})} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">Adresse</label>
            <textarea className="input" rows={2} value={company.address} onChange={e => setCompany({...company, address: e.target.value})} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="input-label">IBAN</label>
            <input className="input" value={company.iban} onChange={e => setCompany({...company, iban: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary">Speichern</button>
        </form>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2>
            <form onSubmit={saveCategory} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Name</label>
                <input className="input" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Standardpreis (CHF)</label>
                <input type="number" step="0.01" className="input" value={categoryForm.default_price} onChange={e => setCategoryForm({...categoryForm, default_price: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCategoryModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="modal-overlay" onClick={() => setShowWebhookModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Neue Lead-Quelle</h2>
            <form onSubmit={createWebhook} style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Name</label>
                <input className="input" value={webhookForm.name} onChange={e => setWebhookForm({...webhookForm, name: e.target.value})} placeholder="z.B. praemien-vergleichen.ch" required />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Kategorie (optional)</label>
                <select className="input" value={webhookForm.category_id} onChange={e => setWebhookForm({...webhookForm, category_id: e.target.value})}>
                  <option value="">Alle Kategorien</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowWebhookModal(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Erstellen</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
