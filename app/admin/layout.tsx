'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Neo4jLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Emcees', href: '/admin' },
    { name: 'Battles', href: '/admin/battles' },
    { name: 'Results', href: '/admin/participants' },
    { name: 'Events', href: '/admin/events' },
  ];

  return (
    <div className="flex min-h-screen bg-[#191919] text-[#cfcfcf] font-sans">
      {/* Sidebar */}
      <div className="w-64 fixed h-screen top-0 left-0 bg-[#191919] border-r border-[#2f2f2f] flex flex-col z-50">
        <div className="p-4 border-b border-[#2f2f2f]">
          <h1 className="text-sm font-semibold text-[#FFFFFF] tracking-tight">fliptop.3d Admin</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${isActive
                  ? 'bg-[#2F2F2F] text-white font-medium'
                  : 'text-[#A3A3A3] hover:bg-[#202020] hover:text-[#cfcfcf]'
                  }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#2f2f2f]">
          <Link href="/" className="w-full text-left px-3 py-2 rounded-md text-sm text-[#A3A3A3] hover:bg-[#202020] hover:text-[#cfcfcf] transition-colors mb-2 block">
            &larr; Public Page
          </Link>
          <button
            onClick={async () => {
              const { createClient } = await import('@supabase/supabase-js');
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-10 max-w-5xl ml-64">
        {children}
      </div>
    </div>
  );
}
