'use client'

import { useEffect, useState } from 'react'
import { supabase, LeadCategory, LeadSource, Setting } from '@/lib/supabase'
import { Plus, Copy, Check, Trash2 } from 'lucide-react'

export default function EinstellungenPage() {
  const [categories, setCategories] = useState<LeadCategory[]>([])
  const [sources, setSources] = useState<LeadSource[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showSourceModal, setShowSourceModal] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [catRes, srcRes, setRes] = await Promise.all([
        supabase.from('lead_categories').select('*').order('name'),
        supabase.from('lead_sources').select('*, category:lead_categories(*)').order('created_at', { ascending: false }),
        supabase.from('settings').select('*'),
      ])
      setCategories(catRes.data || [])
      setSources(srcRes.data || [])
      const settingsMap: Record<string, string> = {}
      setRes.data?.forEach(s => { settingsMap[s.key] = s.value || '' })
      setSettings(settingsMap)
    } catch (error) { console.error('Error:', error) }
    finally { setLoading(false) }
  }

  async function updateSetting(key: string, value: string) {
    try {
      const { error } = await supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
      if (error) throw error
      setSettings({ ...settings, [key]: value })
    } catch (error) { console.error('Error:', error) }
  }

  function copyWebhookUrl(token: string) {
    const url = `${window.location.origin}/api/webhook/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Einstellungen</h1>

      {/* Lead Categories */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Lead-Kategorien</h2>
          <button onClick={() => setShowCategoryModal(true)} className="btn btn-secondary"><Plus size={16} />Neue Kategorie</button>
        </div>
        <table className="table">
          <thead><tr><th>Name</th><th>Standardpreis</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="font-medium">{cat.name}</td>
                <td>CHF {cat.default_price.toFixed(2)}</td>
                <td><span className={`badge ${cat.active ? 'badge-success' : 'badge-neutral'}`}>{cat.active ? 'Aktiv' : 'Inaktiv'}</span></td>
                <td><button className="btn btn-ghost text-xs">Bearbeiten</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lead Sources / Webhooks */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Lead-Quellen (Webhooks)</h2>
          <button onClick={() => setShowSourceModal(true)} className="btn btn-secondary"><Plus size={16} />Neue Quelle</button>
        </div>
        {sources.length === 0 ? (
          <p className="text-gray-500 text-sm">Keine Quellen konfiguriert</p>
        ) : (
          <div className="space-y-3">
            {sources.map((src) => (
              <div key={src.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{src.name}</div>
                  <div className="text-sm text-gray-500">{(src as any).category?.name || 'Alle Kategorien'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-gray-200 px-2 py-1 rounded">/api/webhook/{src.webhook_token.slice(0, 8)}...</code>
                  <button onClick={() => copyWebhookUrl(src.webhook_token)} className="btn btn-ghost">
                    {copiedToken === src.webhook_token ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company Settings */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Firmenangaben (für Rechnungen)</h2>
        <div className="space-y-4">
          <div><label className="input-label">Firmenname</label><input type="text" value={settings.company_name || ''} onChange={(e) => updateSetting('company_name', e.target.value)} className="input" placeholder="LeadsHub GmbH" /></div>
          <div><label className="input-label">Adresse</label><input type="text" value={settings.company_address || ''} onChange={(e) => updateSetting('company_address', e.target.value)} className="input" placeholder="Musterstrasse 1, 8000 Zürich" /></div>
          <div><label className="input-label">MwSt-Nummer</label><input type="text" value={settings.company_vat_number || ''} onChange={(e) => updateSetting('company_vat_number', e.target.value)} className="input" placeholder="CHE-123.456.789" /></div>
          <div><label className="input-label">IBAN</label><input type="text" value={settings.company_iban || ''} onChange={(e) => updateSetting('company_iban', e.target.value)} className="input" placeholder="CH12 3456 7890 1234 5678 9" /></div>
        </div>
      </div>

      {showCategoryModal && <CategoryModal onClose={() => setShowCategoryModal(false)} onSave={() => { setShowCategoryModal(false); loadData() }} />}
      {showSourceModal && <SourceModal categories={categories} onClose={() => setShowSourceModal(false)} onSave={() => { setShowSourceModal(false); loadData() }} />}
    </div>
  )
}

function CategoryModal({ onClose, onSave }: { onClose: () => void, onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', slug: '', default_price: 35 })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-')
      const { error } = await supabase.from('lead_categories').insert([{ ...formData, slug, active: true }])
      if (error) throw error
      onSave()
    } catch (error) { console.error('Error:', error); alert('Fehler beim Erstellen') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Neue Kategorie</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="input-label">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="z.B. Lebensversicherung" /></div>
          <div><label className="input-label">Standardpreis (CHF)</label><input type="number" value={formData.default_price} onChange={(e) => setFormData({ ...formData, default_price: parseFloat(e.target.value) })} className="input" min="0" step="0.01" /></div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SourceModal({ categories, onClose, onSave }: { categories: LeadCategory[], onClose: () => void, onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', category_id: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const webhook_token = crypto.randomUUID()
      const { error } = await supabase.from('lead_sources').insert([{ ...formData, webhook_token, category_id: formData.category_id || null, active: true }])
      if (error) throw error
      onSave()
    } catch (error) { console.error('Error:', error); alert('Fehler beim Erstellen') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Neue Lead-Quelle</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="input-label">Name *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="z.B. praemien-vergleichen.ch" /></div>
          <div><label className="input-label">Kategorie (optional)</label><select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="select"><option value="">Alle Kategorien</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">Abbrechen</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Speichern...' : 'Speichern'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
