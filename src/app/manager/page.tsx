'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

// --- TYPES & INTERFACES ---
export interface Server {
  id: string;
  name: string;
}

export interface PosItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ManagerOrder {
  id: string;
  table_number: number;
  customer_name: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
  payment_method: 'CASH' | 'CARD' | 'MOBILE_MONEY';
  payment_status: 'PAID' | 'UNPAID' | 'PENDING';
  assigned_server_id: string;
  created_at: string;
  items: OrderItem[];
}

function ManagerDashboardContent() {
    const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'POS' | 'REPORT'>('ORDERS');
  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [posItems, setPosItems] = useState<PosItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<ManagerOrder | null>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const searchParams = useSearchParams();
  const initialTable = searchParams.get('table') || searchParams.get('table_id') || '1';
  const [tableNumber, setTableNumber] = useState(initialTable);

  // Search & Filter state for Active Orders
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // POS State
  const [posCart, setPosCart] = useState<OrderItem[]>([]);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE_MONEY'>('CASH');
  const [posSearch, setPosSearch] = useState('');

  // --- FETCH INITIAL DATA (Orders, Servers, Menu Items) ---
  const fetchManagerData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Servers / Personnel from profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'waiter');

      if (profilesData) {
        const formattedServers: Server[] = profilesData.map((p: any) => ({
          id: p.id,
          name: p.full_name,
        }));
        setServers([...formattedServers, { id: 'unassigned', name: 'Unassigned' }]);
      }

      // 2. Fetch Menu Items for POS
      const { data: menuData } = await supabase.from('menu_items').select('*');
      if (menuData) setPosItems(menuData);
      

      // 3. Fetch Active Orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          payment_status,
          payment_method,
          created_at,
          assigned_server_id,
          restaurant_tables ( table_number ),
          order_items (
            id,
            quantity,
            menu_items ( id, name, price )
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (ordersData) {
        const formattedOrders: ManagerOrder[] = ordersData.map((ord: any) => ({
          id: ord.id,
          table_number: ord.restaurant_tables?.table_number || 0,
          customer_name: 'Guest Diner',
          status: (ord.status ? ord.status.toUpperCase() : 'PENDING') as any,
          payment_method: (ord.payment_method ? ord.payment_method.toUpperCase() : 'CASH') as any,
          payment_status: (ord.payment_status ? ord.payment_status.toUpperCase() : 'UNPAID') as any,
          assigned_server_id: ord.assigned_server_id || 'unassigned',
          created_at: new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          items: (ord.order_items || []).map((item: any) => ({
            id: item.menu_items?.id || item.id,
            name: item.menu_items?.name || 'Dish Item',
            price: Number(item.menu_items?.price) || 0,
            quantity: item.quantity,
          })),
        }));
        setOrders(formattedOrders);
      }
    } catch (err: any) {
      console.error('Error loading manager data:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();

    // Realtime channel for live order updates
    const channel = supabase
      .channel('manager-modern-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchManagerData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- ORDER MANAGEMENT HANDLERS ---
  const handleAssignServer = async (orderId: string, serverId: string) => {
    try {
      const dbServerId = serverId === 'unassigned' ? null : serverId;
      const { error } = await supabase
        .from('orders')
        .update({ assigned_server_id: dbServerId })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, assigned_server_id: serverId } : o))
      );
    } catch (err: any) {
      console.error('Failed to assign server:', err?.message || err);
      alert('Could not update assigned server.');
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, payment_status: 'PAID' | 'PENDING') => {
    try {
      const dbStatus = payment_status.toLowerCase();
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: dbStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status } : o))
      );
    } catch (err: any) {
      console.error('Failed to update payment status:', err?.message || err);
      alert('Could not update payment status.');
    }
  };

  // --- POS HANDLERS ---
  const addToPosCart = (item: PosItem) => {
    setPosCart((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updatePosQty = (id: string, delta: number) => {
    setPosCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const posTotal = posCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCompletePosSale = async () => {
    if (posCart.length === 0) return;
    if (!tableNumber) {
      alert('Please enter your table number.');
      return;
    }

    try {

      let resolvedTableId: string | null = null;
      const parsedTableNum = parseInt(tableNumber, 10);

      const { data: existingTable } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq('table_number', parsedTableNum)
        .maybeSingle();

      if (existingTable) {
        resolvedTableId = existingTable.id;
      } else {
        // Insert only table_number to match your database schema
        const { data: newTable, error: tableError } = await supabase
          .from('restaurant_tables')
          .insert({ 
            table_number: parsedTableNum 
          })
          .select('id')
          .single();

        if (tableError) throw tableError;
        if (newTable) resolvedTableId = newTable.id;
      }

      // 1. Insert POS Sale into orders table
      const { data: newOrderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          total_amount: posTotal,
          payment_status: 'pending',
          status: 'pending',
          payment_method: posPaymentMethod.toLowerCase(),
          table_id: resolvedTableId,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert order items
      const orderItemsPayload = posCart.map((item) => ({
        order_id: newOrderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        unit_price: Number(item.price),
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload);

      if (itemsError) throw itemsError;

      const createdManagerOrder: ManagerOrder = {
        id: newOrderData.id,
        table_number: tableNumber,
        customer_name: 'Counter Sale',
        status: 'READY',
        payment_method: posPaymentMethod,
        payment_status: 'PENDING',
        assigned_server_id: 'unassigned',
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: [...posCart],
      };

      setOrders((prev) => [createdManagerOrder, ...prev]);
      setSelectedReceiptOrder(createdManagerOrder);
      setPosCart([]);
    } catch (err: any) {
      console.error('Failed to complete POS sale:', err?.message || err);
      alert(`Could not process sale: ${err?.message || 'Unknown error'}`);
    }
  };

  // --- RECEIPT QUANTITY EDIT HANDLER ---
  const assignedServer = servers.find(s => s.id === selectedReceiptOrder?.assigned_server_id);
  const serverName = assignedServer && assignedServer.id !== 'unassigned' ? assignedServer.name : 'Counter Staff';
  const handleReceiptQtyChange = (itemId: string, newQty: string) => {
    if (!selectedReceiptOrder) return;
    const parsedQty = Math.max(0, parseInt(newQty, 10) || 0);
    const updatedItems = selectedReceiptOrder.items
      .map((i) => (i.id === itemId ? { ...i, quantity: parsedQty } : i))
      .filter((i) => i.quantity > 0);

    setSelectedReceiptOrder({
      ...selectedReceiptOrder,
      items: updatedItems,
    });
  };

  // --- FILTERED ORDERS & METRICS ---
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.table_number > 0 && `table ${o.table_number}`.includes(searchQuery.toLowerCase())) ||
        (o.table_number === 0 && 'counter sale'.includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || o.payment_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const filteredPosItems = useMemo(() => {
    return posItems.filter((i) => i.name.toLowerCase().includes(posSearch.toLowerCase()));
  }, [posItems, posSearch]);

  const totalDailyRevenue = useMemo(
    () => orders.reduce((sum, o) => (o.payment_status === 'PAID' ? sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0) : sum), 0),
    [orders]
  );
  const paidOrdersCount = useMemo(() => orders.filter((o) => o.payment_status === 'PAID').length, [orders]);
  const unpaidOrdersCount = useMemo(() => orders.filter((o) => o.payment_status === 'PENDING').length, [orders]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col selection:bg-amber-500 selection:text-gray-950">
      {/* Dynamic Top Navbar */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800/80 px-6 py-3.5 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-00 to-amber-00 flex items-center justify-center text-white font-black shadow-lg shadow-amber-600/20 text-lg">
            <Image
              src="/wyak-logo-orange.png"
              alt="WYAK Resto Suite Logo"
              width={120}
              height={120}
              className="h-auto w-24 object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-tight">WYAK Resto Suite</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Operations
              </span>
            </div>
            <p className="text-xs text-gray-400">Manager Control & Operational Portal</p>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex bg-gray-950 p-1 rounded-2xl border border-gray-800/80 shadow-inner">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'ORDERS'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🍽️</span> Active Orders
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-900 text-amber-300 font-mono">
              {orders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('POS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'POS'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>⚡</span> Direct POS Counter
          </button>
          <button
            onClick={() => setActiveTab('REPORT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'REPORT'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>📊</span> Financial Report
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Shift Revenue</span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">{totalDailyRevenue.toLocaleString()} XAF</span>
          </div>
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Paid Orders</span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">{paidOrdersCount}</span>
          </div>
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pending / Open</span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">{unpaidOrdersCount}</span>
          </div>
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Staff On Duty</span>
            <span className="text-2xl font-black text-sky-400 font-mono mt-1 block">{Math.max(0, servers.length - 1)}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center gap-3 text-amber-500 font-bold text-sm">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            Syncing Manager Dashboard...
          </div>
        ) : (
          <>
            {/* ================= TAB 1: ACTIVE ORDERS ================= */}
            {activeTab === 'ORDERS' && (
              <div className="space-y-4">
                {/* Search & Filter Header */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-gray-900/40 p-3 rounded-2xl border border-gray-800/80">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search order ID or table number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                    />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {['ALL', 'PAID', 'PENDING'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          statusFilter === status
                            ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                            : 'bg-gray-950 text-gray-400 border border-gray-800 hover:text-white'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders Grid */}
                {filteredOrders.length === 0 ? (
                  <div className="bg-gray-900/30 border border-gray-800/80 rounded-3xl p-12 text-center">
                    <p className="text-gray-500 text-sm font-semibold">No matching active orders found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrders.map((order) => {
                      const orderTotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
                      return (
                        <div
                          key={order.id}
                          className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl hover:border-gray-700 transition-all group"
                        >
                          {/* Top Header */}
                          <div className="flex justify-between items-start pb-3 border-b border-gray-800">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-black text-amber-400">
                                  {order.table_number === 0 ? 'Counter Sale' : `Table #${order.table_number}`}
                                </span>
                                <span className="text-[10px] font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md">
                                  {order.id.slice(0, 6).toUpperCase()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {order.customer_name} • <span className="font-mono text-gray-400">{order.created_at}</span>
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border shrink-0 ${
                                order.payment_status === 'PAID'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </div>

                          {/* Scrollable Items List */}
                          <div className="py-3 space-y-2 border-b border-gray-800 max-h-40 overflow-y-auto my-1 pr-1 custom-scrollbar">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs items-center">
                                <span className="text-gray-300 font-medium">
                                  <span className="text-amber-500 font-bold">{item.quantity}x</span> {item.name}
                                </span>
                                <span className="font-mono text-gray-400">{(item.price * item.quantity).toLocaleString()} XAF</span>
                              </div>
                            ))}
                          </div>

                          {/* Server Dropdown */}
                          <div className="py-2.5 flex items-center justify-between gap-2">
                            <label className="text-xs text-gray-400 font-bold shrink-0">Assigned Staff:</label>
                            <select
                              value={order.assigned_server_id}
                              onChange={(e) => handleAssignServer(order.id, e.target.value)}
                              className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer w-36"
                            >
                              {servers.map((server) => (
                                <option key={server.id} value={server.id}>
                                  {server.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Footer Actions (Guaranteed Side-by-Side Visibility) */}
                          <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-3">
                            <div className="text-left">
                              <span className="text-[10px] text-gray-500 block uppercase font-bold">Total</span>
                              <span className="font-black text-white text-sm font-mono">{orderTotal.toLocaleString()} XAF</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {order.payment_status === 'PENDING' && (
                                <button
                                onClick={async () => {
                                  const confirmed = window.confirm(`Mark order #${order.id.slice(0, 6).toUpperCase()} as PAID?`);
                                  if (confirmed) {
                                    await handleUpdatePaymentStatus(order.id, 'PAID');
                                  }
                                }}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-600/20 shrink-0"
                              >
                                Mark Paid
                              </button>
                              )}
                              <button
                                onClick={() => setSelectedReceiptOrder(order)}
                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 cursor-pointer transition-all active:scale-95 shrink-0"
                              >
                                🖨️ Receipt
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 2: DIRECT POS COUNTER ================= */}
            {activeTab === 'POS' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Menu Item Catalog */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                      Quick Counter Checkout
                    </h2>
                    <input
                      type="text"
                      placeholder="Search menu item..."
                      value={posSearch}
                      onChange={(e) => setPosSearch(e.target.value)}
                      className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredPosItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gray-900/90 border border-gray-800 hover:border-amber-500/80 rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg group relative"
                      >
                        {/* Product Image Preview */}
                        <div className="h-28 w-full bg-gray-950 relative overflow-hidden flex items-center justify-center">
                          {item.image_url ? (
                            <img
                              src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
                              alt={item.name}
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="text-3xl opacity-30">🍽️</div>
                          )}
                        </div>

                        {/* Card Details & Add Button */}
                        <div className="p-3.5 flex flex-col justify-between flex-1 gap-2">
                          <div>
                            <span className="font-bold text-xs text-gray-200 group-hover:text-amber-400 transition-colors line-clamp-2 block">
                              {item.name}
                            </span>
                            <span className="font-mono font-extrabold text-amber-500 text-xs mt-1 block">
                              {item.price.toLocaleString()} XAF
                            </span>
                          </div>

                          <button
                            onClick={() => addToPosCart(item)}
                            className="w-full py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm"
                          >
                            + Add to Cart
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checkout Register */}
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 flex flex-col justify-between h-[520px] shadow-2xl relative">
                  <div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-800">
                      <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                        <span>🛒</span> Counter Order Register
                      </h3>
                      <span className="text-xs text-amber-400 font-bold">{posCart.length} Items</span>
                    </div>

                    <div className="py-3 space-y-2.5 overflow-y-auto max-h-50 pr-1">
                      {posCart.length === 0 ? (
                        <div className="text-center text-gray-500 py-16 text-xs italic">
                          Select menu items to build counter sale.
                        </div>
                      ) : (
                        posCart.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
                            <div>
                              <p className="font-bold text-xs text-gray-200">{item.name}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{(item.price * item.quantity).toLocaleString()} XAF</p>
                            </div>
                            <div className="flex items-center gap-2 bg-gray-900 px-2 py-1 rounded-lg border border-gray-800">
                              <button onClick={() => updatePosQty(item.id, -1)} className="text-gray-400 font-bold text-xs cursor-pointer hover:text-white">-</button>
                              <span className="text-xs font-bold text-amber-400 font-mono">{item.quantity}</span>
                              <button onClick={() => updatePosQty(item.id, 1)} className="text-gray-400 font-bold text-xs cursor-pointer hover:text-white">+</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Table Number Input Field */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
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
                        className="w-full px-4 py-3 bg-gray-950 border border-gray-200 rounded-2xl text-sm font-bold text-white transition-all"
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-bold text-gray-400">
                        📍 Douala Dining Room
                      </span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="pt-3 border-t border-gray-800 space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5">Method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['CASH', 'CARD', 'MOBILE_MONEY'].map((method) => (
                          <button
                            key={method}
                            onClick={() => setPosPaymentMethod(method as any)}
                            className={`py-2 text-[10px] font-extrabold rounded-xl border cursor-pointer transition-all ${
                              posPaymentMethod === method
                                ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                                : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                            }`}
                          >
                            {method.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs text-gray-400 font-bold">Total Amount</span>
                      <span className="text-2xl font-black text-amber-400 font-mono">{posTotal.toLocaleString()} XAF</span>
                    </div>

                    <button
                      onClick={handleCompletePosSale}
                      disabled={posCart.length === 0}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-2xl cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20"
                    >
                      Complete Sale & Print
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: FINANCIAL REPORT ================= */}
            {/* ================= TAB 3: FINANCIAL REPORT ================= */}
            {activeTab === 'REPORT' && (
              <div className="space-y-6">
                
                {/* Header & Print Button */}
                <div className="flex justify-between items-center no-print">
                  <div>
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                      Shift Financial Summary
                    </h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">Official audit and transaction ledger</p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl cursor-pointer transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2"
                  >
                    <span>🖨️</span> Export / Print Ledger
                  </button>
                </div>

                {/* ================= PRINTABLE & ONSCREEN CONTAINER ================= */}
                <div id="printable-report" className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
                  
                  {/* Print-Only Title Header (Visible only when printing) */}
                  <div className="hidden print:block p-6 border-b border-gray-300 text-center bg-white text-black font-mono">
                    <h1 className="text-xl font-black uppercase tracking-tight">WYAK Resto Suite</h1>
                    <p className="text-xs text-gray-600">Bonanjo, Douala - Cameroun | Tél: +237 655 98 37 15</p>
                    <div className="mt-3 pt-2 border-t border-dashed border-gray-400 flex justify-between text-xs font-bold">
                      <span>SHIFT TRANSACTIONS LEDGER</span>
                      <span>DATE: {new Date().toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>

                  {/* Header Bar */}
                  <div className="px-6 py-5 border-b border-gray-800 flex flex-wrap justify-between items-center gap-4 bg-gray-900/60 no-print">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-sm tracking-tight">Shift Transactions Ledger</h3>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">Real-time log of customer orders and payments</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-gray-950 border border-gray-800 rounded-full text-[11px] font-mono font-bold text-amber-400">
                        {orders.length} {orders.length === 1 ? 'Record' : 'Records'}
                      </span>
                    </div>
                  </div>

                  {/* Table Area */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300 print:text-black print:bg-white">
                      <thead className="bg-gray-950 text-gray-400 uppercase text-[10px] font-black tracking-widest border-b border-gray-800 select-none print:bg-gray-100 print:text-black">
                        <tr>
                          <th className="px-6 py-4">Order ID</th>
                          <th className="px-6 py-4">Source / Table</th>
                          <th className="px-6 py-4">Timestamp</th>
                          <th className="px-6 py-4">Payment Method</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      
                      <tbody className="divide-y divide-gray-800/60 font-medium print:divide-gray-300">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                              <div className="flex flex-col items-center gap-2">
                                <span className="text-2xl">🧾</span>
                                <p className="text-xs">No transactions recorded for this shift yet.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          orders.map((o) => {
                            const amount = o.items && Array.isArray(o.items) 
                              ? o.items.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0) 
                              : (o.total_amount || 0);
                            
                            const formattedTime = o.created_at ? new Date(o.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) : 'Just now';

                            const methodUpper = (o.payment_method || 'CASH').toUpperCase();
                            const isPaid = o.payment_status === 'PAID';

                            return (
                              <tr key={o.id} className="hover:bg-gray-800/40 transition-colors group print:hover:bg-transparent">
                                
                                {/* Order ID */}
                                <td className="px-6 py-4 font-mono font-bold text-orange-400 group-hover:text-orange-300 print:text-black">
                                  #{o.id.slice(0, 8).toUpperCase()}
                                </td>

                                {/* Table / Source */}
                                <td className="px-6 py-4">
                                  {o.table_number === 0 || !o.table_number ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 text-gray-300 rounded-lg text-[11px] font-bold print:bg-transparent print:text-black print:p-0">
                                      <span>🛍️</span> Direct POS
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded-lg text-[11px] font-bold print:bg-transparent print:text-black print:p-0">
                                      <span>🍽️</span> Table #{o.table_number}
                                    </span>
                                  )}
                                </td>

                                {/* Time */}
                                <td className="px-6 py-4 text-gray-400 font-mono text-[11px] print:text-gray-700">
                                  {formattedTime !== 'Invalid Date' ? formattedTime : o.created_at}
                                </td>

                                {/* Method Badge */}
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    methodUpper.includes('MOMO') || methodUpper.includes('OM') || methodUpper.includes('MOBILE')
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 print:bg-transparent print:text-black'
                                      : methodUpper.includes('CARD')
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 print:bg-transparent print:text-black'
                                      : 'bg-gray-800 text-gray-300 border border-gray-700 print:bg-transparent print:text-black'
                                  }`}>
                                    {methodUpper}
                                  </span>
                                </td>

                                {/* Status Badge */}
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isPaid 
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 print:bg-transparent print:text-black' 
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 print:bg-transparent print:text-black'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-rose-400'} print:hidden`} />
                                    {o.payment_status || 'PENDING'}
                                  </span>
                                </td>

                                {/* Amount */}
                                <td className="px-6 py-4 text-right font-mono font-black text-sm text-white group-hover:text-amber-300 transition-colors print:text-black">
                                  {amount.toLocaleString()} <span className="text-xs text-orange-400 font-bold print:text-black">XAF</span>
                                </td>

                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Summary Footer */}
                  <div className="px-6 py-4 bg-gray-950/80 border-t border-gray-800 flex justify-between items-center text-xs print:bg-gray-100 print:border-black">
                    <span className="text-gray-400 font-medium print:text-black uppercase font-bold">Shift Total Revenue</span>
                    <span className="font-mono font-black text-base text-amber-400 print:text-black">
                      {orders.reduce((sum, o) => {
                        const itemTotal = o.items && Array.isArray(o.items) ? o.items.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0) : (o.total_amount || 0);
                        return sum + itemTotal;
                      }, 0).toLocaleString()} XAF
                    </span>
                  </div>

                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ================= RECEIPT PRINT MODAL ================= */}
      {selectedReceiptOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            
            {/* Printable Receipt Container (Scrollable on screen) */}
            <div 
              id="receipt-print" 
              className="bg-white text-gray-900 p-6 rounded-2xl font-mono text-left shadow-lg relative max-h-[65vh] overflow-y-auto custom-scrollbar"
            >
              <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
                <div className="flex justify-center mb-2">
                  <Image
                    src="/wyak-logo-orange.png"
                    alt="WYAK Resto Suite Logo"
                    width={120}
                    height={120}
                    className="h-auto w-24 object-contain mx-auto"
                  />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight text-orange-500">WYAK Resto Suite</h2>
                <p className="text-[11px] text-gray-600">Bonanjo, Douala - Cameroun</p>
                <p className="text-[11px] text-gray-600">Tél: +237 655 98 37 15</p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">
                  {selectedReceiptOrder.table_number === 0 ? '⚡ Direct POS Counter' : `🍽️ Table #${selectedReceiptOrder.table_number}`}
                </p>
              </div>

              <div className="text-[11px] space-y-1 mb-3 text-gray-700">
                <p><strong>Order ID:</strong> {selectedReceiptOrder.id.slice(0, 8).toUpperCase()}</p>
                <p><strong>Time:</strong> {selectedReceiptOrder.created_at}</p>
                <p><strong>Staff:</strong> {serverName}</p>
                <p><strong>Payment:</strong> {selectedReceiptOrder.payment_method} ({selectedReceiptOrder.payment_status})</p>
              </div>

              <div className="border-t border-b border-dashed border-gray-400 py-2 my-2 space-y-2">
                {selectedReceiptOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <span className="font-bold flex-1 pr-2">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleReceiptQtyChange(item.id, e.target.value)}
                        className="w-12 bg-gray-100 border border-gray-300 text-center text-xs rounded font-bold py-0.5 no-print"
                      />
                      <span className="print-only hidden">{item.quantity}x</span>
                      <span className="font-mono">{(item.price * item.quantity).toLocaleString()} XAF</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center font-black text-sm pt-1 border-t border-gray-900">
                <span>TOTAL:</span>
                <span className="font-mono text-base text-orange-500">
                  {selectedReceiptOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toLocaleString()} XAF
                </span>
              </div>

              <div className="text-center text-[10px] text-gray-500 mt-4 pt-2 border-t border-dashed border-gray-300">
                <p>Merci de votre visite !</p>
                <p>Powered by WYAK Resto Suite</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2 no-print shrink-0">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-lg transition-all"
              >
                🖨️ Print Receipt
              </button>
              <button
                onClick={() => setSelectedReceiptOrder(null)}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-extrabold text-xs rounded-xl cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PERFECT SINGLE-PAGE THERMAL PRINT STYLES --- */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0 !important;
          }

          /* 1. Reset root HTML and body dimensions and clip extra page generation */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            height: 100% !important;
            max-height: 100vh !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }

          /* 2. Hide all general page content */
          body * {
            visibility: hidden !important;
          }

          /* 3. Extract receipt completely from modal hierarchy and pin to top-left */
          #receipt-print {
            visibility: visible !important;
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 76mm !important;
            margin: 0 !important;
            padding: 2mm !important;
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

          /* 4. Force visibility for all receipt contents */
          #receipt-print * {
            visibility: visible !important;
          }

          /* Preserve internal row layout */
          #receipt-print .flex {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          }

          /* Hide UI controls */
          .no-print {
            display: none !important;
          }

          .print-only {
            display: inline !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function ModernManagerDashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="animate-spin text-amber-500 text-base">⏳</span>
            <span>Loading Manager Dashboard...</span>
          </div>
        </div>
      }
    >
      <ManagerDashboardContent />
    </Suspense>
  );
}