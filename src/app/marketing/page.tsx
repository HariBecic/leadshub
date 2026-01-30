'use client'
import Link from 'next/link'
import { TrendingUp, ExternalLink } from 'lucide-react'

export default function MarketingPage() {
  const channels = [
    {
      id: 'meta',
      name: 'Meta Ads',
      description: 'Facebook & Instagram Kampagnen',
      icon: 'f',
      gradient: 'linear-gradient(135deg, #1877F2, #0866FF)',
      href: '/marketing/meta',
      active: true
    },
    {
      id: 'tiktok',
      name: 'TikTok Ads',
      description: 'Demnächst verfügbar',
      icon: 'T',
      gradient: 'linear-gradient(135deg, #000, #25F4EE)',
      href: '/marketing/tiktok',
      active: false
    },
    {
      id: 'google',
      name: 'Google Ads',
      description: 'Demnächst verfügbar',
      icon: 'G',
      gradient: 'linear-gradient(135deg, #4285F4, #34A853)',
      href: '/marketing/google',
      active: false
    },
    {
      id: 'plattformen',
      name: 'Plattformen',
      description: 'praemien-vergleichen.ch & mehr',
      icon: 'P',
      gradient: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
      href: '/marketing/plattformen',
      active: false
    }
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Marketing</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
            Werbekanäle und Plattformen verwalten
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {channels.map(channel => (
          <Link 
            key={channel.id} 
            href={channel.active ? channel.href : '#'}
            className="card"
            style={{ 
              opacity: channel.active ? 1 : 0.5,
              cursor: channel.active ? 'pointer' : 'not-allowed',
              textDecoration: 'none',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '14px', 
                background: channel.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '24px',
                flexShrink: 0
              }}>
                {channel.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>{channel.name}</h2>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                  {channel.description}
                </p>
              </div>
              {channel.active && (
                <TrendingUp size={20} style={{ color: 'rgba(255,255,255,0.4)' }} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
