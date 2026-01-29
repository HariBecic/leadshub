'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Broker, Contract, LeadCategory, LeadAssignment } from '@/lib/supabase'
import { ArrowLeft, Plus, Mail, Phone, Edit, Trash2 } from 'lucide-react'

export default function BrokerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [broker, setBroker] = useState<Broker | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [categories, setCategories] = useState<LeadCategory[]>([])
  const [assignments, setAssignments] = useState<LeadAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showContractModal, setShowContractModal] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    loadBrokerData()
  }, [params.id])

  async function loadBrokerData() {
    try {
      // Load broker
      const { data: brokerData, error: brokerError } = await supabase
        .from('brokers')
        .select('*')
        .eq('id', params.id)
        .single()

      if (brokerError) throw brokerError
      setBroker(brokerData)

      // Load contracts
      const { data: contractsData } = await supabase
        .from('contracts')
        .select('*, category:lead_categories(*)')
        .eq('broker_id', params.id)
        .order('created_at', { ascending: false })

      setContracts(contractsData || [])

      // Load categories
      const { data: categoriesData } = await supabase
        .from('lead_categories')
        .select('*')
        .eq('active', true)

      setCategories(categoriesData || [])

      // Load recent assignments
      const { data: assignmentsData } = await supabase
        .from('lead_assignments')
        .select('*, lead:leads(*, category:lead_categories(*))')
        .eq('broker_id', params.id)
        .order('assigned_at', { ascending: false })
        .limit(10)

      setAssignments(assignmentsData || [])
    } catch (error) {
      console.error('Error loading broker:', error)
    } finally {
      setLoading(false)
    }
  }

  async function deleteBroker() {
    if (!confirm('Broker wirklich löschen? Alle Verträge werden ebenfalls gelöscht.')) return

    try {
      const { error } = await supabase
        .from('brokers')
        .delete()
        .eq('id', params.id)

      if (error) throw error
      router.push('/broker')
    } catch (error) {
      console.error('Error deleting broker:', error)
      alert('Fehler beim Löschen')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Aktiv</span>
      case 'paused':
        return <span className="badge badge-warning">Pausiert</span>
      case 'expired':
        return <span className="badge badge-danger">Abgelaufen</span>
      default:
        return <span className="badge badge-neutral">{status}</span>
    }
  }

  const getPricingLabel = (contract: Contract) => {
    switch (contract.pricing_model) {
      case 'fixed':
        return `CHF ${contract.price_per_lead}/Lead`
      case 'subscription':
        return `CHF ${contract.monthly_fee}/Mt. (${contract.monthly_quota} Leads)`
      case 'revenue_share':
        return `${contract.revenue_share_percent}% Beteiligung`
      default:
        return '-'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!broker) {
    return <div>Broker nicht gefunden</div>
  }

  return (
    <div>
      <Link href="/broker" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft size={20} />
        Zurück
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Broker Info */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-xl font-bold">{broker.name}</h1>
              <div className="flex gap-2">
                <button onClick={() => setShowEditModal(true)} className="btn btn-ghost">
                  <Edit size={16} />
                </button>
                <button onClick={deleteBroker} className="btn btn-ghost text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {broker.contact_person && (
              <p className="text-gray-600 mb-2">{broker.contact_person}</p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail size={16} />
                <a href={`mailto:${broker.email}`} className="hover:text-blue-600">
                  {broker.email}
                </a>
              </div>
              {broker.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={16} />
                  <a href={`tel:${broker.phone}`} className="hover:text-blue-600">
                    {broker.phone}
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              {getStatusBadge(broker.status)}
            </div>

            {broker.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">{broker.notes}</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="card mt-4">
            <h2 className="font-semibold mb-4">Statistiken</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Leads diesen Monat</span>
                <span className="font-medium">{assignments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Aktive Verträge</span>
                <span className="font-medium">
                  {contracts.filter(c => c.status === 'active').length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contracts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Verträge</h2>
              <button
                onClick={() => { setEditingContract(null); setShowContractModal(true) }}
                className="btn btn-primary"
              >
                <Plus size={16} />
                Neuer Vertrag
              </button>
            </div>

            {contracts.length === 0 ? (
              <p className="text-gray-500 text-sm">Keine Verträge vorhanden</p>
            ) : (
              <div className="space-y-3">
                {contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {(contract.category as any)?.name || 'Alle Kategorien'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {getPricingLabel(contract)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(contract.status)}
                      <button
                        onClick={() => { setEditingContract(contract); setShowContractModal(true) }}
                        className="btn btn-ghost"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Assignments */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Letzte Leads</h2>

            {assignments.length === 0 ? (
              <p className="text-gray-500 text-sm">Noch keine Leads zugewiesen</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => {
                  const lead = assignment.lead as any
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <span className="font-medium">
                          {lead?.first_name} {lead?.last_name}
                        </span>
                        <span className="text-gray-500 ml-2">
                          {lead?.category?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-xs">
                          {new Date(assignment.assigned_at).toLocaleDateString('de-CH')}
                        </span>
                        <span className={`badge ${
                          assignment.status === 'success' ? 'badge-success' :
                          assignment.status === 'returned' ? 'badge-danger' :
                          'badge-info'
                        }`}>
                          {assignment.status === 'success' ? 'Erfolg' :
                           assignment.status === 'returned' ? 'Zurück' :
                           'Gesendet'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contract Modal */}
      {showContractModal && (
        <ContractModal
          contract={editingContract}
          brokerId={broker.id}
          categories={categories}
          onClose={() => setShowContractModal(false)}
          onSave={() => {
            setShowContractModal(false)
            loadBrokerData()
          }}
        />
      )}

      {/* Edit Broker Modal */}
      {showEditModal && (
        <EditBrokerModal
          broker={broker}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false)
            loadBrokerData()
          }}
        />
      )}
    </div>
  )
}

interface ContractModalProps {
  contract: Contract | null
  brokerId: string
  categories: LeadCategory[]
  onClose: () => void
  onSave: () => void
}

function ContractModal({ contract, brokerId, categories, onClose, onSave }: ContractModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    category_id: contract?.category_id || '',
    pricing_model: contract?.pricing_model || 'fixed',
    price_per_lead: contract?.price_per_lead || 35,
    monthly_quota: contract?.monthly_quota || 20,
    monthly_fee: contract?.monthly_fee || 500,
    revenue_share_percent: contract?.revenue_share_percent || 50,
    followup_days: contract?.followup_days || 3,
    max_attempts: contract?.max_attempts || 2,
    distribution_rule: contract?.distribution_rule || 'instant',
    distribution_amount: contract?.distribution_amount || 1,
    priority: contract?.priority || 5,
    status: contract?.status || 'active',
    valid_from: contract?.valid_from || new Date().toISOString().split('T')[0],
    valid_until: contract?.valid_until || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        broker_id: brokerId,
        category_id: formData.category_id || null,
        pricing_model: formData.pricing_model,
        price_per_lead: formData.pricing_model === 'fixed' ? formData.price_per_lead : null,
        monthly_quota: formData.pricing_model === 'subscription' ? formData.monthly_quota : null,
        monthly_fee: formData.pricing_model === 'subscription' ? formData.monthly_fee : null,
        revenue_share_percent: formData.pricing_model === 'revenue_share' ? formData.revenue_share_percent : null,
        followup_days: formData.pricing_model === 'revenue_share' ? formData.followup_days : null,
        max_attempts: formData.pricing_model === 'revenue_share' ? formData.max_attempts : null,
        distribution_rule: formData.distribution_rule,
        distribution_amount: formData.distribution_amount,
        priority: formData.priority,
        status: formData.status,
        valid_from: formData.valid_from || null,
        valid_until: formData.valid_until || null,
      }

      if (contract) {
        const { error } = await supabase
          .from('contracts')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', contract.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('contracts')
          .insert([data])

        if (error) throw error
      }

      onSave()
    } catch (error) {
      console.error('Error saving contract:', error)
      alert('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  async function deleteContract() {
    if (!contract) return
    if (!confirm('Vertrag wirklich löschen?')) return

    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', contract.id)

      if (error) throw error
      onSave()
    } catch (error) {
      console.error('Error deleting contract:', error)
      alert('Fehler beim Löschen')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">
          {contract ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Kategorie</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="select"
            >
              <option value="">Alle Kategorien</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="input-label">Preismodell</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pricing_model"
                  value="fixed"
                  checked={formData.pricing_model === 'fixed'}
                  onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value as any })}
                />
                Fixpreis pro Lead
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pricing_model"
                  value="subscription"
                  checked={formData.pricing_model === 'subscription'}
                  onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value as any })}
                />
                Abo / Kontingent
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pricing_model"
                  value="revenue_share"
                  checked={formData.pricing_model === 'revenue_share'}
                  onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value as any })}
                />
                Gewinnbeteiligung
              </label>
            </div>
          </div>

          {/* Fixed pricing fields */}
          {formData.pricing_model === 'fixed' && (
            <div>
              <label className="input-label">Preis pro Lead (CHF)</label>
              <input
                type="number"
                value={formData.price_per_lead}
                onChange={(e) => setFormData({ ...formData, price_per_lead: parseFloat(e.target.value) })}
                className="input"
                min="0"
                step="0.01"
              />
            </div>
          )}

          {/* Subscription fields */}
          {formData.pricing_model === 'subscription' && (
            <>
              <div>
                <label className="input-label">Monatliche Gebühr (CHF)</label>
                <input
                  type="number"
                  value={formData.monthly_fee}
                  onChange={(e) => setFormData({ ...formData, monthly_fee: parseFloat(e.target.value) })}
                  className="input"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="input-label">Leads pro Monat</label>
                <input
                  type="number"
                  value={formData.monthly_quota}
                  onChange={(e) => setFormData({ ...formData, monthly_quota: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                />
              </div>
            </>
          )}

          {/* Revenue share fields */}
          {formData.pricing_model === 'revenue_share' && (
            <>
              <div>
                <label className="input-label">Beteiligung (%)</label>
                <input
                  type="number"
                  value={formData.revenue_share_percent}
                  onChange={(e) => setFormData({ ...formData, revenue_share_percent: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                  max="100"
                />
              </div>
              <div>
                <label className="input-label">Nachfass nach (Tage)</label>
                <input
                  type="number"
                  value={formData.followup_days}
                  onChange={(e) => setFormData({ ...formData, followup_days: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                />
              </div>
              <div>
                <label className="input-label">Max. Versuche</label>
                <input
                  type="number"
                  value={formData.max_attempts}
                  onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Verteilung</label>
              <select
                value={formData.distribution_rule}
                onChange={(e) => setFormData({ ...formData, distribution_rule: e.target.value as any })}
                className="select"
              >
                <option value="instant">Sofort</option>
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
              </select>
            </div>
            <div>
              <label className="input-label">Priorität (1-10)</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="input"
                min="1"
                max="10"
              />
            </div>
          </div>

          <div>
            <label className="input-label">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="select"
            >
              <option value="active">Aktiv</option>
              <option value="paused">Pausiert</option>
              <option value="expired">Abgelaufen</option>
            </select>
          </div>

          <div className="flex justify-between pt-4">
            <div>
              {contract && (
                <button type="button" onClick={deleteContract} className="btn btn-danger">
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Abbrechen
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditBrokerModalProps {
  broker: Broker
  onClose: () => void
  onSave: () => void
}

function EditBrokerModal({ broker, onClose, onSave }: EditBrokerModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: broker.name,
    contact_person: broker.contact_person || '',
    email: broker.email,
    phone: broker.phone || '',
    status: broker.status,
    notes: broker.notes || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('brokers')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', broker.id)

      if (error) throw error
      onSave()
    } catch (error) {
      console.error('Error updating broker:', error)
      alert('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Broker bearbeiten</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Firmenname *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="input-label">Kontaktperson</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="input-label">E-Mail *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="input-label">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="input-label">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="select"
            >
              <option value="active">Aktiv</option>
              <option value="paused">Pausiert</option>
              <option value="inactive">Inaktiv</option>
            </select>
          </div>

          <div>
            <label className="input-label">Notizen</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
