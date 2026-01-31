'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LayoutDashboard, Zap, Users, Package, FileText, Settings, Megaphone } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Zap },
  { href: '/broker', label: 'Broker', icon: Users },
  { href: '/pakete', label: 'Pakete', icon: Package },
  { href: '/rechnungen', label: 'Rechnungen', icon: FileText },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
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

      {/* Full Screen Menu Overlay - Dark Glass Design */}
      {isOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsOpen(false)}>
          <div className="mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
            {/* Menu Header */}
            <div className="mobile-menu-header">
              <Link href="/" onClick={() => setIsOpen(false)} className="mobile-menu-logo">
                <img src="/logo.png" alt="LeadsHub" />
              </Link>
              <button 
                className="mobile-menu-close"
                onClick={() => setIsOpen(false)}
                aria-label="Menü schliessen"
              >
                <X size={24} />
              </button>
            </div>

            {/* Menu Navigation */}
            <nav className="mobile-menu-nav">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-menu-link ${isActive(item.href) ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon size={22} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
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
          background: rgba(15, 15, 35, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
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
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 10px;
          cursor: pointer;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .mobile-menu-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* Menu Overlay */
        .mobile-menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 1000;
          animation: overlayFadeIn 0.2s ease;
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Menu Panel - Dark Glass */
        .mobile-menu-panel {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          background: rgba(20, 20, 40, 0.95);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: panelSlideIn 0.25s ease;
          overflow: hidden;
        }

        @keyframes panelSlideIn {
          from { 
            opacity: 0;
            transform: translateY(-20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Menu Header */
        .mobile-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .mobile-menu-logo img {
          height: 28px;
        }

        .mobile-menu-close {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 10px;
          cursor: pointer;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .mobile-menu-close:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* Menu Navigation */
        .mobile-menu-nav {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mobile-menu-link {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          border-radius: 14px;
          transition: all 0.2s;
          font-size: 16px;
          font-weight: 500;
        }

        .mobile-menu-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .mobile-menu-link.active {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%);
          color: white;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .mobile-menu-link.active svg {
          color: #a78bfa;
        }

        .mobile-menu-link svg {
          flex-shrink: 0;
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

          .mobile-menu-overlay {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
