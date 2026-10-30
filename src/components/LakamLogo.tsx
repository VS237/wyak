// src/components/LakamLogo.tsx
import React from 'react';

export function LakamLogo({ className = "w-36 h-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Glowing Amber Gradient */}
        <linearGradient id="amberGlow" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        {/* Soft Background Glass Gradient */}
        <linearGradient id="bgGlass" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18181b" stopOpacity="0.9" />
          <stop offset="1" stopColor="#09090b" stopOpacity="0.95" />
        </linearGradient>
        {/* Drop Shadow for Depth */}
        <filter id="subtleShadow" x="-4" y="-4" width="72" height="72" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#d97706" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* --- ICON EMBLEM --- */}
      <g filter="url(#subtleShadow)">
        {/* Outer Hex/Rounded Frame */}
        <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#bgGlass)" stroke="url(#amberGlow)" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* Abstract Modern Royal Crown & Dining Cloche Motif */}
        {/* Central Crown Spire */}
        <path d="M32 18L36.5 27H27.5L32 18Z" fill="url(#amberGlow)" />
        
        {/* Side Peaks */}
        <path d="M21 23L25 29H19L21 23Z" fill="#f59e0b" fillOpacity="0.75" />
        <path d="M43 23L45 29H39L43 23Z" fill="#f59e0b" fillOpacity="0.75" />

        {/* Serving Dome Arc (Cloche) */}
        <path
          d="M17 43C17 36.3726 23.8203 31 32 31C40.1797 31 47 36.3726 47 43H17Z"
          fill="url(#amberGlow)"
        />

        {/* Base Plate Accent Line */}
        <rect x="13" y="47" width="38" height="3.5" rx="1.75" fill="#ffffff" />
      </g>

      {/* --- TYPOGRAPHY (Wordmark) --- */}
      {/* Brand Name */}
      <text
        x="72"
        y="42"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="30"
        letterSpacing="-0.75"
        fill="#ffffff"
      >
        La&apos;kam
      </text>

      {/* Live Operational Indicator Dot + Subtitle */}
      <circle cx="76" cy="57" r="3" fill="#10b981" />
      <text
        x="86"
        y="60"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="700"
        fontSize="10"
        letterSpacing="3"
        fill="#a1a1aa"
        textTransform="uppercase"
      >
        Resto Suite
      </text>
    </svg>
  );
}