'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

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

  return (
    <>
      <div className="mobile-header">
        <button 
          className="mobile-menu-btn" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <img src="/logo.png" alt="LeadsHub" className="mobile-logo" />
      </div>

      <div 
        className={`mobile-overlay ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      <style jsx global>{`
        .sidebar {
          transform: ${isOpen ? 'translateX(0)' : ''};
        }
        @media (min-width: 769px) {
          .sidebar {
            transform: translateX(0) !important;
          }
          .mobile-header {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
