'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, FileText, Calendar, Percent, CreditCard } from 'lucide-react'

function VertragContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [contract, setContract] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const token = searchParams.get('token')
  const id = params.id as string

  useEffect(() => {
    if (token && id) {
      loadContract()
    } else {
      setError('Token oder ID fehlt')
      setLoading(false)
    }
  }, [token, id])

  async function loadContract() {
    try {
      const res = await fetch(`/api/contracts/${id}?token=${token}`)
      const data = await res.json()
      
      if (data.error) {
        setError(data.error)
      } else {
        setContract(data)
      }
    } catch {
      setError('Fehler beim Laden')
    }
    setLoading(false)
  }

  async function confirmContract() {
    setConfirming(true)
    setError('')

    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const data = await res.json()
      
      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error || 'Fehler beim Bestätigen')
      }
    } catch {
      setError('Netzwerkfehler')
    }
    setConfirming(false)
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f1f5f9',
    padding: '40px 20px',
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
          <p>Vertrag wird geladen...</p>
        </div>
      </div>
    )
  }

  if (error && !contract) {
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

  if (success || contract?.status === 'active') {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '450px' }}>
          <CheckCircle size={56} color="#22c55e" style={{ marginBottom: '16px' }} />
          <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#166534' }}>Vertrag bestätigt!</h1>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>
            Vielen Dank! Ihr Vertrag ist jetzt aktiv. Sie können ab sofort Leads erhalten.
          </p>
          <div style={{ background: '#dcfce7', padding: '16px', borderRadius: '10px', color: '#166534', fontSize: '14px' }}>
            {contract?.pricing_model === 'subscription' && `Abo: CHF ${contract.monthly_fee}/Monat`}
            {contract?.pricing_model === 'revenue_share' && `Beteiligung: ${contract.revenue_share_percent}% bei Abschluss`}
            {contract?.pricing_model === 'fixed' && `Fixpreis: CHF ${contract.price_per_lead} pro Lead`}
          </div>
        </div>
      </div>
    )
  }

  const getPricingIcon = () => {
    if (contract.pricing_model === 'subscription') return <CreditCard size={32} />
    if (contract.pricing_model === 'revenue_share') return <Percent size={32} />
    return <FileText size={32} />
  }

  const getPricingColor = () => {
    if (contract.pricing_model === 'subscription') return { bg: '#dbeafe', color: '#1e40af' }
    if (contract.pricing_model === 'revenue_share') return { bg: '#f3e8ff', color: '#7c3aed' }
    return { bg: '#dcfce7', color: '#166534' }
  }

  const colors = getPricingColor()

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: '550px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Vertragsangebot</h1>
          <p style={{ color: '#64748b' }}>Bitte prüfen Sie die Details und bestätigen Sie den Vertrag</p>
        </div>

        {/* Broker Info */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Vertragspartner</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>{contract.broker?.name}</div>
          {contract.broker?.contact_person && (
            <div style={{ color: '#64748b', marginTop: '4px' }}>{contract.broker.contact_person}</div>
          )}
        </div>

        {/* Contract Details */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: colors.bg, color: colors.color, padding: '12px', borderRadius: '12px' }}>
              {getPricingIcon()}
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Vertragstyp</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: colors.color }}>
                {contract.pricing_model === 'subscription' && 'Abo-Vertrag'}
                {contract.pricing_model === 'revenue_share' && 'Beteiligungsvertrag'}
                {contract.pricing_model === 'fixed' && 'Fixpreis-Vertrag'}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <table style={{ width: '100%', fontSize: '15px' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#64748b', padding: '10px 0' }}>Kategorie:</td>
                  <td style={{ fontWeight: 500, textAlign: 'right' }}>{contract.category}</td>
                </tr>
                
                {contract.pricing_model === 'subscription' && (
                  <tr>
                    <td style={{ color: '#64748b', padding: '10px 0' }}>Monatliche Gebühr:</td>
                    <td style={{ fontWeight: 700, fontSize: '18px', textAlign: 'right', color: colors.color }}>
                      CHF {contract.monthly_fee}
                    </td>
                  </tr>
                )}

                {contract.pricing_model === 'revenue_share' && (
                  <>
                    <tr>
                      <td style={{ color: '#64748b', padding: '10px 0' }}>Ihre Beteiligung:</td>
                      <td style={{ fontWeight: 700, fontSize: '18px', textAlign: 'right', color: colors.color }}>
                        {contract.revenue_share_percent}%
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: '#64748b', padding: '10px 0' }}>Follow-up nach:</td>
                      <td style={{ fontWeight: 500, textAlign: 'right' }}>{contract.followup_days} Tagen</td>
                    </tr>
                  </>
                )}

                {contract.pricing_model === 'fixed' && (
                  <tr>
                    <td style={{ color: '#64748b', padding: '10px 0' }}>Preis pro Lead:</td>
                    <td style={{ fontWeight: 700, fontSize: '18px', textAlign: 'right', color: colors.color }}>
                      CHF {contract.price_per_lead}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Terms */}
        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', marginBottom: '24px', fontSize: '14px', color: '#64748b' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>Vertragsbedingungen</div>
          {contract.pricing_model === 'subscription' && (
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Monatliche Abrechnung</li>
              <li>Unbegrenzte Leads inklusive</li>
              <li>Jederzeit kündbar mit 30 Tagen Frist</li>
            </ul>
          )}
          {contract.pricing_model === 'revenue_share' && (
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Leads werden kostenlos geliefert</li>
              <li>Zahlung nur bei erfolgreichem Abschluss</li>
              <li>Wir fragen nach {contract.followup_days} Tagen nach dem Status</li>
              <li>Bei 2x "Kein Interesse" wird der Lead geschlossen</li>
            </ul>
          )}
          {contract.pricing_model === 'fixed' && (
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Fester Preis pro Lead</li>
              <li>Sofortige Lieferung nach Zuweisung</li>
              <li>Monatliche Abrechnung</li>
            </ul>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={confirmContract}
          disabled={confirming}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            fontWeight: 600,
            background: confirming ? '#94a3b8' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: confirming ? 'not-allowed' : 'pointer'
          }}
        >
          {confirming ? 'Wird bestätigt...' : '✓ Vertrag annehmen'}
        </button>

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '16px' }}>
          Mit der Bestätigung akzeptieren Sie die Vertragsbedingungen.
        </p>
      </div>
    </div>
  )
}

export default function VertragPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>Laden...</div>}>
      <VertragContent />
    </Suspense>
  )
}
