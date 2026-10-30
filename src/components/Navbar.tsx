'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MAIN_NAV_ITEMS } from '@/config/navigation';

export default function Navbar() {
  const pathname = usePathname();

  // Hide global navbar on customer landing page or table verification screens
  if (pathname === '/' || pathname.startsWith('/table/')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo Link */}
        <Link
          href="/"
          className="flex items-center gap-2 group cursor-pointer transition-transform active:scale-95"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-amber-600/20 group-hover:bg-amber-500 transition-colors">
            G
          </div>
          <span className="font-black text-white text-sm tracking-tight hidden sm:inline-block">
            Gourmet Bistro
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>

                {item.badge && (
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}