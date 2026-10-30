'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';

function LandingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Capture table number from URL query string (e.g. ?table=5)
  const tableParam = searchParams.get('table');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const sanitizedPhone = `+237${phone.replace(/\s+/g, '')}`;
    const trimmedName = name.trim();

    if (phone.length !== 9) {
      setErrorMsg('Please enter a valid 9-digit Cameroonian phone number.');
      return;
    }

    try {
      setLoading(true);

      // 1. Check if a customer with this phone number already exists
      const { data: existingCustomer, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone_number', sanitizedPhone)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      let customer;

      if (existingCustomer) {
        // 2. If phone exists, verify that the name matches (case-insensitive check)
        if (existingCustomer.full_name.toLowerCase() !== trimmedName.toLowerCase()) {
          setErrorMsg('This phone number is already registered under a different name. Please enter the correct name associated with this number.');
          setLoading(false);
          return;
        }
        // Name matches, proceed as returning user login
        customer = existingCustomer;
      } else {
        // 3. If phone does not exist, register a new user
        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert({
            full_name: trimmedName,
            phone_number: sanitizedPhone,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }
        customer = newCustomer;
      }

      // 4. Fetch table details if table parameter exists in URL
      let tableId = null;
      if (tableParam) {
        const { data: tableData } = await supabase
          .from('restaurant_tables')
          .select('id, table_number')
          .eq('table_number', parseInt(tableParam, 10))
          .single();

        if (tableData) {
          tableId = tableData.id;
        }
      }

      // 5. Store session context locally for checkout / order placement
      sessionStorage.setItem('customerId', customer.id);
      sessionStorage.setItem('customerName', customer.full_name);
      sessionStorage.setItem('customerPhone', customer.phone_number);
      if (tableParam) sessionStorage.setItem('tableNumber', tableParam);
      if (tableId) sessionStorage.setItem('tableId', tableId);
      document.cookie = `wyak_guest_name=${encodeURIComponent(customer.full_name)}; path=/; max-age=86400; SameSite=Lax`;

      // 6. Redirect guest to the menu page
      router.push('/menu');
    } catch (err: any) {
      console.error('Error starting order session:', err);
      setErrorMsg('Failed to process. Please check your network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-600 to-amber-900 p-6 flex flex-col justify-between items-center text-white">
      {/* Centered Logo Display */}
      <div className="flex items-center justify-center cursor-pointer w-32 h-32 rounded-full bg-white shadow-xl border border-gray-100 p-4">
        <Image
          src="/wyak-logo-orange.png"
          alt="WYAK Resto Suite Logo"
          width={120}
          height={120}
          className="h-auto w-24 object-contain"
        />
      </div>

      {/* Header Info & Table Badge */}
      <div className="text-center pt-0 space-y-2">
        <h1 className="text-3xl font-black">Welcome</h1>
        {tableParam ? (
          <span className="inline-block bg-amber-500/30 text-amber-100 text-xs font-semibold px-3 py-1 rounded-full border border-amber-300/30">
            📍 Seated at Table #{tableParam}
          </span>
        ) : (
          <p className="text-amber-100 text-sm">Scan, order, and settle your bill.</p>
        )}
      </div>

      {/* Customer Intake Form */}
      <form
        onSubmit={handleStart}
        className="bg-white text-gray-900 rounded-3xl p-6 space-y-4 max-w-md mx-auto w-full shadow-lg border border-gray-100"
      >
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Name Input Field */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Your Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Victorin"
            disabled={loading}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-50"
          />
        </div>

        {/* Phone Number Input Field */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-sm font-semibold text-gray-500 select-none">
              🇨🇲 +237
            </span>
            <input
              type="tel"
              required
              pattern="[26][0-9]{8}"
              maxLength={9}
              value={phone}
              disabled={loading}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 9) {
                  setPhone(value);
                }
              }}
              placeholder="6XX XX XX XX"
              className="w-full pl-20 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-50"
            />
          </div>
          <p className="mt-1 text-[10px] text-gray-400">
            Enter 9 digits starting with 6 or 2 (e.g. 670000000)
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold rounded-2xl cursor-pointer transition-all shadow-md shadow-amber-600/20 flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span>Connecting...</span>
          ) : (
            <span>Browse Menu & Order</span>
          )}
        </button>
      </form>

      {/* Footer */}
      <footer className="text-center text-[11px] font-serif uppercase tracking-[0.2em] text-amber-200/80">
        Powered by Digital QR Service
      </footer>
    </main>
  );
}

// Wrap in Suspense for Next.js App Router query parameter handling
export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-amber-800 text-white flex items-center justify-center">Loading...</div>}>
      <LandingPageContent />
    </Suspense>
  );
}