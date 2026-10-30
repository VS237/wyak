'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import { createPersonnelAccount } from './actions';

const RevenueLineChart = dynamic(
  () => import('./components/AdminCharts').then((mod) => mod.RevenueLineChart),
  { ssr: false, loading: () => <div className="h-full bg-gray-950/50 animate-pulse rounded-2xl" /> }
);

const CategoryDoughnutChart = dynamic(
  () => import('./components/AdminCharts').then((mod) => mod.CategoryDoughnutChart),
  { ssr: false, loading: () => <div className="h-full bg-gray-950/50 animate-pulse rounded-2xl" /> }
);

interface UserProfile {
  id: string;
  full_name: string;
  phone_number: string | null;
  role: 'admin' | 'manager' | 'waiter' | 'kitchen';
  is_active: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  category_id: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  categories?: { name: string } | null;
}

interface DailyReport {
  id: string;
  report_date: string;
  total_sales: number;
  total_orders_count: number;
  summary_notes: string | null;
  issues_encountered: string | null;
}

export default function AdminDashboard() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'USERS' | 'PRODUCTS' | 'REPORTS'>('ANALYTICS');

  // Database States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [metrics, setMetrics] = useState({ totalRevenue: 0, totalOrders: 0, activeStaffCount: 0 });
  const [loading, setLoading] = useState(true);

  // Chart States
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [orderItemsList, setOrderItemsList] = useState<any[]>([]);

  // Modals & Form States
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category_name: '', price: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch initial database records & categories
  useEffect(() => {
    async function fetchAdminData() {
      try {
        setLoading(true);

        // 1. Fetch Users (Profiles)
        const { data: profilesData } = await supabase.from('profiles').select('*');
        if (profilesData) setUsers(profilesData);

        // 2. Fetch Menu Items with Categories
        const { data: menuData } = await supabase.from('menu_items').select('*, categories(name)');
        if (menuData) setProducts(menuData);

        // 3. Fetch Categories list for modal input suggestions
        const { data: catData } = await supabase.from('categories').select('*');
        if (catData) setCategoriesList(catData);

        // 4. Fetch Daily Reports
        const { data: reportsData } = await supabase.from('daily_reports').select('*').order('report_date', { ascending: false });
        if (reportsData) setReports(reportsData);

        // 5. Fetch Analytics Metrics from Orders
        const { data: ordersData } = await supabase.from('orders').select('total_amount, status');
        if (ordersData) {
          const rev = ordersData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
          setMetrics({
            totalRevenue: rev,
            totalOrders: ordersData.length,
            activeStaffCount: profilesData?.filter((p) => p.is_active).length || 0,
          });
        }

        // 6. Fetch Chart Data Records
        const { data: orders } = await supabase
          .from('orders')
          .select('created_at, total_amount')
          .eq('payment_status', 'paid');
        if (orders) setOrdersList(orders);

        const { data: items } = await supabase
          .from('order_items')
          .select(`
            quantity,
            menu_items (
              categories (
                name
              )
            )
          `);
        if (items) setOrderItemsList(items);

      } catch (err) {
        console.error('Error loading admin data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAdminData();
  }, [supabase]);

  // Handlers: Toggle User Status
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentStatus })
      .eq('id', userId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u))
      );
    }
  };

  // Handlers: Toggle Product Availability
  const toggleProductAvailability = async (prodId: string, currentAvailability: boolean) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !currentAvailability })
      .eq('id', prodId);

    if (!error) {
      setProducts((prev) =>
        prev.map((p) => (p.id === prodId ? { ...p, is_available: !currentAvailability } : p))
      );
    }
  };

  // Handlers: Create Product with Image Upload & Category Upsert
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.category_name) return;

    try {
      setSubmitting(true);

      // 1. Resolve or create category
      const categorySlug = newProduct.category_name.toLowerCase().trim().replace(/\s+/g, '-');
      let categoryId: string;

      const existingCategory = categoriesList.find(
        (c) => c.slug === categorySlug || c.name.toLowerCase() === newProduct.category_name.toLowerCase().trim()
      );

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const { data: newCat, error: catError } = await supabase
          .from('categories')
          .insert({
            name: newProduct.category_name.trim(),
            slug: categorySlug,
          })
          .select()
          .single();

        if (catError) throw catError;
        categoryId = newCat.id;
        setCategoriesList((prev) => [...prev, newCat]);
      }

      // 2. Upload Image to Supabase Storage Bucket ('menu-images') if provided
      let imageUrl: string | null = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
      }

      // 3. Insert into menu_items
      const { data, error } = await supabase
        .from('menu_items')
        .insert({
          name: newProduct.name.trim(),
          category_id: categoryId,
          price: parseFloat(newProduct.price),
          image_url: imageUrl,
          is_available: true,
        })
        .select('*, categories(name)')
        .single();

      if (error) throw error;

      if (data) {
        setProducts((prev) => [...prev, data]);
        setShowProductModal(false);
        setNewProduct({ name: '', category_name: '', price: '' });
        setImageFile(null);
      }
    } catch (err: any) {
      console.error('Error creating product:', err.message);
      alert('Failed to create product. Check console details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Modal & Form State (Updated with email & password)
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'waiter',
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);

    try {
      // Call the Server Action
      const result = await createPersonnelAccount(newUserForm);

      if (!result.success) {
        throw new Error(result.error);
      }

      setNewUserForm({
        full_name: '',
        email: '',
        password: '',
        phone_number: '',
        role: 'waiter',
      });
      setIsCreateUserModalOpen(false);
      alert('Personnel account and login credentials created successfully!');
      
      // Refresh your user list here if you have a fetch function
      // fetchUsers();
    } catch (err: any) {
      console.error('Error creating user:', err?.message || err);
      alert(`Could not create user: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col">
      {/* Top Admin Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-black shadow-lg shadow-amber-600/20">
            👑
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Admin Executive Suite</h1>
            <p className="text-xs text-gray-400">Master Control Panel • WYAK Resto Suite Douala</p>
          </div>
        </div>

        {/* Module Navigation Tabs */}
        <div className="flex gap-1 bg-gray-950 p-1 rounded-2xl border border-gray-800 overflow-x-auto">
          {[
            { id: 'ANALYTICS', label: '📈 Business Health' },
            { id: 'USERS', label: '👥 User Control' },
            { id: 'PRODUCTS', label: '🍽️ Menu & Inventory' },
            { id: 'REPORTS', label: '📄 Daily Reports' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-amber-500 font-bold">
            Synchronizing database metrics...
          </div>
        ) : (
          <>
            {/* TAB 1: BUSINESS HEALTH & ANALYTICS */}
            {activeTab === 'ANALYTICS' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gross Revenue</span>
                    <span className="text-3xl font-black text-emerald-400 font-mono mt-2 block">
                      {metrics.totalRevenue.toLocaleString()} XAF
                    </span>
                    <span className="text-[10px] text-emerald-500 font-bold mt-1 block">Live DB Aggregate</span>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Table Orders</span>
                    <span className="text-3xl font-black text-amber-400 font-mono mt-2 block">
                      {metrics.totalOrders}
                    </span>
                    <span className="text-[10px] text-amber-500 font-bold mt-1 block">Recorded in database</span>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Staff On Duty</span>
                    <span className="text-3xl font-black text-sky-400 font-mono mt-2 block">
                      {metrics.activeStaffCount} Staff
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1 block">Registered profiles</span>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Business Status</span>
                    <span className="text-3xl font-black text-purple-400 font-mono mt-2 block">Online</span>
                    <span className="text-[10px] text-purple-400 font-bold mt-1 block">Supabase Connected</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-300 mb-4">
                      Weekly Sales Trajectory (XAF)
                    </h3>
                    <div className="h-64">
                      <RevenueLineChart orders={ordersList} />
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl flex flex-col justify-between">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-300 mb-4">
                      Revenue Category Share
                    </h3>
                    <div className="h-56 relative flex items-center justify-center">
                      <CategoryDoughnutChart orderItems={orderItemsList} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: USER CONTROL */}
{activeTab === 'USERS' && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400">
        System Account Access & Personnel Control
      </h2>
      <button
        onClick={() => setIsCreateUserModalOpen(true)}
        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/20 cursor-pointer transition-all flex items-center gap-2"
      >
        <span>+</span> Add Personnel
      </button>
    </div>

    <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
      <table className="w-full text-left text-xs text-gray-300">
        <thead className="bg-gray-950 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-800">
          <tr>
            <th className="px-6 py-4">Employee Name</th>
            <th className="px-6 py-4">Phone Number</th>
            <th className="px-6 py-4">Role</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-800/40 transition-colors">
              <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px]">
                  👤
                </span>
                {user.full_name}
              </td>
              <td className="px-6 py-4 text-gray-400 font-mono">{user.phone_number || 'N/A'}</td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-[10px] font-bold text-amber-400 uppercase">
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    user.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {user.is_active ? 'ACTIVE' : 'SUSPENDED'}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => toggleUserStatus(user.id, user.is_active)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    user.is_active
                      ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                  }`}
                >
                  {user.is_active ? 'Suspend' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* CREATE USER MODAL */}
    {isCreateUserModalOpen && (
  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
      <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-800">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>👤</span> Register Personnel & Login
        </h3>
        <button
          onClick={() => setIsCreateUserModalOpen(false)}
          className="text-gray-400 hover:text-white text-sm font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleCreateUser} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Jean Dupont"
            value={newUserForm.full_name}
            onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Email Address (for login) <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            placeholder="e.g. jean@wyak.cm"
            value={newUserForm.email}
            onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Temporary Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            placeholder="Min 6 characters"
            value={newUserForm.password}
            onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Phone Number (+237) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 699000000"
            value={newUserForm.phone_number}
            onChange={(e) => setNewUserForm({ ...newUserForm, phone_number: e.target.value })}
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={newUserForm.role}
            onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase font-bold"
          >
            <option value="waiter">Waiter</option>
            <option value="kitchen">Kitchen Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={() => setIsCreateUserModalOpen(false)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreatingUser}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
          >
            {isCreatingUser ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
  </div>
)}

            {/* TAB 3: PRODUCTS */}
            {activeTab === 'PRODUCTS' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400">
                    Menu Catalogue & Stock Status
                  </h2>
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-amber-600/20"
                  >
                    + Create Dish / Item
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl"
                    >
                      <div>
                        {prod.image_url && (
                          <div className="w-full h-32 mb-3 rounded-xl overflow-hidden bg-gray-950 border border-gray-800 relative">
                            <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {prod.categories?.name || 'Dish'}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-white text-base mt-3">{prod.name}</h3>
                        <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
                          {Number(prod.price).toLocaleString()} XAF
                        </span>
                      </div>

                      <div className="pt-3 border-t border-gray-800 flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-semibold">Available on QR Menu</span>
                        <button
                          onClick={() => toggleProductAvailability(prod.id, prod.is_available)}
                          className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                            prod.is_available ? 'bg-emerald-600' : 'bg-gray-800'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              prod.is_available ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: REPORTS */}
            {activeTab === 'REPORTS' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400">
                    End-of-Day Financial Summary Reports
                  </h2>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-200 text-xs font-bold rounded-xl border border-gray-800 cursor-pointer transition-all"
                  >
                    🖨️ Print Executive Report
                  </button>
                </div>

                <div className="space-y-4">
                  {reports.length === 0 ? (
                    <div className="p-8 bg-gray-900 rounded-2xl text-center text-gray-400 text-xs">
                      No daily management reports submitted yet.
                    </div>
                  ) : (
                    reports.map((rep) => (
                      <div key={rep.id} className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                          <h3 className="text-sm font-black text-white">Report Date: {rep.report_date}</h3>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {Number(rep.total_sales).toLocaleString()} XAF
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-300">
                          <div>
                            <span className="text-gray-500 font-bold block mb-1">Summary Notes:</span>
                            <p>{rep.summary_notes || 'No notes provided.'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 font-bold block mb-1">Issues Encountered:</span>
                            <p>{rep.issues_encountered || 'None reported.'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* CREATE PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateProduct}
            className="w-full max-w-md bg-gray-900 border border-gray-800 p-6 rounded-3xl shadow-2xl space-y-4"
          >
            <h3 className="text-base font-black text-white">Add New Dish / Menu Item</h3>

            {/* Item Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={submitting}
                placeholder="e.g. Poulet DG"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
            </div>

            {/* Category Selection / Creation */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Category (Select existing or type new) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                list="categories-list"
                disabled={submitting}
                placeholder="e.g. Mains, Drinks, Grill..."
                value={newProduct.category_name}
                onChange={(e) => setNewProduct({ ...newProduct, category_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
              <datalist id="categories-list">
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.name} />
                ))}
              </datalist>
            </div>

            {/* Price in XAF */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Price (XAF) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="50"
                disabled={submitting}
                placeholder="e.g. 5000"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              />
            </div>

            {/* Image File Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Product Image File
              </label>
              <input
                type="file"
                accept="image/*"
                disabled={submitting}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setImageFile(e.target.files[0]);
                  }
                }}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowProductModal(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? 'Uploading & Saving...' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}