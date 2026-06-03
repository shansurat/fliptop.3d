'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '../login/actions';


export default function Neo4jLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Emcees', href: '/admin' },
    { name: 'Battles', href: '/admin/battles' },
    { name: 'Events', href: '/admin/events' },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-[#A3A3A3] font-sans">
      {/* Sidebar */}
      <div className="w-64 fixed h-screen top-0 left-0 bg-[#0a0a0a] border-r border-white/5 flex flex-col z-50">
        <div className="p-4 border-b border-white/5">
          <h1 className="text-xs font-bold text-[#EFEFEF] tracking-widest uppercase">fliptop.3d Admin</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-xs tracking-wider uppercase transition-all duration-200 ${isActive
                  ? 'bg-white/[0.06] text-[#EFEFEF] font-semibold'
                  : 'text-[#888] hover:bg-white/[0.02] hover:text-[#EFEFEF]'
                  }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <Link href="/presentation?slide=0" className="w-full text-left px-3 py-2 rounded-md text-xs tracking-wider uppercase text-[#888] hover:bg-white/[0.02] hover:text-[#EFEFEF] transition-all mb-2 flex items-center gap-1.5 cursor-pointer">
            <svg className="w-3.5 h-3.5 shrink-0 text-[#888]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            Present Slides
          </Link>
          <Link href="/" className="w-full text-left px-3 py-2 rounded-md text-xs tracking-wider uppercase text-[#888] hover:bg-white/[0.02] hover:text-[#EFEFEF] transition-all mb-2 block">
            &larr; Public Page
          </Link>
          <button
            onClick={async () => {
              await signOut();
            }}
            className="w-full text-left px-3 py-2 rounded-md text-xs tracking-wider uppercase text-red-400/80 hover:bg-red-950/20 hover:text-red-300 transition-all cursor-pointer"
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
