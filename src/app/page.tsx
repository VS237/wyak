'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden">
      
      {/* ================= HEADER / NAVBAR ================= */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center shrink-0">
              <Image
                src="/wyak-logo-orange.png"
                alt="WYAK Resto Suite Logo"
                width={120}
                height={120}
                className="h-auto w-20 sm:w-24 object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="font-black tracking-tight text-sm sm:text-lg uppercase text-gray-900 leading-tight">
                WYAK <span className="text-orange-600">Resto Suite</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-mono tracking-wide">Douala, Cameroun</p>
            </div>
          </div>

          {/* Desktop Quick Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2.5 text-xs font-extrabold text-gray-700 hover:text-orange-600 transition-all"
            >
              Staff Sign In
            </Link>
            <Link
              href="/admin"
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>⚡</span> Admin Panel
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-gray-100 text-gray-700 hover:text-orange-600 font-bold text-lg transition-colors cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>

        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-200 px-6 py-5 space-y-3 shadow-xl animate-in slide-in-from-top duration-200">
            <Link
              href="/pos"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 bg-orange-600 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md"
            >
              <span>⚡</span> Open Admin Panel
            </Link>
            <Link
              href="/manager"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 bg-gray-100 text-gray-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
            >
              <span>📊</span> Manager Dashboard
            </Link>
            <div className="pt-2 border-t border-gray-100 text-center">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-bold text-orange-600 hover:underline"
              >
                Staff Sign In →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ================= HERO SECTION ================= */}
      <section className="pt-28 sm:pt-36 pb-16 sm:pb-20 px-4 sm:px-6 relative overflow-hidden bg-gradient-to-b from-orange-50/50 via-white to-gray-50">
        {/* Background Radial Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[250px] sm:h-[350px] bg-orange-500/10 blur-[100px] sm:blur-[140px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-5 sm:space-y-6 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-[11px] sm:text-xs font-bold">
            <span>🚀</span> Next-Gen Restaurant Management for Cameroon
          </div>
          
          <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 leading-tight">
            Manage Orders, POS & Thermal Printing <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">Effortlessly.</span>
          </h1>

          <p className="text-gray-600 text-xs sm:text-base max-w-2xl mx-auto font-medium leading-relaxed px-2">
            Designed specifically for restaurants and lounges in Douala. Handle Mobile Money payments, staff roles, inventory tables, and instant 80mm thermal receipts with absolute precision.
          </p>

          {/* Navigation Hub Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md sm:max-w-none mx-auto">
            <Link
              href="/admin"
              className="w-full sm:w-auto px-6 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-2xl shadow-xl shadow-orange-600/25 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              Connect as Admin
            </Link>
            <Link
              href="/manager"
              className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-gray-100 text-gray-900 border border-gray-300 font-extrabold text-xs rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              Manager Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ================= APP QUICK NAVIGATION CARDS ================= */}
      <section className="py-4 sm:py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">System Navigation Hub</h2>
          <p className="text-xs text-gray-500 font-medium">Quickly jump to core modules of the WYAK Resto Suite</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          
          {/* Card 1: POS */}
          <Link 
            href="/admin" 
            className="group bg-white hover:bg-orange-50/40 border border-gray-200 hover:border-orange-500/50 p-6 rounded-3xl transition-all flex flex-col justify-between shadow-xs hover:shadow-xl hover:shadow-orange-500/5"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 text-xl font-bold group-hover:scale-110 transition-transform">
                ⚡
              </div>
              <h3 className="text-base font-extrabold text-gray-900">Admin Dashboard</h3>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Control all restaurant operations, manage staff roles, and oversee live order processing with instant thermal printing.
              </p>
            </div>
            <div className="pt-6 flex items-center text-xs font-extrabold text-orange-600 gap-1 group-hover:gap-2 transition-all">
              Open Admin Panel <span>→</span>
            </div>
          </Link>

          {/* Card 2: Dashboard */}
          <Link 
            href="/manager" 
            className="group bg-white hover:bg-orange-50/40 border border-gray-200 hover:border-orange-500/50 p-6 rounded-3xl transition-all flex flex-col justify-between shadow-xs hover:shadow-xl hover:shadow-orange-500/5"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 text-xl font-bold group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="text-base font-extrabold text-gray-900">Manager Dashboard</h3>
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                Monitor sales, supervise waiter staff assignments, and oversee live kitchen operations.
              </p>
            </div>
            <div className="pt-6 flex items-center text-xs font-extrabold text-orange-600 gap-1 group-hover:gap-2 transition-all">
              View Analytics <span>→</span>
            </div>
          </Link>
        </div>
      </section>

      {/* ================= FEATURES HIGHLIGHT ================= */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-center md:text-left">
          
          <div className="space-y-2 bg-white md:bg-transparent p-5 md:p-0 rounded-2xl border md:border-0 border-gray-200 shadow-xs md:shadow-none">
            <h4 className="font-extrabold text-xs text-orange-600 uppercase tracking-wider">Thermal Hardware Ready</h4>
            <p className="text-xs text-gray-600 font-medium">
              Zero top-margin gaps and precise 80mm formatting guaranteed for standard thermal POS printers.
            </p>
          </div>

          <div className="space-y-2 bg-white md:bg-transparent p-5 md:p-0 rounded-2xl border md:border-0 border-gray-200 shadow-xs md:shadow-none">
            <h4 className="font-extrabold text-xs text-orange-600 uppercase tracking-wider">Local Currency & Payments</h4>
            <p className="text-xs text-gray-600 font-medium">
              Native support for XAF currency formatting and Mobile Money transaction status tracking.
            </p>
          </div>

          <div className="space-y-2 bg-white md:bg-transparent p-5 md:p-0 rounded-2xl border md:border-0 border-gray-200 shadow-xs md:shadow-none">
            <h4 className="font-extrabold text-xs text-orange-600 uppercase tracking-wider">Cloud Synchronized</h4>
            <p className="text-xs text-gray-600 font-medium">
              Powered by Next.js and Supabase PostgreSQL for real-time inventory and staff updates.
            </p>
          </div>

        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="py-10 px-6 border-t border-gray-200 bg-white text-center text-xs text-gray-500">
        <p>© 2026 WYAK Resto Suite. Douala, Cameroun. All rights reserved.</p>
      </footer>

    </div>
  );
}