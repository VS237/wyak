'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { useSearchParams } from 'next/navigation';

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  is_available: boolean;
  categories?: { name: string; slug: string } | null;
}

interface CartItem extends MenuItem {
  quantity: number;
}

function MenuContent() {
  const supabase = createClient();

  const searchParams = useSearchParams();
  
  // Pre-fill from URL query string if available (e.g. /menu?table=3), otherwise default to '1'
  const initialTable = searchParams ? (searchParams.get('table') || searchParams.get('table_id') || '1') : '1';
  const [tableNumber, setTableNumber] = useState(initialTable);

  // Read search parameters safely after mount
  useEffect(() => {
    if (searchParams) {
      const table = searchParams.get('table') || searchParams.get('table_id');
      if (table) {
        setTableNumber(table);
      }
    }
  }, [searchParams]);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE_MONEY'>('CASH');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  // Fetch Categories & Menu Items from Supabase on load
  useEffect(() => {
    async function fetchMenuData() {
      try {
        setLoading(true);

        // 1. Fetch Categories
        const { data: catData } = await supabase.from('categories').select('*');
        if (catData) setCategories([{ id: 'ALL', name: 'All Items', icon: '✨' }, ...catData]);

        // 2. Fetch Available Menu Items with Categories
        const { data: menuData, error } = await (supabase as any)
          .from('menu_items')
          .select('*, categories(name, slug)')
          .eq('is_available', true);

        if (error) throw error;
        if (menuData) setMenuItems(menuData);
      } catch (err) {
        console.error('Error loading menu data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMenuData();
  }, [supabase]);

  const handleAddToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      setCart((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantity: newQuantity } : i))
      );
    }
  };

  const handleClearCart = () => {
    if (confirm('Are you sure you want to cancel your order and clear the cart?')) {
      setCart([]);
      setIsCheckoutModalOpen(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.category_id === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleConfirmOrder = async () => {
    if (cart.length === 0) return;
    if (!tableNumber) {
      alert('Please enter your table number.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Resolve or auto-create table_id from the entered table_number in restaurant_tables
      let resolvedTableId: string | null = null;
      const parsedTableNum = parseInt(tableNumber, 10);

      const { data: existingTable } = await (supabase as any)
        .from('restaurant_tables')
        .select('id')
        .eq('table_number', parsedTableNum)
        .maybeSingle();

      if (existingTable) {
        resolvedTableId = existingTable.id;
      } else {
        const { data: newTable, error: tableError } = await (supabase as any)
          .from('restaurant_tables')
          .insert({ 
            table_number: parsedTableNum 
          })
          .select('id')
          .single();

        if (tableError) throw tableError;
        if (newTable) resolvedTableId = newTable.id;
      }

      // 2. Insert order details into the orders table with the linked table_id
      const { data: orderData, error: orderError } = await (supabase as any)
        .from('orders')
        .insert({
          total_amount: cartTotal,
          payment_status: 'pending',
          status: 'pending',
          payment_method: paymentMethod.toLowerCase(),
          table_id: resolvedTableId,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Map and insert line items into the order_items table
      const orderItemsPayload = cart.map((i) => ({
        order_id: orderData.id,
        menu_item_id: i.id,
        quantity: i.quantity,
        unit_price: Number(i.price),
      }));

      const { error: itemsError } = await (supabase as any)
        .from('order_items')
        .insert(orderItemsPayload);

      if (itemsError) throw itemsError;

      // 4. Update state to show the digital receipt view
      setPlacedOrder({
        orderId: `ORD-${orderData.id.slice(0, 6).toUpperCase()}`,
        items: [...cart],
        paymentMethod,
        totalAmount: cartTotal,
        tableNumber: tableNumber,
      });

      setCart([]);
      setIsCheckoutModalOpen(false);
    } catch (error: any) {
      console.error('Error placing order:', error?.message || error);
      alert('Could not process order. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Receipt View (Light Theme)
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center justify-center">
      {/* Receipt Card Container */}
      <div 
        id="receipt-print" 
        className="w-full max-w-sm bg-white text-gray-900 p-6 rounded-3xl shadow-xl border border-gray-200 font-mono text-left"
      >
        {/* Header / Branding */}
        <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4 space-y-1">
          <div className="flex justify-center mb-2">
            <Image
              src="/wyak-logo-orange.png"
              alt="WYAK Resto Suite Logo"
              width={120}
              height={120}
              className="h-auto w-24 object-contain mx-auto"
            />
          </div>
          <h2 className="text-xl font-black uppercase text-gray-900 tracking-tight">
            WYAK Resto Suite
          </h2>
          <p className="text-[11px] text-gray-500 font-medium">Bonanjo, Douala - Cameroun</p>
          <div className="pt-1 flex justify-center items-center gap-2 text-xs">
            <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
              {placedOrder.tableNumber === 0 ? '⚡ Direct POS' : `🍽️ Table #${placedOrder.tableNumber}`}
            </span>
          </div>
          <p className="text-[11px] font-mono font-bold text-amber-600 tracking-wide pt-1">
            ID: #{placedOrder.orderId.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Order Items List */}
        <div className="space-y-2.5 text-xs border-b border-dashed border-gray-300 pb-4 mb-4">
          <div className="flex justify-between font-bold text-gray-400 text-[10px] uppercase tracking-wider pb-1">
            <span>Item / Qty</span>
            <span>Amount</span>
          </div>
          {placedOrder.items.map((item: CartItem) => (
            <div key={item.id} className="flex justify-between items-start text-xs font-medium text-gray-800">
              <div className="pr-2 flex-1">
                <span className="font-bold text-amber-600 mr-1.5">{item.quantity}x</span>
                <span>{item.name}</span>
              </div>
              <span className="font-mono font-bold text-gray-900 whitespace-nowrap">
                {Number(item.price * item.quantity).toLocaleString()} XAF
              </span>
            </div>
          ))}
        </div>

        {/* Order Summary & Payment Badge */}
        <div className="flex justify-between items-center font-bold text-sm mb-6 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Total Amount</span>
            <span className="text-gray-800 text-xs font-bold uppercase">{placedOrder.paymentMethod}</span>
          </div>
          <span className="text-amber-600 font-mono text-lg font-black tracking-tight">
            {placedOrder.totalAmount.toLocaleString()} XAF
          </span>
        </div>

        {/* Footer Message */}
        <div className="text-center text-[10px] text-gray-400 space-y-0.5 mb-6">
          <p className="font-semibold text-gray-500">Merci de votre visite !</p>
          <p>Powered by WYAK Resto Suite</p>
        </div>

        {/* Modal Actions (Hidden in Print) */}
        <div className="space-y-2 print:hidden no-print">
          <button
            onClick={() => window.print()}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
          >
            🖨️ Print Receipt
          </button>
          <button
            onClick={() => setPlacedOrder(null)}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl cursor-pointer transition-all active:scale-95"
          >
            Order More Items
          </button>
        </div>
      </div>

      {/* Thermal Print Engine Overrides */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0 !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            height: 100% !important;
            max-height: 100vh !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }

          body * {
            visibility: hidden !important;
          }

          #receipt-print {
            visibility: visible !important;
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 76mm !important;
            margin: 0 !important;
            padding: 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            z-index: 99999999 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          #receipt-print * {
            visibility: visible !important;
          }

          .no-print,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-32">
      {/* Light Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer w-22">
            <Image
              src="/wyak-logo.png"
              alt="WYAK Resto Suite Logo"
              width={120}
              height={120}
              className="h-auto w-28 object-contain"
            />
          </div>

          {/* Category Filter Dropdown */}
          <div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200/80 text-gray-900 border border-gray-200 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>
                  {categories.find((c) => c.id === selectedCategory)?.icon || '🍽️'}{' '}
                  {categories.find((c) => c.id === selectedCategory)?.name || 'All Items'}
                </span>
                <span className={`text-[10px] text-gray-500 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {isCategoryDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCategoryDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden py-1.5">
                    {categories.map((category) => {
                      const isSelected = selectedCategory === category.id;
                      return (
                        <button
                          key={category.id}
                          onClick={() => {
                            setSelectedCategory(category.id);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-50 text-amber-800 font-black'
                              : 'text-gray-700 hover:bg-amber-500 hover:text-white'
                          }`}
                        >
                          <span>{category.icon || '📌'}</span>
                          <span className="flex-1">{category.name}</span>
                          {isSelected && <span className="text-amber-600 text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Search Field */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search dishes, drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-gray-100 border border-gray-300 rounded-2xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
            />
            <span className="absolute left-3 top-3 text-xs text-gray-400">🔍</span>
          </div>
        </div>
      </header>

      {/* Product Catalog */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        {loading ? (
          <div className="text-center py-20 text-amber-600 font-bold text-xs">
            Loading menu catalogue from database...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-xs font-medium">
            No items found matching your filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {filteredItems.map((item) => {
              const inCartItem = cart.find((i) => i.id === item.id);

              return (
                <div
                  key={item.id}
                  className="relative h-96 rounded-2xl overflow-hidden shadow-lg border border-gray-100 group transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-gray-950"
                >
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

                  <div className="absolute top-4 right-4 z-10">
                    <span className="px-3 py-1.5 rounded-2xl bg-white/90 backdrop-blur-md text-gray-900 font-mono font-black text-xs shadow-md border border-white/40">
                      {Number(item.price).toLocaleString()} XAF
                    </span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-5 z-10 flex flex-col justify-end space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 block">
                        {item.categories?.name || 'Dish'}
                      </span>
                      <h3 className="font-black text-white text-base tracking-tight drop-shadow-sm">
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-200/90 mt-1 line-clamp-2 leading-relaxed">
                        {item.description || 'Delicious gourmet meal prepared fresh.'}
                      </p>
                    </div>

                    {inCartItem ? (
                      <div className="flex items-center justify-between bg-white/90 backdrop-blur-md border border-white/50 p-1.5 rounded-2xl shadow-lg">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, inCartItem.quantity - 1)}
                          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-black text-sm flex items-center justify-center cursor-pointer transition-colors active:scale-90"
                        >
                          -
                        </button>
                        <span className="text-xs font-black text-gray-900 font-mono">
                          {inCartItem.quantity} selected
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, inCartItem.quantity + 1)}
                          className="w-9 h-9 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm flex items-center justify-center cursor-pointer transition-colors active:scale-90 shadow-sm"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="w-full py-3 bg-white/95 hover:bg-amber-600 hover:text-white text-gray-900 font-bold text-xs rounded-2xl backdrop-blur-md cursor-pointer transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                      >
                        <span>+ Add to Order</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-5 left-4 right-4 z-30 max-w-lg mx-auto">
          <button
            onClick={() => setIsCheckoutModalOpen(true)}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-3xl shadow-xl shadow-amber-600/30 cursor-pointer flex items-center justify-between active:scale-[0.98] transition-all border border-amber-500/20"
          >
            <div className="flex items-center gap-3">
              <span className="bg-white text-amber-800 px-2.5 py-1 rounded-full text-xs font-black shadow-xs">
                {totalItemCount}
              </span>
              <span className="font-extrabold text-sm">Review & Settle Order</span>
            </div>
            <span className="font-black text-lg font-mono">{cartTotal.toLocaleString()} XAF</span>
          </button>
        </div>
      )}

      {/* Checkout Drawer */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white border-l border-gray-200 h-full flex flex-col justify-between p-6 shadow-2xl animate-in slide-in-from-right">
            <div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <div>
                  <h2 className="font-black text-gray-900 text-lg">Confirm Order</h2>
                  <p className="text-xs text-gray-500">Review selected items and payment choice</p>
                </div>
                <button
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 max-h-[29vh] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-gray-900">{item.name}</h4>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {Number(item.price).toLocaleString()} XAF each
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-gray-200 px-2 py-1 rounded-xl shadow-2xs">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="text-gray-600 hover:text-gray-900 font-bold text-xs cursor-pointer px-1"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const parsedVal = parseInt(e.target.value, 10);
                          const safeQty = isNaN(parsedVal) || parsedVal < 1 ? 1 : parsedVal;
                          handleUpdateQuantity(item.id, safeQty);
                        }}
                        className="w-8 text-center text-xs font-bold text-gray-900 focus:outline-none"
                      />
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="text-gray-600 hover:text-gray-900 font-bold text-xs cursor-pointer px-1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Table Number Input Field */}
            <div className="mb-0">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mt-2 mb-2">
                Table Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-gray-400">
                  📍 Enter your table number please
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CASH', label: '💵 Cash' },
                    { id: 'CARD', label: '💳 Card' },
                    { id: 'MOBILE_MONEY', label: '📱 Mobile' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`py-2.5 text-xs font-bold rounded-2xl border cursor-pointer transition-all ${
                        paymentMethod === method.id
                          ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-600/20'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold bg-gray-50 p-2 rounded-2xl border border-gray-100">
                <span className="text-gray-700">Total Due</span>
                <span className="text-xl font-black text-amber-600 font-mono">
                  {cartTotal.toLocaleString()} XAF
                </span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleConfirmOrder}
                  disabled={isSubmitting}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing Order...' : 'Confirm Order'}
                </button>

                <button
                  onClick={handleClearCart}
                  className="w-full py-2 bg-red-800 hover:bg-red-900 text-white font-bold rounded-2xl cursor-pointer transition-all border border-gray-200/60"
                >
                  Cancel Entire Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap in Suspense boundary for Next.js 16 build/prerender compatibility
export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-amber-400 flex items-center justify-center font-mono text-xs">
        Loading menu...
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}