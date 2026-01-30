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
      <div className="sidebar-logo desktop-only">
        <img src="/logo.png" alt="LeadsHub" />
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
