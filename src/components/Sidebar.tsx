'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, Users, Receipt, Settings, Package } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  
  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/leads', label: 'Leads', icon: Zap },
    { href: '/broker', label: 'Broker', icon: Users },
    { href: '/pakete', label: 'Pakete', icon: Package },
    { href: '/rechnungen', label: 'Rechnungen', icon: Receipt },
    { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo.png" alt="LeadsHub" />
      </div>
      <nav>
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
