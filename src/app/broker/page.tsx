'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Broker } from '@/lib/supabase'
import { Plus, Search, MoreVertical, Mail, Phone } from 'lucide-react'

export default function BrokerPage() {
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingBroker, setEditingBroker] = useState<Broker | null>(null)

  useEffect(() => {
    loadBrokers()
  }, [])

  async function loadBrokers() {
    try {
      const { data, error } = await supabase
        .from('brokers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBrokers(data || [])
    } catch (error) {
      console.error('Error loading brokers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBrokers = brokers.filter(broker =>
    broker.name.toLowerCase().includes(search.toLowerCase()) ||
    broker.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
    broker.email.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Aktiv</span>
      case 'paused':
        return <span className="badge badge-warning">Pausiert</span>
      case 'inactive':
        return <span className="badge badge-danger">Inaktiv</span>
      default:
        return <span className="badge badge-neutral">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Broker</h1>
        <button 
          onClick={() => { setEditingBroker(null); setShowModal(true) }}
          className="btn btn-primary"
        >
          <Plus size={20} />
          Neuer Broker
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Suche nach Name, Kontakt oder E-Mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Broker List */}
      {filteredBrokers.length === 0 ? (
        <div className="card empty-state">
          <p>Keine Broker gefunden</p>
          <button 
            onClick={() => setShowModal(true)}
            className="btn btn-primary mt-4"
          >
            <Plus size={20} />
            Ersten Broker erstellen
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kontaktperson</th>
                <th>Kontakt</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredBrokers.map((broker) => (
                <tr key={broker.id}>
                  <td>
                    <Link 
                      href={`/broker/${broker.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {broker.name}
                    </Link>
                  </td>
                  <td>{broker.contact_person || '-'}</td>
                  <td>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail size={14} />
                        {broker.email}
                      </span>
                      {broker.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={14} />
                          {broker.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{getStatusBadge(broker.status)}</td>
                  <td>
                    <Link
                      href={`/broker/${broker.id}`}
                      className="btn btn-ghost"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <BrokerModal
          broker={editingBroker}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false)
            loadBrokers()
          }}
        />
      )}
    </div>
  )
}

interface BrokerModalProps {
  broker: Broker | null
  onClose: () => void
  onSave: () => void
}

function BrokerModal({ broker, onClose, onSave }: BrokerModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: broker?.name || '',
    contact_person: broker?.contact_person || '',
    email: broker?.email || '',
    phone: broker?.phone || '',
    status: broker?.status || 'active',
    notes: broker?.notes || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (broker) {
        // Update
        const { error } = await supabase
          .from('brokers')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', broker.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('brokers')
          .insert([formData])

        if (error) throw error
      }

      onSave()
    } catch (error) {
      console.error('Error saving broker:', error)
      alert('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">
          {broker ? 'Broker bearbeiten' : 'Neuer Broker'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Firmenname *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="z.B. Versicherung Müller AG"
            />
          </div>

          <div>
            <label className="input-label">Kontaktperson</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="input"
              placeholder="z.B. Hans Müller"
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
              placeholder="z.B. hans@mueller-versicherung.ch"
            />
          </div>

          <div>
            <label className="input-label">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              placeholder="z.B. 079 123 45 67"
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
              placeholder="Interne Notizen..."
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
