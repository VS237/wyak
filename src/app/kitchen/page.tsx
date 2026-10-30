'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

// --- TYPES & INTERFACES ---
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

export interface KitchenOrder {
  id: string;
  table_number: number;
  customer_name: string;
  status: OrderStatus;
  created_at: string;
  items: OrderItem[];
}

export default function KitchenDashboard() {
  const supabase = createClient();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // --- FETCH INITIAL ORDERS & SETUP REALTIME SUBSCRIPTION ---
  useEffect(() => {
    async function fetchKitchenOrders() {
      try {
        setLoading(true);
        // Fetch orders without enum filter to avoid PostgREST type casting errors
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            created_at,
            restaurant_tables ( table_number ),
            order_items (
              id,
              quantity,
              menu_items ( name )
            )
          `)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          // Filter out served/completed orders in JavaScript
          const activeOrders = data.filter(
            (ord: any) => ord.status?.toString().toLowerCase() !== 'served'
          );

          const formattedOrders: KitchenOrder[] = activeOrders.map((ord: any) => ({
            id: ord.id,
            table_number: ord.restaurant_tables?.table_number || 1,
            customer_name: 'Guest Diner',
            status: (ord.status ? ord.status.toUpperCase() : 'PENDING') as OrderStatus,
            created_at: new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            items: (ord.order_items || []).map((item: any) => ({
              id: item.id,
              name: item.menu_items?.name || 'Dish Item',
              quantity: item.quantity,
            })),
          }));
          setOrders(formattedOrders);
        }
      } catch (err: any) {
        console.error('Error loading kitchen orders:', err?.message || err);
      } finally {
        setLoading(false);
      }
    }

    fetchKitchenOrders();

    // Supabase Realtime Subscription for live incoming orders & status changes
    const channel = supabase
      .channel('kitchen-orders-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchKitchenOrders();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        } else {
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Update order status in Supabase database with lowercase enum values
  const updateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const dbStatus = nextStatus.toLowerCase(); // <--- Converted to lowercase to match database enum

      const { error } = await supabase
        .from('orders')
        .update({ status: dbStatus })
        .eq('id', orderId);

      if (error) throw error;

      // Optimistic local update
      setOrders((prev) =>
        nextStatus === 'SERVED'
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
    } catch (err: any) {
      console.error('Failed to update order status:', err?.message || JSON.stringify(err));
      alert(`Could not update order status: ${err?.message || 'Unknown error'}`);
    }
  };

  // Modify individual item quantity on live ticket
  const handleItemQtyChange = async (orderId: string, itemId: string, delta: number) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updatedItems = order.items
          .map((item) =>
            item.id === itemId
              ? { ...item, quantity: Math.max(0, item.quantity + delta) }
              : item
          )
          .filter((item) => item.quantity > 0);
        return { ...order, items: updatedItems };
      })
    );

    // Sync quantity change to database
    const targetOrder = orders.find((o) => o.id === orderId);
    const targetItem = targetOrder?.items.find((i) => i.id === itemId);
    if (targetItem) {
      const newQty = Math.max(0, targetItem.quantity + delta);
      if (newQty === 0) {
        await supabase.from('order_items').delete().eq('id', itemId);
      } else {
        await supabase.from('order_items').update({ quantity: newQty }).eq('id', itemId);
      }
    }
  };

  // Filter orders by search query or status tab
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.table_number.toString().includes(searchTerm) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === 'ALL') return matchesSearch;
    return matchesSearch && order.status === filterStatus;
  });

  const pendingOrders = filteredOrders.filter((o) => o.status === 'PENDING');
  const preparingOrders = filteredOrders.filter((o) => o.status === 'PREPARING');
  const readyOrders = filteredOrders.filter((o) => o.status === 'READY');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6 font-sans">
      {/* Top Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
            🍳
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs text-gray-400">WYAK Resto Suite • Douala Live Queue</p>
          </div>
        </div>

        {/* Live Status Badge & Controls */}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${
              isRealtimeConnected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRealtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            ></span>
            {isRealtimeConnected ? 'Supabase Realtime Active' : 'Connecting...'}
          </span>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl border border-gray-700 cursor-pointer transition-all"
          >
            🖨️ Print Batch
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="my-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search table or order #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex gap-1.5 bg-gray-900 p-1 rounded-xl border border-gray-800 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'PENDING', 'PREPARING', 'READY'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                filterStatus === status
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-amber-500 font-bold text-sm">
          Loading live kitchen tickets...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: New Pending Orders */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
              <span className="font-extrabold text-xs text-red-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> New Orders
              </span>
              <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full text-xs font-bold">
                {pendingOrders.length}
              </span>
            </div>

            {pendingOrders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                onStatusChange={updateOrderStatus}
                onItemQtyChange={handleItemQtyChange}
              />
            ))}
          </div>

          {/* Column 2: In Preparation */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-xl">
              <span className="font-extrabold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> In Preparation
              </span>
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-xs font-bold">
                {preparingOrders.length}
              </span>
            </div>

            {preparingOrders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                onStatusChange={updateOrderStatus}
                onItemQtyChange={handleItemQtyChange}
              />
            ))}
          </div>

          {/* Column 3: Ready for Pickup / Serving */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl">
              <span className="font-extrabold text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ready to Serve
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-xs font-bold">
                {readyOrders.length}
              </span>
            </div>

            {readyOrders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                onStatusChange={updateOrderStatus}
                onItemQtyChange={handleItemQtyChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENT: INDIVIDUAL ORDER TICKET ---
interface OrderTicketProps {
  order: KitchenOrder;
  onStatusChange: (orderId: string, nextStatus: OrderStatus) => void;
  onItemQtyChange: (orderId: string, itemId: string, delta: number) => void;
}

function OrderTicket({ order, onStatusChange, onItemQtyChange }: OrderTicketProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between hover:border-gray-700 transition-all">
      <div>
        <div className="flex justify-between items-start border-b border-gray-800 pb-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-amber-400">Table #{order.table_number}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-md font-mono">
                {order.id.slice(0, 6).toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Guest: <span className="text-gray-200 font-semibold">{order.customer_name}</span> •{' '}
              <span className="font-mono text-gray-400">{order.created_at}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center bg-gray-950 p-2.5 rounded-xl border border-gray-800/80"
            >
              <span className="text-xs font-semibold text-gray-200">{item.name}</span>

              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 px-2 py-1 rounded-lg">
                <button
                  onClick={() => onItemQtyChange(order.id, item.id, -1)}
                  className="text-gray-400 hover:text-white font-bold text-xs cursor-pointer px-1"
                >
                  -
                </button>
                <span className="text-xs font-black text-amber-400 font-mono">
                  x{item.quantity}
                </span>
                <button
                  onClick={() => onItemQtyChange(order.id, item.id, 1)}
                  className="text-gray-400 hover:text-white font-bold text-xs cursor-pointer px-1"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-gray-800 flex gap-2">
        {order.status === 'PENDING' && (
          <button
            onClick={() => onStatusChange(order.id, 'PREPARING')}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-amber-600/20"
          >
            Start Preparing
          </button>
        )}

        {order.status === 'PREPARING' && (
          <button
            onClick={() => onStatusChange(order.id, 'READY')}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-emerald-600/20"
          >
            Mark Ready
          </button>
        )}

        {order.status === 'READY' && (
          <button
            onClick={() => onStatusChange(order.id, 'SERVED')}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer transition-all border border-gray-700"
          >
            Complete & Clear
          </button>
        )}
      </div>
    </div>
  );
}