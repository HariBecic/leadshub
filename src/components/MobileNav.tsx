'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Menu, X, ChevronDown, ChevronRight,
  LayoutDashboard, TrendingUp, Users, FileText, 
  Briefcase, Package, Settings
} from 'lucide-react'

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const [featuresOpen, setFeaturesOpen] = useState(true)
  const pathname = usePathname()

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard', desc: 'Übersicht & Statistiken' },
    { href: '/leads', icon: TrendingUp, label: 'Leads', desc: 'Lead-Verwaltung' },
    { href: '/brokers', icon: Users, label: 'Broker', desc: 'Partner verwalten' },
    { href: '/invoices', icon: FileText, label: 'Rechnungen', desc: 'Zahlungen & Abrechnungen' },
    { href: '/contracts', icon: Briefcase, label: 'Verträge', desc: 'Broker-Verträge' },
    { href: '/packages', icon: Package, label: 'Pakete', desc: 'Lead-Pakete & Abos' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="mobile-header">
        <Link href="/" className="mobile-header-logo">
          <img src="/logo.png" alt="LeadsHub" />
        </Link>
        <button 
          className="mobile-menu-btn" 
          onClick={() => setIsOpen(true)}
          aria-label="Menü öffnen"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Full Screen Menu Overlay */}
      {isOpen && (
        <div className="heyflow-menu-overlay">
          <div className="heyflow-menu">
            {/* Menu Header */}
            <div className="heyflow-menu-header">
              <Link href="/" onClick={() => setIsOpen(false)} className="heyflow-menu-logo">
                <img src="/logo.png" alt="LeadsHub" />
              </Link>
              <button 
                className="heyflow-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Menü schliessen"
              >
                <X size={24} />
              </button>
            </div>

            {/* Menu Content */}
            <div className="heyflow-menu-content">
              {/* Quick Actions */}
              <div className="heyflow-actions">
                <Link href="/leads" className="heyflow-action-btn outline" onClick={() => setIsOpen(false)}>
                  Leads
                </Link>
                <Link href="/brokers" className="heyflow-action-btn filled" onClick={() => setIsOpen(false)}>
                  Broker
                </Link>
              </div>

              {/* Divider */}
              <div className="heyflow-divider"></div>

              {/* Features Section - Collapsible */}
              <div className="heyflow-section">
                <button 
                  className="heyflow-section-toggle"
                  onClick={() => setFeaturesOpen(!featuresOpen)}
                >
                  <span>NAVIGATION</span>
                  {featuresOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {featuresOpen && (
                  <div className="heyflow-nav-items">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`heyflow-nav-item ${isActive(item.href) ? 'active' : ''}`}
                        onClick={() => setIsOpen(false)}
                      >
                        <item.icon size={22} strokeWidth={1.5} />
                        <div className="heyflow-nav-text">
                          <span className="heyflow-nav-category">
                            {item.label.toUpperCase()}
                          </span>
                          <span className="heyflow-nav-label">{item.desc}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="heyflow-divider"></div>

              {/* Settings */}
              <Link 
                href="/settings" 
                className="heyflow-settings-link"
                onClick={() => setIsOpen(false)}
              >
                <Settings size={20} />
                <span>Einstellungen</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Mobile Header */
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(15, 15, 35, 0.98);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0 16px;
          align-items: center;
          justify-content: space-between;
          z-index: 100;
        }

        .mobile-header-logo img {
          height: 26px;
        }

        .mobile-menu-btn {
          background: none;
          border: none;
          color: white;
          padding: 8px;
          cursor: pointer;
          border-radius: 10px;
          transition: background 0.2s;
        }

        .mobile-menu-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        /* Heyflow Style Menu Overlay */
        .heyflow-menu-overlay {
          position: fixed;
          inset: 0;
          background: linear-gradient(180deg, #e8f4fc 0%, #f0f5fa 100%);
          z-index: 1000;
          animation: heyflowFadeIn 0.25s ease;
          overflow-y: auto;
        }

        @keyframes heyflowFadeIn {
          from { 
            opacity: 0;
          }
          to { 
            opacity: 1;
          }
        }

        .heyflow-menu {
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }

        /* Menu Header */
        .heyflow-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: white;
          margin: 12px;
          border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
        }

        .heyflow-menu-logo img {
          height: 28px;
        }

        .heyflow-close-btn {
          background: none;
          border: none;
          color: #1a1a2e;
          padding: 8px;
          cursor: pointer;
          border-radius: 10px;
          transition: background 0.2s;
        }

        .heyflow-close-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        /* Menu Content */
        .heyflow-menu-content {
          flex: 1;
          padding: 8px 20px 40px;
        }

        /* Quick Actions */
        .heyflow-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .heyflow-action-btn {
          flex: 1;
          padding: 15px 24px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 15px;
          text-align: center;
          text-decoration: none;
          transition: all 0.2s;
        }

        .heyflow-action-btn.outline {
          background: white;
          color: #1a1a2e;
          border: 1.5px solid #e2e8f0;
        }

        .heyflow-action-btn.outline:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        .heyflow-action-btn.filled {
          background: #1a1a2e;
          color: white;
          border: none;
        }

        .heyflow-action-btn.filled:hover {
          background: #2d2d4a;
        }

        /* Divider */
        .heyflow-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 16px 0;
        }

        /* Section Toggle */
        .heyflow-section-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 14px 4px;
          background: none;
          border: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1.2px;
          cursor: pointer;
        }

        .heyflow-section-toggle svg {
          color: #94a3b8;
        }

        /* Nav Items */
        .heyflow-nav-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-top: 8px;
        }

        .heyflow-nav-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 18px;
          background: white;
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
        }

        .heyflow-nav-item:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .heyflow-nav-item.active {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%);
          border-left: 3px solid #8b5cf6;
        }

        .heyflow-nav-item svg {
          color: #64748b;
          flex-shrink: 0;
        }

        .heyflow-nav-item.active svg {
          color: #8b5cf6;
        }

        .heyflow-nav-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .heyflow-nav-category {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.5px;
        }

        .heyflow-nav-item.active .heyflow-nav-category {
          color: #8b5cf6;
        }

        .heyflow-nav-label {
          font-size: 15px;
          font-weight: 500;
          color: #1e293b;
        }

        /* Settings Link */
        .heyflow-settings-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          color: #64748b;
          text-decoration: none;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .heyflow-settings-link:hover {
          background: rgba(0, 0, 0, 0.03);
          color: #1e293b;
        }

        .heyflow-settings-link span {
          font-size: 15px;
          font-weight: 500;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .mobile-header {
            display: flex;
          }

          .sidebar {
            display: none !important;
          }

          .main-content {
            margin-left: 0 !important;
            padding-top: 76px !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-header {
            display: none !important;
          }

          .heyflow-menu-overlay {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
