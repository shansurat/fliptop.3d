'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Neo4jLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Emcees', href: '/admin/neo4j' },
    { name: 'Battles', href: '/admin/neo4j/battles' },
    { name: 'Opponents', href: '/admin/neo4j/participants' },
    { name: 'Events', href: '/admin/neo4j/events' },
    { name: '3D Graph', href: '/admin/neo4j/visualization' },
  ];

  return (
    <div className="flex min-h-screen bg-[#191919] text-[#cfcfcf] font-sans">
      {/* Sidebar */}
      <div className="w-64 border-r border-[#2f2f2f] flex flex-col">
        <div className="p-4 border-b border-[#2f2f2f]">
          <h1 className="text-sm font-semibold text-[#FFFFFF] tracking-tight">Neo4j Management</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[#2F2F2F] text-white font-medium'
                    : 'text-[#A3A3A3] hover:bg-[#202020] hover:text-[#cfcfcf]'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10 max-w-5xl">
        {children}
      </div>
    </div>
  );
}
