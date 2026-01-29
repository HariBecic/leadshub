'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Phone, Calendar, Award } from 'lucide-react'

type FeedbackStatus = 'not_reached' | 'reached' | 'scheduled' | 'closed'

function FollowupContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [assignment, setAssignment] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | null>(null)
  const [notes, setNotes] = useState('')
  const [commissionAmount, setCommissionAmount] = useState('')
  const [debugInfo, setDebugInfo] = useState('')

  const token = searchParams.get('token')
  const id = params.id as string

  useEffect(() => {
    if (token && id) {
      loadAssignment()
    } else {
      setError('Token oder ID fehlt')
      setLoading(false)
    }
  }, [token, id])

  async function loadAssignment() {
    try {
      const url = `/api/followup/${id}?token=${token}`
      setDebugInfo(`Loading: ${url}`)
      const res = await fetch(url)
      const data = await res.json()
      
      if (data.error) {
        setError(data.error)
      } else {
        setAssignment(data)
      }
    } catch (e: any) {
      setError('Fehler beim Laden: ' + e.message)
    }
    setLoading(false)
  }

  async function submitFeedback(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    if (!selectedStatus || submitting) return
    setSubmitting(true)
    setError('')

    try {
      const url = `/api/followup/${id}`
      const body = {
        token,
        status: selectedStatus,
        notes,
        commission_amount: selectedStatus === 'closed' ? parseFloat(commissionAmount) : null
      }
      
      setDebugInfo(`POST to: ${url}, body: ${JSON.stringify(body)}`)
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      
      setDebugInfo(`Response: ${JSON.stringify(data)}`)
      
      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error || 'Fehler beim Speichern')
        if (data.details) {
          setError(`${data.error}: ${data.details}`)
        }
      }
    } catch (e: any) {
      setError('Netzwerkfehler: ' + e.message)
    }
    setSubmitting(false)
  }

  // Styles
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f1f5f9',
    padding: '40px 20px',
    marginLeft: 0,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    overflow: 'auto'
  }

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p>Laden...</p>
        </div>
      </div>
    )
  }

  if (error && !assignment) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px' }}>
          <XCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
          <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Fehler</h1>
          <p style={{ color: '#64748b' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px' }}>
          <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
          <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Vielen Dank!</h1>
          <p style={{ color: '#64748b' }}>Dein Feedback wurde gespeichert.</p>
          {selectedStatus === 'not_reached' && (
            <p style={{ color: '#f97316', marginTop: '16px', fontSize: '14px' }}>
              Der Lead wird wieder freigegeben und kann erneut vermittelt werden.
            </p>
          )}
          {selectedStatus === 'closed' && (
            <p style={{ color: '#22c55e', marginTop: '16px', fontSize: '14px' }}>
              Herzlichen Glückwunsch zum Abschluss! Die Provision wird verrechnet.
            </p>
          )}
          {(selectedStatus === 'reached' || selectedStatus === 'scheduled') && (
            <p style={{ color: '#3b82f6', marginTop: '16px', fontSize: '14px' }}>
              Wir melden uns in 3 Tagen wieder für ein Update.
            </p>
          )}
        </div>
      </div>
    )
  }

  const statusOptions = [
    { id: 'not_reached', label: 'Nicht erreicht', description: 'Kunde war nicht erreichbar', icon: XCircle, color: '#ef4444', bg: '#fee2e2' },
    { id: 'reached', label: 'Erreicht', description: 'Gespräch geführt, noch offen', icon: Phone, color: '#f97316', bg: '#ffedd5' },
    { id: 'scheduled', label: 'Terminiert', description: 'Beratungstermin vereinbart', icon: Calendar, color: '#3b82f6', bg: '#dbeafe' },
    { id: 'closed', label: 'Abgeschlossen', description: 'Police abgeschlossen', icon: Award, color: '#22c55e', bg: '#dcfce7' },
  ]

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Lead Feedback</h1>
          <p style={{ color: '#64748b' }}>Wie ist der Stand mit diesem Lead?</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Lead</div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>{assignment?.lead?.first_name} {assignment?.lead?.last_name}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {assignment?.lead?.email && (
              <div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>E-Mail</div>
                <div style={{ fontSize: '14px' }}>{assignment.lead.email}</div>
              </div>
            )}
            {assignment?.lead?.phone && (
              <div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Telefon</div>
                <div style={{ fontSize: '14px' }}>{assignment.lead.phone}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Status auswählen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {statusOptions.map((option) => {
                const Icon = option.icon
                const isSelected = selectedStatus === option.id
                return (
                  <div
                    key={option.id}
                    onClick={() => setSelectedStatus(option.id as FeedbackStatus)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '16px',
                      border: isSelected ? `2px solid ${option.color}` : '2px solid #e2e8f0',
                      borderRadius: '12px',
                      background: isSelected ? option.bg : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '10px', 
                      background: option.bg, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <Icon size={22} color={option.color} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{option.label}</div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>{option.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {selectedStatus === 'closed' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Provisionsbetrag (CHF)
              </label>
              <input
                type="number"
                value={commissionAmount}
                onChange={(e) => setCommissionAmount(e.target.value)}
                placeholder="z.B. 500"
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  border: '2px solid #e2e8f0', 
                  borderRadius: '10px', 
                  fontSize: '15px',
                  background: '#f8fafc' 
                }}
              />
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                Unsere Beteiligung: {assignment?.revenue_share_percent}% = CHF {commissionAmount ? (parseFloat(commissionAmount) * (assignment?.revenue_share_percent || 0) / 100).toFixed(2) : '0.00'}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Notizen (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Weitere Infos zum Lead..."
              rows={3}
              style={{ 
                width: '100%', 
                padding: '12px 16px', 
                border: '2px solid #e2e8f0', 
                borderRadius: '10px', 
                fontSize: '15px',
                resize: 'none', 
                background: '#f8fafc' 
              }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: '16px', padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submitFeedback}
            disabled={!selectedStatus || submitting}
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: '16px',
              background: (!selectedStatus || submitting) ? '#cbd5e1' : '#3A29A6',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: (!selectedStatus || submitting) ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Wird gespeichert...' : 'Feedback absenden'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FollowupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>Laden...</div>}>
      <FollowupContent />
    </Suspense>
  )
}
