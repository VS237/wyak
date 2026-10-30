'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Register Chart.js Modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface OrderRecord {
  created_at: string;
  total_amount: number;
}

interface OrderItemRecord {
  quantity: number;
  menu_items?: {
    categories?: {
      name: string;
    } | null;
  } | null;
}

export function RevenueLineChart({ orders = [] }: { orders?: OrderRecord[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyTotals = [0, 0, 0, 0, 0, 0, 0];

  if (Array.isArray(orders)) {
    orders.forEach((order) => {
      if (order?.created_at) {
        const date = new Date(order.created_at);
        const dayIndex = (date.getDay() + 6) % 7; 
        dailyTotals[dayIndex] += Number(order.total_amount || 0);
      }
    });
  }

  const chartData = {
    labels: days,
    datasets: [
      {
        fill: true,
        label: 'Weekly Revenue (XAF)',
        data: dailyTotals,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.15)',
        tension: 0.4,
      },
    ],
  };

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      }}
    />
  );
}

export function CategoryDoughnutChart({ orderItems = [] }: { orderItems?: OrderItemRecord[] }) {
  const categoryCounts: { [key: string]: number } = {};

  if (Array.isArray(orderItems)) {
    orderItems.forEach((item) => {
      const categoryName = item?.menu_items?.categories?.name || 'Mains';
      const qty = item?.quantity || 1;
      categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + qty;
    });
  }

  const hasData = Object.keys(categoryCounts).length > 0;
  const labels = hasData ? Object.keys(categoryCounts) : ['Mains', 'Drinks', 'Desserts'];
  const dataValues = hasData ? Object.values(categoryCounts) : [1, 1, 1];

  const chartData = {
    labels: labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: ['#d97706', '#059669', '#2563eb', '#dc2626', '#8b5cf6'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <Doughnut
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } },
      }}
    />
  );
}