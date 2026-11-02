'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import { createPersonnelAccount } from './actions';
import Image from 'next/image';

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

  // User creation state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'waiter',
  });

  // Fetch initial database records & categories
  useEffect(() => {
    async function fetchAdminData() {
      try {
        setLoading(true);

        const { data: profilesData } = await supabase.from('profiles').select('*');
        if (profilesData) setUsers(profilesData);

        const { data: menuData } = await supabase.from('menu_items').select('*, categories(name)');
        if (menuData) setProducts(menuData);

        const { data: catData } = await supabase.from('categories').select('*');
        if (catData) setCategoriesList(catData);

        const { data: reportsData } = await supabase.from('daily_reports').select('*').order('report_date', { ascending: false });
        if (reportsData) setReports(reportsData);

        const { data: ordersData } = await supabase.from('orders').select('total_amount, status');
        if (ordersData) {
          const rev = ordersData.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
          setMetrics({
            totalRevenue: rev,
            totalOrders: ordersData.length,
            activeStaffCount: profilesData?.filter((p) => p.is_active).length || 0,
          });
        }

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
        console.error('Erreur chargement données admin:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAdminData();
  }, [supabase]);

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

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.category_name) return;

    try {
      setSubmitting(true);
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
      console.error('Erreur création plat:', err.message);
      alert('Impossible de créer le plat.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);

    try {
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
      alert('Compte personnel créé avec succès !');
    } catch (err: any) {
      console.error('Erreur création utilisateur:', err?.message || err);
      alert(`Erreur: ${err?.message || 'Inconnue'}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col selection:bg-amber-500 selection:text-gray-950">
      {/* Top Admin Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-20 h-10 rounded-2xl  from-amber-00 to-amber-00 flex items-center justify-center text-white font-black text-lg">
            <Image
              src="/wyak-logo-orange.png"
              alt="WYAK Resto Suite Logo"
              width={120}
              height={120}
              className="h-auto w-24 object-contain"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">WYAK Resto Suite</h1>
             <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Panneau de contrôle Administrateur
            </span>
          </div>
        </div>

        {/* Module Navigation Tabs */}
        <div className="flex gap-1.5 bg-gray-950 p-1.5 rounded-2xl border border-gray-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'ANALYTICS', label: '📈 Activité' },
            { id: 'USERS', label: '👥 Personnel' },
            { id: 'PRODUCTS', label: '🍽️ Menu & Stock' },
            { id: 'REPORTS', label: '📄 Rapports' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap active:scale-95 shrink-0 ${
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
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-amber-500 font-bold text-xs gap-2">
            <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
            Synchronisation des données...
          </div>
        ) : (
          <>
            {/* TAB 1: BUSINESS HEALTH & ANALYTICS */}
            {activeTab === 'ANALYTICS' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Chiffre d'Affaires</span>
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-2 block truncate">
                      {metrics.totalRevenue.toLocaleString()} XAF
                    </span>
                    <span className="text-[10px] text-emerald-500 font-bold mt-1 block">Base de données en direct</span>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Commandes Totales</span>
                    <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-2 block">
                      {metrics.totalOrders}
                    </span>
                    <span className="text-[10px] text-amber-500 font-bold mt-1 block">Enregistrées</span>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Équipe Active</span>
                    <span className="text-2xl sm:text-3xl font-black text-sky-400 font-mono mt-2 block">
                      {metrics.activeStaffCount} Membres
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1 block">Profils connectés</span>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 p-5 rounded-2xl shadow-xl">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">État du Système</span>
                    <span className="text-2xl sm:text-3xl font-black text-purple-400 font-mono mt-2 block">En Ligne</span>
                    <span className="text-[10px] text-purple-400 font-bold mt-1 block">Supabase Connecté</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-gray-900 border border-gray-800 p-5 sm:p-6 rounded-3xl shadow-2xl">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-300 mb-4">
                      Trajectoire des Ventes (XAF)
                    </h3>
                    <div className="h-60 sm:h-64">
                      <RevenueLineChart orders={ordersList} />
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-800 p-5 sm:p-6 rounded-3xl shadow-2xl flex flex-col justify-between">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-300 mb-4">
                      Part des Ventes par Catégorie
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
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-400">
                    Gestion du Personnel & Accès
                  </h2>
                  <button
                    onClick={() => setIsCreateUserModalOpen(true)}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/20 cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>+</span> Ajouter un Employé
                  </button>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300 min-w-[600px]">
                      <thead className="bg-gray-950 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-800">
                        <tr>
                          <th className="px-6 py-4">Nom de l'Employé</th>
                          <th className="px-6 py-4">Téléphone</th>
                          <th className="px-6 py-4">Rôle</th>
                          <th className="px-6 py-4">Statut</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-800/40 transition-colors">
                            <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] shrink-0">
                                👤
                              </span>
                              <span className="truncate">{user.full_name}</span>
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
                                {user.is_active ? 'ACTIF' : 'SUSPENDU'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => toggleUserStatus(user.id, user.is_active)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 ${
                                  user.is_active
                                    ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                                }`}
                              >
                                {user.is_active ? 'Suspendre' : 'Activer'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* CREATE USER MODAL */}
                {isCreateUserModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
                      <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-800">
                        <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          <span>👤</span> Enregistrer un Personnel
                        </h3>
                        <button
                          onClick={() => setIsCreateUserModalOpen(false)}
                          className="text-gray-400 hover:text-white text-sm font-bold cursor-pointer p-1"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleCreateUser} className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                            Nom complet <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="ex: Jean Dupont"
                            value={newUserForm.full_name}
                            onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                            Adresse Email (Connexion) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="ex: jean@wyak.cm"
                            value={newUserForm.email}
                            onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                            Mot de passe temporaire <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="Min 6 caractères"
                            value={newUserForm.password}
                            onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                            Téléphone (+237) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="ex: 699000000"
                            value={newUserForm.phone_number}
                            onChange={(e) => setNewUserForm({ ...newUserForm, phone_number: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                            Rôle <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={newUserForm.role}
                            onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase font-bold"
                          >
                            <option value="waiter">Serveur</option>
                            <option value="kitchen">Cuisine</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-800">
                          <button
                            type="button"
                            onClick={() => setIsCreateUserModalOpen(false)}
                            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={isCreatingUser}
                            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                          >
                            {isCreatingUser ? 'Création...' : 'Créer le compte'}
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
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-400">
                    Catalogue du Menu & Stock
                  </h2>
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-amber-600/20 active:scale-95"
                  >
                    + Créer un Plat
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-xl"
                    >
                      <div>
                        {prod.image_url && (
                          <div className="w-full h-32 mb-3 rounded-xl overflow-hidden bg-gray-950 border border-gray-800 relative">
                            <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {prod.categories?.name || 'Plat'}
                        </span>
                        <h3 className="font-extrabold text-white text-base mt-2">{prod.name}</h3>
                        <span className="text-lg font-black text-amber-400 font-mono mt-1 block">
                          {Number(prod.price).toLocaleString()} XAF
                        </span>
                      </div>

                      <div className="pt-3 border-t border-gray-800 flex justify-between items-center">
                        <span className="text-[11px] text-gray-400 font-semibold">Disponible QR Menu</span>
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
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-gray-400">
                    Rapports Financiers de Fin de Journée
                  </h2>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-200 text-xs font-bold rounded-xl border border-gray-800 cursor-pointer transition-all active:scale-95"
                  >
                    🖨️ Imprimer le Rapport Exécutif
                  </button>
                </div>

                <div className="space-y-4">
                  {reports.length === 0 ? (
                    <div className="p-8 bg-gray-900 rounded-2xl text-center text-gray-400 text-xs">
                      Aucun rapport journalier soumis pour le moment.
                    </div>
                  ) : (
                    reports.map((rep) => (
                      <div key={rep.id} className="bg-gray-900 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-800 pb-3 gap-2">
                          <h3 className="text-xs sm:text-sm font-black text-white">Date du Rapport : {rep.report_date}</h3>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {Number(rep.total_sales).toLocaleString()} XAF
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-300">
                          <div>
                            <span className="text-gray-500 font-bold block mb-1">Notes de synthèse :</span>
                            <p>{rep.summary_notes || 'Aucune note fournie.'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 font-bold block mb-1">Incidents rencontrés :</span>
                            <p>{rep.issues_encountered || 'Aucun incident.'}</p>
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
            className="w-full max-w-md bg-gray-900 border border-gray-800 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-sm sm:text-base font-black text-white">Ajouter un Nouveau Plat</h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Nom du Plat <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={submitting}
                placeholder="ex: Poulet DG"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Catégorie <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                list="categories-list"
                disabled={submitting}
                placeholder="ex: Plats, Boissons, Grillades..."
                value={newProduct.category_name}
                onChange={(e) => setNewProduct({ ...newProduct, category_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
              />
              <datalist id="categories-list">
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Prix (XAF) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="50"
                disabled={submitting}
                placeholder="ex: 5000"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-base sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Image du Produit
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
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Création...' : 'Enregistrer le plat'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}