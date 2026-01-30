'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, Users, Package, FileText, Settings, Megaphone } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Zap },
  { href: '/broker', label: 'Broker', icon: Users },
  { href: '/pakete', label: 'Pakete', icon: Package },
  { href: '/rechnungen', label: 'Rechnungen', icon: FileText },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      {/* Logo prominent anzeigen */}
      <div className="sidebar-logo desktop-only" style={{ 
        padding: '8px 16px 24px 16px',
        marginBottom: '8px'
      }}>
        <img 
          src="/logo.png" 
          alt="LeadsHub" 
          style={{ 
            height: '48px',
            width: 'auto',
            filter: 'drop-shadow(0 2px 8px rgba(139, 92, 246, 0.3))'
          }} 
        />
      </div>
      
      <nav>
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
