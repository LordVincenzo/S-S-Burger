import React, { useEffect, useMemo, useState, useRef } from "react";
import html2canvas from "html2canvas";


// === Lucide Icons (inline SVG para evitar dependencias) ===
const Icon = ({ d, size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
);

const Icons = {
  CheckCircle: ({ size, className }) => <Icon size={size} className={className} d={["M22 11.08V12a10 10 0 1 1-5.93-9.14", "M22 4 12 14.01l-3-3"]} />,
  Circle: ({ size, className }) => <Icon size={size} className={className} d="M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0" />,
  Plus: ({ size, className }) => <Icon size={size} className={className} d={["M12 5v14", "M5 12h14"]} />,
  Minus: ({ size, className }) => <Icon size={size} className={className} d="M5 12h14" />,
  ShoppingCart: ({ size, className }) => <Icon size={size} className={className} d={["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"]} />,
  Trash2: ({ size, className }) => <Icon size={size} className={className} d={["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", "M10 11v6", "M14 11v6"]} />,
  Wallet: ({ size, className }) => <Icon size={size} className={className} d={["M21 12V7H5a2 2 0 0 1 0-4h14v4", "M3 5v14a2 2 0 0 0 2 2h16v-5", "M18 12a2 2 0 0 0 0 4h4v-4z"]} />,
  X: ({ size, className }) => <Icon size={size} className={className} d={["M18 6 6 18", "M6 6l12 12"]} />,
  User: ({ size, className }) => <Icon size={size} className={className} d={["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8"]} />,
  Phone: ({ size, className }) => <Icon size={size} className={className} d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.71 4.9 2 2 0 0 1 3.7 2.7h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
  Send: ({ size, className }) => <Icon size={size} className={className} d={["M22 2 11 13", "M22 2 15 22 11 13 2 9l20-7z"]} />,
  History: ({ size, className }) => <Icon size={size} className={className} d={["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5", "M12 7v5l4 2"]} />,
  CalendarDays: ({ size, className }) => <Icon size={size} className={className} d={["M8 2v4", "M16 2v4", "M21 8H3", "M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 18h.01", "M12 18h.01", "M16 18h.01"]} />,
  Download: ({ size, className }) => <Icon size={size} className={className} d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"]} />,
  ChefHat: ({ size, className }) => <Icon size={size} className={className} d={["M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6z", "M6 17h12"]} />,
  Flame: ({ size, className }) => <Icon size={size} className={className} d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  Clock: ({ size, className }) => <Icon size={size} className={className} d={["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"]} />,
  CreditCard: ({ size, className }) => <Icon size={size} className={className} d={["M22 4H2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h20a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z", "M1 10h22"]} />,
  FileText: ({ size, className }) => <Icon size={size} className={className} d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"]} />,
  Search: ({ size, className }) => <Icon size={size} className={className} d={["M21 21l-4.35-4.35", "M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0"]} />,
  Package: ({ size, className }) => <Icon size={size} className={className} d={["M16.5 9.4l-9-5.19", "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.27 6.96 12 12.01l8.73-5.05", "M12 22.08V12"]} />,
};

// === CSS ===
const style = document.createElement("style");
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  :root {
    --bg: oklch(0.97 0.008 75);
    --card: oklch(1 0 0);
    --card-border: oklch(0.9 0.01 75);
    --fg: oklch(0.18 0.02 40);
    --fg-muted: oklch(0.5 0.02 40);
    --primary: oklch(0.52 0.19 30);
    --primary-fg: oklch(1 0 0);
    --primary-shadow: oklch(0.52 0.19 30 / 0.3);
    --success: oklch(0.52 0.15 152);
    --success-light: oklch(0.95 0.05 152);
    --success-fg: oklch(1 0 0);
    --warning: oklch(0.72 0.14 85);
    --warning-light: oklch(0.97 0.06 85);
    --warning-fg: oklch(0.25 0.05 60);
    --danger: oklch(0.52 0.2 25);
    --danger-light: oklch(0.97 0.04 25);
    --muted: oklch(0.94 0.008 75);
    --radius: 14px;
    --radius-sm: 10px;
    --radius-lg: 20px;
    --radius-xl: 26px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--fg); font-family: inherit; }

  /* Animations */
  @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes badgePop { 0% { transform: scale(0); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
  @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes modalIn { from { opacity: 0; transform: scale(0.94) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

  .animate-fadein { animation: fadeIn 0.35s ease both; }
  .animate-modal { animation: modalIn 0.3s cubic-bezier(.22,.68,0,1.2) both; }
  .animate-overlay { animation: overlayIn 0.2s ease both; }

  /* Layout */
  .app { min-height: 100vh; }
  .container { max-width: 1280px; margin: 0 auto; padding: 0 20px; }

  /* Header */
  .header {
    position: sticky; top: 0; z-index: 30;
    background: oklch(1 0 0 / 0.82);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--card-border);
    padding: 14px 0;
  }
  .header-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: transparent; /* o quítalo por completo */
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none; /* opcional, por si también quieres quitar el efecto */
  padding: 0;
  overflow: hidden;
}

.brand-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
  
  .brand-title { font-size: 22px; font-weight: 800; color: var(--fg); letter-spacing: -0.5px; }
  .brand-sub { font-size: 13px; color: var(--fg-muted); margin-top: 2px; }
  .header-actions { display: flex; flex-wrap: wrap; gap: 8px; }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 18px; border-radius: var(--radius); border: none;
    font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s;
  }
  .btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .btn:active { transform: translateY(0); opacity: 1; }
  .btn-primary { background: var(--primary); color: var(--primary-fg); box-shadow: 0 4px 14px var(--primary-shadow); }
  .btn-ghost { background: var(--card); color: var(--fg); border: 1px solid var(--card-border); }
  .btn-ghost:hover { background: var(--muted); }
  .btn-success { background: var(--success); color: var(--success-fg); box-shadow: 0 4px 14px oklch(0.52 0.15 152 / 0.3); }
  .btn-danger { background: var(--danger-light); color: var(--danger); border: 1px solid oklch(0.88 0.04 25); }
  .btn-sm { padding: 7px 13px; font-size: 13px; }
  .btn-icon { padding: 9px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 24px 0; }
  @media (max-width: 640px) { .stats-grid { grid-template-columns: 1fr; } }
  .stat-card {
    background: var(--card); border: 1px solid var(--card-border);
    border-radius: var(--radius-lg); padding: 20px 22px;
    box-shadow: 0 1px 4px oklch(0 0 0 / 0.04);
    animation: fadeIn 0.4s ease both;
  }
  .stat-card:nth-child(2) { animation-delay: 0.05s; }
  .stat-card:nth-child(3) { animation-delay: 0.1s; }
  .stat-card.success { background: var(--success-light); border-color: oklch(0.82 0.08 152); }
  .stat-card.warning { background: var(--warning-light); border-color: oklch(0.88 0.08 85); }
  .stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin-bottom: 6px; }
  .stat-value { font-size: 26px; font-weight: 800; color: var(--fg); letter-spacing: -0.5px; }
  .stat-card.success .stat-value { color: var(--success); }
  .stat-card.warning .stat-value { color: var(--warning-fg); }

  /* Filters */
  .filter-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
  .filter-pills { display: flex; gap: 6px; background: var(--muted); padding: 4px; border-radius: var(--radius-sm); }
  .filter-pill {
    padding: 7px 16px; border-radius: calc(var(--radius-sm) - 2px); border: none;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    color: var(--fg-muted); background: transparent; transition: all 0.2s;
  }
  .filter-pill.active { background: var(--card); color: var(--fg); box-shadow: 0 1px 6px oklch(0 0 0 / 0.1); }
  .whatsapp-row { display: flex; align-items: center; gap: 10px; }
  .whatsapp-row label { font-size: 13px; color: var(--fg-muted); white-space: nowrap; }

  /* Input */
  .input {
    padding: 10px 16px; border-radius: var(--radius); border: 1.5px solid var(--card-border);
    background: var(--card); color: var(--fg); font-size: 14px; font-family: inherit;
    width: 100%; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px oklch(0.52 0.19 30 / 0.12); }
  .input::placeholder { color: var(--fg-muted); }
  .input-search { padding-left: 42px; }
  .input-wrap { position: relative; }
  .input-wrap .icon-left { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--fg-muted); pointer-events: none; }

  /* Orders Grid */
  .orders-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .empty-state { grid-column: 1/-1; text-align: center; padding: 72px 24px; color: var(--fg-muted); }
  .empty-state svg { opacity: 0.2; margin: 0 auto 16px; display: block; }
  .empty-state p { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .empty-state span { font-size: 14px; }

  /* Order Card */
  .order-card {
    background: var(--card); border-radius: var(--radius-lg);
    border: 1.5px solid var(--card-border);
    box-shadow: 0 1px 6px oklch(0 0 0 / 0.04);
    overflow: hidden;
    animation: fadeIn 0.35s ease both;
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .order-card:hover { box-shadow: 0 6px 24px oklch(0 0 0 / 0.08); transform: translateY(-2px); }
  .order-card.kitchen-preparing { border-color: oklch(0.82 0.12 85); }
  .order-card.kitchen-ready { border-color: oklch(0.82 0.1 152); }

  .order-card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .order-card-header.pending { background: var(--muted); color: var(--fg-muted); }
  .order-card-header.preparing { background: oklch(0.97 0.06 85); color: oklch(0.45 0.1 60); }
  .order-card-header.ready { background: oklch(0.95 0.06 152); color: oklch(0.38 0.12 152); }
  .order-card-header .header-left { display: flex; align-items: center; gap: 6px; }

  .order-card-body { padding: 16px; }
  .order-name { font-size: 16px; font-weight: 800; color: var(--fg); }
  .order-phone { font-size: 12px; color: var(--fg-muted); display: flex; align-items: center; gap: 4px; margin-top: 3px; }
  .order-meta { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
  .order-total { font-size: 20px; font-weight: 800; color: var(--primary); text-align: right; }
  .order-items { font-size: 13px; color: var(--fg-muted); line-height: 1.5; margin-bottom: 10px; }
  .order-note { font-size: 12px; color: var(--fg-muted); background: var(--muted); border-radius: var(--radius-sm); padding: 8px 12px; margin-bottom: 10px; font-style: italic; }

  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .badge-paid { background: var(--success-light); color: oklch(0.38 0.12 152); }
  .badge-unpaid { background: var(--warning-light); color: var(--warning-fg); }

  /* Kitchen buttons */
  .kitchen-pills { display: flex; gap: 4px; margin: 10px 0; }
  .kitchen-pill {
    flex: 1; padding: 7px 4px; border-radius: var(--radius-sm); border: 1.5px solid transparent;
    font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; text-align: center;
    background: var(--muted); color: var(--fg-muted); transition: all 0.18s;
  }
  .kitchen-pill.active.pending { background: var(--muted); border-color: var(--card-border); color: var(--fg); }
  .kitchen-pill.active.preparing { background: oklch(0.96 0.07 85); border-color: oklch(0.78 0.14 85); color: oklch(0.4 0.1 60); }
  .kitchen-pill.active.ready { background: oklch(0.94 0.07 152); border-color: oklch(0.75 0.12 152); color: oklch(0.36 0.12 152); }
  .kitchen-pill:not(.active):hover { background: oklch(0.92 0.01 75); }

  /* Card actions */
  .order-actions { display: flex; gap: 6px; margin-top: 10px; }
  .order-actions .btn { font-size: 12px; padding: 8px 12px; }
  .order-actions .btn-icon { padding: 8px; }

  /* Menu rápido */
  .section-title { font-size: 18px; font-weight: 800; color: var(--fg); margin: 32px 0 16px; letter-spacing: -0.3px; }
  .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
  .menu-card {
    background: var(--card); border-radius: var(--radius-lg); border: 1.5px solid var(--card-border);
    overflow: hidden; cursor: pointer; transition: all 0.2s;
  }
  .menu-card:hover { box-shadow: 0 6px 20px oklch(0 0 0 / 0.1); transform: translateY(-3px); border-color: var(--primary); }
  .menu-card-img { width: 100%; height: 120px; object-fit: cover; background: var(--muted); display: flex; align-items: center; justify-content: center; color: var(--fg-muted); }
  .menu-card-img img { width: 100%; height: 100%; object-fit: cover; }
  .menu-card-body { padding: 12px; }
  .menu-card-name { font-size: 13px; font-weight: 700; color: var(--fg); margin-bottom: 2px; }
  .menu-card-price { font-size: 12px; color: var(--fg-muted); font-weight: 600; }
  .menu-card-action { margin-top: 10px; width: 100%; font-size: 12px; padding: 8px; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-family: inherit; font-weight: 700; transition: opacity 0.15s; }
  .menu-card-action:hover { opacity: 0.85; }

  /* Overlay */
  .overlay {
    position: fixed; inset: 0; z-index: 40;
    background: oklch(0.1 0 0 / 0.55);
    backdrop-filter: blur(6px);
    animation: overlayIn 0.2s ease both;
  }

  /* Modal */
  .modal-wrap {
    position: fixed; inset: 0; z-index: 50;
    display: grid; place-items: center; padding: 16px;
    pointer-events: none;
  }
  .modal {
    width: 100%; max-width: 680px; max-height: 90vh;
    background: var(--card); border-radius: var(--radius-xl);
    box-shadow: 0 24px 80px oklch(0 0 0 / 0.22);
    display: flex; flex-direction: column;
    overflow: hidden; pointer-events: all;
    animation: modalIn 0.3s cubic-bezier(.22,.68,0,1.2) both;
  }
  .modal-lg { max-width: 1100px; }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 18px; border-bottom: 1px solid var(--card-border); flex-shrink: 0;
  }
  .modal-title { font-size: 20px; font-weight: 800; color: var(--fg); letter-spacing: -0.3px; }
  .modal-body { flex: 1; overflow-y: auto; padding: 22px 24px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--card-border); display: flex; gap: 10px; justify-content: flex-end; flex-shrink: 0; }

  /* New Order layout */
  .new-order-grid { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 22px; }
  @media (max-width: 700px) { .new-order-grid { grid-template-columns: 1fr; } }
  .new-order-left { display: flex; flex-direction: column; gap: 14px; }
  .new-order-right { overflow-y: auto; max-height: 60vh; }

  .form-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin-bottom: 6px; display: block; }
  .form-group { display: flex; flex-direction: column; }
  textarea.input { resize: vertical; min-height: 70px; }

  /* Cart */
  .cart-box { background: var(--muted); border-radius: var(--radius-lg); padding: 16px; flex: 1; min-height: 0; }
  .cart-box-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .cart-box-title { font-size: 14px; font-weight: 800; color: var(--fg); }
  .cart-empty { font-size: 13px; color: var(--fg-muted); text-align: center; padding: 20px 0; }
  .cart-item { display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 4px 0; }
  .cart-total-row { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1.5px solid var(--card-border); margin-top: 10px; font-size: 16px; font-weight: 800; }

  /* Products in modal */
  .category-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--fg-muted); margin: 16px 0 10px; }
  .product-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .product-card {
    background: var(--card); border-radius: var(--radius); border: 1.5px solid var(--card-border);
    overflow: hidden; transition: all 0.18s;
    position: relative;
  }
  .product-card.selected { border-color: var(--primary); box-shadow: 0 0 0 3px oklch(0.52 0.19 30 / 0.15); }
  .product-card-img { width: 100%; height: 90px; object-fit: cover; background: var(--muted); display: flex; align-items: center; justify-content: center; color: var(--fg-muted); }
  .product-card-img img { width: 100%; height: 100%; object-fit: cover; }
  .product-badge-count {
    position: absolute; top: 7px; right: 7px;
    width: 22px; height: 22px; border-radius: 999px;
    background: var(--primary); color: white; font-size: 11px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    animation: badgePop 0.25s cubic-bezier(.22,.68,0,1.2) both;
    box-shadow: 0 2px 8px var(--primary-shadow);
  }
  .product-card-info { padding: 8px 10px; }
  .product-card-name { font-size: 11px; font-weight: 700; color: var(--fg); margin-bottom: 2px; line-height: 1.3; }
  .product-card-price { font-size: 11px; color: var(--fg-muted); font-weight: 600; margin-bottom: 8px; }
  .product-card-controls { display: flex; align-items: center; gap: 6px; }
  .qty-btn {
    flex: 1; padding: 6px; border: 1.5px solid var(--card-border); border-radius: var(--radius-sm);
    background: var(--muted); color: var(--fg); cursor: pointer; font-family: inherit; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .qty-btn:hover { background: var(--primary); color: white; border-color: var(--primary); }
  .qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .qty-btn.add { background: var(--primary); color: white; border-color: var(--primary); }
  .qty-num { min-width: 20px; text-align: center; font-size: 13px; font-weight: 800; }

  /* Payment methods */
  .pay-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .pay-method {
    padding: 14px 10px; border-radius: var(--radius); border: 2px solid var(--card-border);
    background: var(--card); cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700;
    color: var(--fg-muted); text-align: center; transition: all 0.18s;
  }
  .pay-method:hover { border-color: var(--primary); color: var(--primary); }
  .pay-method.selected { border-color: var(--primary); background: oklch(0.97 0.05 30); color: var(--primary); }

  /* History */
  .hist-item { padding: 14px 16px; display: flex; align-items: flex-start; gap: 14px; }
  .hist-item:not(:last-child) { border-bottom: 1px solid var(--card-border); }
  .hist-date { font-size: 11px; font-weight: 700; color: var(--fg-muted); min-width: 76px; margin-top: 2px; }
  .hist-info { flex: 1; min-width: 0; }
  .hist-name { font-size: 14px; font-weight: 800; color: var(--fg); }
  .hist-items { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
  .hist-right { text-align: right; }
  .hist-total { font-size: 15px; font-weight: 800; color: var(--primary); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: oklch(0.82 0.01 75); border-radius: 999px; }

  /* Checkbox */
  .check-row { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .check-box {
    width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--card-border);
    background: var(--card); display: flex; align-items: center; justify-content: center;
    transition: all 0.18s; flex-shrink: 0;
  }
  .check-box.checked { background: var(--success); border-color: var(--success); }
  .check-label { font-size: 14px; font-weight: 600; color: var(--fg); }

  /* Hidden receipt area */
  .receipt-hidden { position: fixed; left: -9999px; top: 0; }

  /* Receipt/Invoice styles */
  .receipt-doc { width: 420px; background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; color: #111; position: relative; overflow: hidden; }
  .receipt-header { background: #1a1a2e; color: #fff; border-radius: 12px; padding: 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
  .receipt-header-title { font-size: 17px; font-weight: 800; }
  .receipt-header-sub { font-size: 12px; opacity: 0.7; margin-top: 3px; }
  .receipt-logo { width: 52px; height: 52px; border-radius: 10px; background: rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; font-size: 22px; }
  .receipt-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 5px 0; font-size: 13px; }
  .receipt-label { color: #6b7280; }
  .receipt-value { font-weight: 700; text-align: right; }
  .receipt-divider { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
  .receipt-item { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; margin-bottom: 8px; }
  .receipt-item-name { font-size: 13px; font-weight: 700; }
  .receipt-item-sub { font-size: 11px; color: #6b7280; margin-top: 3px; }
  .receipt-item-price { font-size: 13px; font-weight: 800; }
  .receipt-total { border-radius: 10px; padding: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 800; margin-top: 12px; }
  .receipt-total.paid { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .receipt-total.unpaid { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .receipt-footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 14px; }
`;
if (!document.head.querySelector("[data-app-style]")) {
  style.setAttribute("data-app-style", "1");
  document.head.appendChild(style);
}

// === Utilidades ===
const currency = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const todayKey = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const STORAGE_KEY = "fastfood_orders_v2";
const loadOrders = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
};
const saveOrders = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

const DEFAULT_PRODUCTS = [
  { id: "perro_sencillo", name: "Perro Sencillo", price: 6000, image: "/img/perro_sencillo.jpg", category: "Hot Dogs" },
  { id: "choriperro", name: "Choriperro", price: 10000, image: "/img/choriperro.jpg", category: "Hot Dogs" },
  { id: "perro_suizo", name: "Perro Suizo", price: 12000, image: "/img/perro_suizo.jpg", category: "Hot Dogs" },
  { id: "perro_mixto_S&S", name: "Perro Mixto S&S", price: 12000, image: "/img/perro_mixto_ss.jpg", category: "Hot Dogs" },
  { id: "tocisuizo", name: "Tocisuizo", price: 14000, image: "/img/tocisuizo2.jpg", category: "Hot Dogs" },
  { id: "italo_suizo", name: "Italo Suizo", price: 14000, image: "/img/italo_suizo.jpg", category: "Hot Dogs" },
  { id: "Burguer_clasica", name: "Hamburguesa Clasica con papitas", price: 15000, image: "/img/hamburgesa_clasica.png", category: "Burgers" },
  { id: "S&S_burguer", name: "S&S Burguer con papitas", price: 18000, image: "/img/s_s_burguer.jpg", category: "Burgers" },
  { id: "S&S_maxi_burguer", name: "S&S Maxi Burguer con papitas", price: 22000, image: "/img/s_s_maxi_burguer.jpg", category: "Burgers" },
  { id: "gaseosa", name: "Gaseosa", price: 3000, image: "/img/gaseosa2.png", category: "Bebidas" },
  { id: "papasfritas", name: "Papitas Fritas", price: 4000, image: "/img/papitas.jpg", category: "Extras" },
  { id: "combo_sencillo", name: "Combo Sencillo", price: 9000, image: "/img/combo_sencillo.jpg", category: "Combos" },
  { id: "combo_tocisuizo", name: "Combo Tocisuizo", price: 17000, image: "/img/combo_tocisuizo.jpg", category: "Combos" },
  { id: "combo_S&S_burguer", name: "Combo S&S Burguer", price: 17000, image: "/img/combo_s_s_burguer.png", category: "Combos" },
  { id: "Salchipapa_sencilla", name: "S&S Salchipapa Sencilla", price: 12000, image: "/img/salchipapa.png", category: "Salchipapas" },
  { id: "Salchipapa_mixta", name: "S&S Mixta Salchipapa", price: 20000, image: "/img/salchipapa.png", category: "Salchipapas" },
  { id: "Salchipapa_especial", name: "S&S Especial Salchipapa", price: 32000, image: "/img/salchipapa.png", category: "Salchipapas" },
  { id: "Choripapa", name: "Choripapa", price: 14000, image: "/img/salchipapa.png", category: "Salchipapas" },
  { id: "Salchipapa_chikenSuiz", name: "Chiken Suiz", price: 22000, image: "/img/salchipapa.png", category: "Salchipapas" },
  { id: "domicilio_1", name: "Domicilio Cercano", price: 1000, image: "/img/domicilio.png", category: "Servicios" },
  { id: "domicilio_2", name: "Domicilio Lejano", price: 2000, image: "/img/domicilio.png", category: "Servicios" },
];

const orderTotal = (o) => {
  if (o.items) return o.items.reduce((acc, it) => acc + it.product.price * it.qty, 0);
  return (o?.product?.price || 0) * (o?.qty || 0);
};

const prettyMethod = (m) => {
  const map = { cash: "Efectivo", nequi: "Nequi", bancolombia: "Bancolombia", daviplata: "Daviplata" };
  return map[m] || m || "Efectivo";
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Efectivo" },
  { id: "nequi", label: "Nequi" },
  { id: "bancolombia", label: "Bancolombia" },
  { id: "daviplata", label: "Daviplata" },
  { id: "other", label: "Otro" },
];

const CATEGORIES = [...new Set(DEFAULT_PRODUCTS.map((p) => p.category))];

// === Sub-components ===

function ProductCard({ product, qty, onAdd, onSub }) {
  return (
    <div className={`product-card ${qty > 0 ? "selected" : ""}`}>
      <div className="product-card-img">
        <img src={product.image} alt={product.name} onError={(e) => { e.target.style.display = "none"; }} />
        {qty > 0 && <span className="product-badge-count">{qty}</span>}
      </div>
      <div className="product-card-info">
        <div className="product-card-name">{product.name}</div>
        <div className="product-card-price">{currency(product.price)}</div>
        <div className="product-card-controls">
          <button className="qty-btn" onClick={onSub} disabled={qty === 0}>
            <Icons.Minus size={12} />
          </button>
          <span className="qty-num">{qty}</span>
          <button className="qty-btn add" onClick={onAdd}>
            <Icons.Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onTogglePaid, onRemove, onKitchenChange, onDownloadReceipt, onDownloadInvoice }) {
  const itemsText = order.items
    ? order.items.map((it) => `${it.qty}× ${it.product.name}`).join(" · ")
    : `${order.qty}× ${order.product?.name}`;
  const total = orderTotal(order);
  const kitchen = order.kitchen || "pending";
  const time = new Date(order.at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  const kitchenLabels = { pending: "Sin iniciar", preparing: "En preparación", ready: "Entregado" };
  const KitchenIcons = { pending: Icons.Clock, preparing: Icons.Flame, ready: Icons.CheckCircle };
  const KIcon = KitchenIcons[kitchen];

  return (
    <div className={`order-card kitchen-${kitchen}`}>
      <div className={`order-card-header ${kitchen}`}>
        <span className="header-left">
          <KIcon size={13} /> {kitchenLabels[kitchen]}
        </span>
        <span>{time}</span>
      </div>
      <div className="order-card-body">
        <div className="order-meta">
          <div>
            <div className="order-name">{order.customerName}</div>
            {order.phone && (
              <div className="order-phone"><Icons.Phone size={11} /> {order.phone}</div>
            )}
          </div>
          <div>
            <div className="order-total">{currency(total)}</div>
            <div style={{ marginTop: 4, textAlign: "right" }}>
              {order.paid ? (
                <span className="badge badge-paid">✓ {prettyMethod(order.paymentMethod)}</span>
              ) : (
                <span className="badge badge-unpaid">⏳ Pendiente</span>
              )}
            </div>
          </div>
        </div>

        <div className="order-items">{itemsText}</div>
        {order.note && <div className="order-note">📝 {order.note}</div>}

        <div className="kitchen-pills">
          {["pending", "preparing", "ready"].map((s) => (
            <button
              key={s}
              className={`kitchen-pill ${kitchen === s ? `active ${s}` : ""}`}
              onClick={() => onKitchenChange(s)}
            >
              {kitchenLabels[s]}
            </button>
          ))}
        </div>

        <div className="order-actions">
          <button
            className={`btn btn-sm ${order.paid ? "btn-ghost" : "btn-success"}`}
            style={{ flex: 1 }}
            onClick={onTogglePaid}
          >
            {order.paid ? (
              <>
                <Icons.X size={13} /> Desmarcar
              </>
            ) : (
              <>
                <Icons.Wallet size={13} /> Cobrar
              </>
            )}
          </button>

          {!order.paid ? (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onDownloadInvoice}
              title="Descargar factura"
              style={{
                fontSize: 11,
                gap: 4,
                padding: "8px 10px",
                width: "auto",
              }}
            >
              <Icons.FileText size={14} /> Factura
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onDownloadReceipt}
              title="Descargar comprobante"
              style={{
                fontSize: 11,
                gap: 4,
                padding: "8px 10px",
                width: "auto",
              }}
            >
              <Icons.Download size={14} /> Comprobante
            </button>
          )}

          <button
            className="btn btn-danger btn-icon btn-sm"
            onClick={() => {
              if (window.confirm("¿Seguro que quieres eliminar este pedido?")) {
                onRemove();
              }
            }}
            title="Eliminar pedido"
            aria-label="Eliminar pedido"
            style={{
              padding: "8px 10px",
              width: "auto",
            }}
          >
            <Icons.Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// === Main App ===
export default function App() {
  const [products] = useState(DEFAULT_PRODUCTS);
  const [ordersByDay, setOrdersByDay] = useState(loadOrders);
  const [showNew, setShowNew] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [histStatus, setHistStatus] = useState("all");
  const [histDate, setHistDate] = useState("");
  const [filterPaid, setFilterPaid] = useState("all");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState({});
  const [isPaid, setIsPaid] = useState(false);
  const [note, setNote] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [payModal, setPayModal] = useState({ open: false, orderId: null, method: "cash", customMethod: "", ref: "" });
  const receiptRef = useRef(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const invoiceRef = useRef(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [phoneGlobal, setPhoneGlobal] = useState(() => localStorage.getItem("fastfood_whatsapp_admin") || "");

  const dayKey = todayKey();
  const orders = useMemo(() => ordersByDay[dayKey] || [], [ordersByDay, dayKey]);

  useEffect(() => saveOrders(ordersByDay), [ordersByDay]);
  useEffect(() => localStorage.setItem("fastfood_whatsapp_admin", phoneGlobal || ""), [phoneGlobal]);

  useEffect(() => {
    const lock = showNew || showHistory || payModal.open;
    if (lock) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [showNew, showHistory, payModal.open]);

  // Cart
  const addToCart = (p) => setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty || 0) + 1 } }));
  const subFromCart = (p) => setCart((c) => {
    const q = c[p.id]?.qty || 0;
    if (q <= 1) { const { [p.id]: _, ...rest } = c; return rest; }
    return { ...c, [p.id]: { product: p, qty: q - 1 } };
  });
  const clearCart = () => setCart({});

  const addOrder = () => {
    const items = Object.values(cart);
    if (items.length === 0) return alert("Agrega al menos un producto");
    const newOrder = {
      id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
      at: new Date().toISOString(),
      customerName: customerName.trim() || "Sin nombre",
      phone: phone.trim(),
      items,
      paid: !!isPaid,
      paymentMethod: isPaid ? "cash" : "",
      paymentRef: "",
      kitchen: "pending",
      note: note.trim(),
    };
    setOrdersByDay({ ...ordersByDay, [dayKey]: [newOrder, ...orders] });
    setCustomerName(""); setPhone(""); setCart({}); setIsPaid(false); setNote(""); setShowNew(false);
  };

  const removeOrder = (id) => setOrdersByDay({ ...ordersByDay, [dayKey]: orders.filter((o) => o.id !== id) });

  const openPayModal = (order) => {
    if (order.paid) {
      setOrdersByDay({ ...ordersByDay, [dayKey]: orders.map((o) => o.id === order.id ? { ...o, paid: false, paymentMethod: "", paymentRef: "" } : o) });
      return;
    }
    setPayModal({ open: true, orderId: order.id, method: "cash", customMethod: "", ref: "" });
  };

  const confirmPayment = () => {
    const { orderId, method, ref, customMethod } = payModal;
    const methodFinal = method === "other" ? customMethod || "Otro" : method;
    setOrdersByDay({ ...ordersByDay, [dayKey]: orders.map((o) => o.id === orderId ? { ...o, paid: true, paymentMethod: methodFinal, paymentRef: ref || "" } : o) });
    setPayModal({ open: false, orderId: null, method: "cash", customMethod: "", ref: "" });
  };

  const setKitchen = (id, value) => {
    setOrdersByDay((prev) => ({ ...prev, [dayKey]: (prev[dayKey] || []).map((o) => o.id === id ? { ...o, kitchen: value } : o) }));
  };

  const filtered = useMemo(() => orders.filter((o) => filterPaid === "all" || (filterPaid === "paid" && o.paid) || (filterPaid === "unpaid" && !o.paid)), [orders, filterPaid]);

  const totals = useMemo(() => {
    const total = orders.reduce((acc, o) => acc + orderTotal(o), 0);
    const cobrados = orders.filter((o) => o.paid).reduce((acc, o) => acc + orderTotal(o), 0);
    return { total, cobrados, pendientes: total - cobrados };
  }, [orders]);

  // History
  const prevDays = Object.keys(ordersByDay).filter((d) => d !== dayKey).sort((a, b) => b.localeCompare(a));
  const historyList = useMemo(() => {
    const days = histDate ? [histDate] : prevDays;
    const list = [];
    days.forEach((d) => (ordersByDay[d] || []).forEach((o) => list.push({ ...o, _day: d })));
    return list.filter((o) => histStatus === "all" || (histStatus === "paid" && o.paid) || (histStatus === "unpaid" && !o.paid));
  }, [ordersByDay, prevDays, histDate, histStatus]);

  const historyTotals = useMemo(() => {
    const total = historyList.reduce((acc, o) => acc + orderTotal(o), 0);
    const cobrados = historyList.filter((o) => o.paid).reduce((acc, o) => acc + orderTotal(o), 0);
    return { total, cobrados, pendientes: total - cobrados, count: historyList.length };
  }, [historyList]);

  const exportHistoryCSV = () => {
    const header = ["fecha", "hora", "cliente", "telefono", "items", "total", "estado"].join(",");
    const rows = historyList.map((o) => {
      const d = new Date(o.at);
      const itemsText = o.items ? o.items.map((it) => `${it.qty}x ${it.product.name}`).join(" + ") : `${o.qty}x ${o.product?.name || ""}`;
      return [o._day || d.toISOString().slice(0, 10), d.toLocaleTimeString(), `"${o.customerName || ""}"`, `"${o.phone || ""}"`, `"${itemsText}"`, orderTotal(o), o.paid ? "PAGADO" : "PENDIENTE"].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "historial_filtrado.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const exportAllCSV = () => {
    const all = [];
    prevDays.forEach((d) => (ordersByDay[d] || []).forEach((o) => all.push({ ...o, _day: d })));
    const header = ["fecha", "hora", "cliente", "telefono", "items", "total", "estado"].join(",");
    const rows = all.map((o) => {
      const d = new Date(o.at);
      const itemsText = o.items ? o.items.map((it) => `${it.qty}x ${it.product.name}`).join(" + ") : "";
      return [o._day, d.toLocaleTimeString(), `"${o.customerName || ""}"`, `"${o.phone || ""}"`, `"${itemsText}"`, orderTotal(o), o.paid ? "PAGADO" : "PENDIENTE"].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "historial_completo.csv"; a.click(); URL.revokeObjectURL(url);
  };

  // WhatsApp
  const summaryText = () => {
    const lines = [`📊 Resumen ${dayKey}`, `━━━━━━━━━━━━━━━━━━━━`, `📦 Pedidos: ${orders.length}`, `💰 Cobrado: ${currency(totals.cobrados)}`, `⏳ Pendiente: ${currency(totals.pendientes)}`, `📈 Total: ${currency(totals.total)}`, ``,
    ...orders.map((o) => {
      const txt = o.items ? o.items.map((it) => `${it.qty}x ${it.product.name}`).join(", ") : `${o.qty}x ${o.product?.name}`;
      const pago = o.paid ? `✅ PAGADO - ${prettyMethod(o.paymentMethod)}${o.paymentRef ? ` - Ref:${o.paymentRef}` : ""}` : "⏳ PENDIENTE";
      return `• ${o.customerName} — ${txt} (${currency(orderTotal(o))}) ${pago}`;
    })
    ];
    return lines.join("\n");
  };
  const openWhatsApp = () => {
    const text = encodeURIComponent(summaryText());
    if (phoneGlobal.trim()) window.open(`https://wa.me/${phoneGlobal.replace(/\D/g, "")}?text=${text}`, "_blank");
    else window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Download
  const waitForPaint = async () => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    await document.fonts?.ready;
  };

  const safeFileName = (value = "pedido") =>
    String(value || "pedido")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 30) || "pedido";

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const captureElementAsPng = async (el) => {
    if (!el) {
      throw new Error("No se encontró el documento oculto para descargar.");
    }

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,

      // Importante:
      // Quitamos del clon la hoja CSS global del app porque tiene colores oklch(...)
      // y html2canvas puede romperse con eso.
      // Los comprobantes/facturas usan estilos inline, así que no necesitan esa hoja.
      onclone: (clonedDoc) => {
        clonedDoc.querySelector("[data-app-style]")?.remove();
      },
    });

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );

    if (!blob) {
      throw new Error("No se pudo convertir la imagen a PNG.");
    }

    return blob;
  };

  const downloadReceiptImage = async (order) => {
    try {
      setReceiptOrder(order);
      await waitForPaint();

      const blob = await captureElementAsPng(receiptRef.current);
      const fecha = new Date(order.at).toISOString().slice(0, 10);
      const nombre = safeFileName(order.customerName);

      downloadBlob(blob, `comprobante_${fecha}_${nombre}.png`);
    } catch (error) {
      console.error("Error descargando comprobante:", error);
      alert("No se pudo descargar el comprobante. Revisa la consola para ver el error.");
    }
  };

  const downloadInvoiceImage = async (order) => {
    try {
      setInvoiceOrder(order);
      await waitForPaint();

      const blob = await captureElementAsPng(invoiceRef.current);
      const fecha = new Date(order.at).toISOString().slice(0, 10);
      const nombre = safeFileName(order.customerName);

      downloadBlob(blob, `factura_${fecha}_${nombre}.png`);
    } catch (error) {
      console.error("Error descargando factura:", error);
      alert("No se pudo descargar la factura. Revisa la consola para ver el error.");
    }
  };

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((acc, it) => acc + it.product.price * it.qty, 0);
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(searchProduct.toLowerCase()));

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-inner">
            <div className="brand">
              <div className="brand-icon">
                <img src="/img/logo_ss.png" alt="Logo S&S" />
              </div>
              <div>
                <div className="brand-title">S&S Burger & Hot Dogs</div>
                <div className="brand-sub">
                  {new Date().toLocaleDateString("es-CO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })} · {dayKey}
                </div>
              </div>
            </div>
            <div className="header-actions">
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                <Icons.Plus size={16} /> Nueva orden
              </button>
              <button className="btn btn-ghost" onClick={() => setShowHistory(true)}>
                <Icons.History size={16} /> Historial
              </button>
              <button className="btn btn-success" onClick={openWhatsApp}>
                <Icons.Send size={16} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingBottom: 48 }}>
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total del día</div>
            <div className="stat-value">{currency(totals.total)}</div>
          </div>
          <div className="stat-card success">
            <div className="stat-label">Cobrado</div>
            <div className="stat-value">{currency(totals.cobrados)}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Pendiente</div>
            <div className="stat-value">{currency(totals.pendientes)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-row">
          <div className="filter-pills">
            {["all", "paid", "unpaid"].map((v) => (
              <button key={v} className={`filter-pill ${filterPaid === v ? "active" : ""}`} onClick={() => setFilterPaid(v)}>
                {v === "all" ? "Todos" : v === "paid" ? "Pagados" : "Pendientes"}
              </button>
            ))}
          </div>
          <div className="whatsapp-row">
            <label>WhatsApp admin:</label>
            <input className="input" style={{ width: 200 }} placeholder="573001112233" value={phoneGlobal} onChange={(e) => setPhoneGlobal(e.target.value)} />
          </div>
        </div>

        {/* Orders */}
        <div className="orders-grid">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Icons.Package size={64} />
              <p>Sin pedidos todavía</p>
              <span>Crea el primero con el botón "Nueva orden"</span>
            </div>
          ) : (
            filtered.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onTogglePaid={() => openPayModal(o)}
                onRemove={() => removeOrder(o.id)}
                onKitchenChange={(s) => setKitchen(o.id, s)}
                onDownloadReceipt={() => downloadReceiptImage(o)}
                onDownloadInvoice={() => downloadInvoiceImage(o)}
              />
            ))
          )}
        </div>

        {/* Menú rápido */}
        <div className="section-title">Menú rápido</div>
        <div className="menu-grid">
          {products.map((p) => (
            <div key={p.id} className="menu-card" onClick={() => { addToCart(p); setShowNew(true); }}>
              <div className="menu-card-img">
                <img src={p.image} alt={p.name} onError={(e) => { e.target.style.display = "none"; }} />
              </div>
              <div className="menu-card-body">
                <div className="menu-card-name">{p.name}</div>
                <div className="menu-card-price">{currency(p.price)}</div>
                <button className="menu-card-action" onClick={(e) => { e.stopPropagation(); addToCart(p); setShowNew(true); }}>
                  + Agregar a orden
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* === Modal: Nueva Orden === */}
      {showNew && (
        <>
          <div className="overlay" onClick={() => setShowNew(false)} />
          <div className="modal-wrap">
            <div className="modal modal-lg">
              <div className="modal-header">
                <div className="modal-title">🛒 Nueva orden</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowNew(false)}><Icons.X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="new-order-grid">
                  {/* Left */}
                  <div className="new-order-left">
                    <div className="form-group">
                      <label className="form-label">Nombre del cliente</label>
                      <div className="input-wrap">
                        <span className="icon-left"><Icons.User size={16} /></span>
                        <input className="input" style={{ paddingLeft: 42 }} placeholder="Ej: María García" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Teléfono (opcional)</label>
                      <div className="input-wrap">
                        <span className="icon-left"><Icons.Phone size={16} /></span>
                        <input className="input" style={{ paddingLeft: 42 }} placeholder="3001234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Observaciones</label>
                      <textarea className="input" placeholder="Sin cebolla, extra salsa..." value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <div className="check-row" onClick={() => setIsPaid(!isPaid)}>
                      <div className={`check-box ${isPaid ? "checked" : ""}`}>
                        {isPaid && <Icons.CheckCircle size={14} className="check-icon" style={{ color: "white" }} />}
                      </div>
                      <span className="check-label"><Icons.Wallet size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />Ya está pagado</span>
                    </div>

                    {/* Cart */}
                    <div className="cart-box">
                      <div className="cart-box-header">
                        <div className="cart-box-title">🛍️ Carrito</div>
                        {cartItems.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clearCart}>Vaciar</button>}
                      </div>
                      {cartItems.length === 0 ? (
                        <div className="cart-empty">Ningún producto agregado aún</div>
                      ) : (
                        <>
                          {cartItems.map(({ product, qty }) => (
                            <div key={product.id} className="cart-item">
                              <span>{qty}× {product.name}</span>
                              <span style={{ fontWeight: 700, color: "var(--primary)" }}>{currency(product.price * qty)}</span>
                            </div>
                          ))}
                          <div className="cart-total-row">
                            <span>Total</span>
                            <span style={{ color: "var(--primary)" }}>{currency(cartTotal)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: productos */}
                  <div className="new-order-right">
                    <div className="input-wrap" style={{ marginBottom: 16 }}>
                      <span className="icon-left"><Icons.Search size={16} /></span>
                      <input className="input input-search" placeholder="Buscar producto..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
                    </div>
                    {CATEGORIES.map((cat) => {
                      const catProds = filteredProducts.filter((p) => p.category === cat);
                      if (!catProds.length) return null;
                      return (
                        <div key={cat}>
                          <div className="category-label">{cat}</div>
                          <div className="product-cards-grid">
                            {catProds.map((p) => (
                              <ProductCard
                                key={p.id}
                                product={p}
                                qty={cart[p.id]?.qty || 0}
                                onAdd={() => addToCart(p)}
                                onSub={() => subFromCart(p)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
                <button className="btn btn-primary" disabled={cartItems.length === 0} onClick={addOrder}>
                  Crear pedido {cartTotal > 0 ? `· ${currency(cartTotal)}` : ""}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* === Modal: Historial === */}
      {showHistory && (
        <>
          <div className="overlay" onClick={() => setShowHistory(false)} />
          <div className="modal-wrap">
            <div className="modal modal-lg">
              <div className="modal-header">
                <div className="modal-title"><Icons.History size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />Historial</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowHistory(false)}><Icons.X size={18} /></button>
              </div>
              <div className="modal-body">
                {/* Stats */}
                <div className="stats-grid" style={{ marginTop: 0, marginBottom: 16 }}>
                  <div className="stat-card"><div className="stat-label">Pedidos</div><div className="stat-value" style={{ fontSize: 20 }}>{historyTotals.count}</div></div>
                  <div className="stat-card success"><div className="stat-label">Cobrado</div><div className="stat-value" style={{ fontSize: 20 }}>{currency(historyTotals.cobrados)}</div></div>
                  <div className="stat-card warning"><div className="stat-label">Pendiente</div><div className="stat-value" style={{ fontSize: 20 }}>{currency(historyTotals.pendientes)}</div></div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
                  <div className="filter-pills">
                    {["all", "paid", "unpaid"].map((v) => (
                      <button key={v} className={`filter-pill ${histStatus === v ? "active" : ""}`} onClick={() => setHistStatus(v)}>
                        {v === "all" ? "Todos" : v === "paid" ? "Pagados" : "Pendientes"}
                      </button>
                    ))}
                  </div>
                  <input type="date" className="input" style={{ width: 170 }} value={histDate} onChange={(e) => setHistDate(e.target.value)} />
                  {histDate && <button className="btn btn-ghost btn-sm" onClick={() => setHistDate("")}>Limpiar</button>}
                  <button className="btn btn-ghost btn-sm" onClick={exportHistoryCSV}><Icons.Download size={14} /> CSV (vista)</button>
                  <button className="btn btn-ghost btn-sm" onClick={exportAllCSV}><Icons.Download size={14} /> CSV (todo)</button>
                </div>

                {/* List */}
                <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  {historyList.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>Sin resultados para los filtros seleccionados.</div>
                  ) : (
                    historyList.map((o) => {
                      const txt = o.items ? o.items.map((it) => `${it.qty}× ${it.product.name}`).join(" · ") : `${o.qty}× ${o.product?.name || ""}`;
                      return (
                        <div key={o.id + (o._day || "")} className="hist-item">
                          <div className="hist-date">{o._day || new Date(o.at).toISOString().slice(0, 10)}</div>
                          <div className="hist-info">
                            <div className="hist-name">{o.customerName || "Sin nombre"} <span style={{ fontWeight: 400, color: "var(--fg-muted)", fontSize: 12 }}>· {new Date(o.at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span></div>
                            <div className="hist-items">{txt}</div>
                            {o.phone && <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>📞 {o.phone}</div>}
                          </div>
                          <div className="hist-right">
                            <div className="hist-total">{currency(orderTotal(o))}</div>
                            <span className={`badge ${o.paid ? "badge-paid" : "badge-unpaid"}`}>{o.paid ? "Pagado" : "Pendiente"}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* === Modal: Método de Pago === */}
      {payModal.open && (
        <>
          <div className="overlay" onClick={() => setPayModal((p) => ({ ...p, open: false }))} />
          <div className="modal-wrap">
            <div className="modal" style={{ maxWidth: 480 }}>
              <div className="modal-header">
                <div className="modal-title">💳 Registrar pago</div>
                <button className="btn btn-ghost btn-icon" onClick={() => setPayModal((p) => ({ ...p, open: false }))}><Icons.X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="pay-methods">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m.id} className={`pay-method ${payModal.method === m.id ? "selected" : ""}`} onClick={() => setPayModal((p) => ({ ...p, method: m.id }))}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {payModal.method === "other" && (
                  <div style={{ marginTop: 14 }}>
                    <input className="input" placeholder="¿Qué banco o app?" value={payModal.customMethod} onChange={(e) => setPayModal((p) => ({ ...p, customMethod: e.target.value }))} />
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <input className="input" placeholder="Referencia / No. transacción (opcional)" value={payModal.ref} onChange={(e) => setPayModal((p) => ({ ...p, ref: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setPayModal((p) => ({ ...p, open: false }))}>Cancelar</button>
                <button className="btn btn-success" onClick={confirmPayment}>Confirmar pago</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Hidden receipt */}
      <div style={{ position: "fixed", left: -9999, top: 0 }}>
        {receiptOrder && (
          <div ref={receiptRef} style={{ width: 420, background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 16, color: "#0f172a", position: "relative", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
            {/* Watermark */}
            <img src="/img/logo_ss.png" alt="" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, margin: "auto", width: 360, opacity: 0.08, pointerEvents: "none", transform: "rotate(-12deg)" }} />
            {/* Header */}
            <div style={{ background: "#0f172a", color: "#fff", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>S&S Burger & Hot dogs</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Comprobante</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>{new Date(receiptOrder.at).toLocaleString()}</div>
              </div>
              <img src="/img/logo_ss.png" alt="Logo S&S" crossOrigin="anonymous" style={{ width: 56, height: 56, borderRadius: 10, background: "rgba(255,255,255,0.1)", padding: 4, objectFit: "contain" }} />
            </div>
            {/* Info */}
            <div style={{ marginTop: 16, fontSize: 13 }}>
              {[["Cliente", receiptOrder.customerName || "Sin nombre"], receiptOrder.phone && ["Teléfono", receiptOrder.phone], ["Método", prettyMethod(receiptOrder.paymentMethod)], receiptOrder.paymentRef && ["Referencia", receiptOrder.paymentRef], ["Pedido ID", receiptOrder.id]].filter(Boolean).map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                  <span style={{ color: "#64748b" }}>{label}</span>
                  <span style={{ fontWeight: 600, textAlign: "right", fontFamily: label === "Pedido ID" ? "monospace" : "inherit", fontSize: label === "Pedido ID" ? 11 : 13 }}>{value}</span>
                </div>
              ))}
            </div>
            {/* Items */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Detalle</div>
              {(receiptOrder.items || []).map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{it.qty}× {it.product.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{currency(it.product.price)} c/u</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{currency(it.product.price * it.qty)}</div>
                </div>
              ))}
            </div>
            {/* Total */}
            <div style={{ marginTop: 8, borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontWeight: 800 }}>{currency(orderTotal(receiptOrder))}</span>
            </div>
            {/* Footer */}
            <div style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
              Gracias por tu compra ❤️<br />
              Este comprobante no equivale a factura<br />
              Escribenos para mas domicilios al 3245447651 ❤️
            </div>
          </div>
        )}
      </div>

      {/* Hidden invoice */}
      <div style={{ position: "fixed", left: -9999, top: 0 }}>
        {invoiceOrder && (
          <div ref={invoiceRef} style={{ width: 420, background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 16, color: "#0f172a", position: "relative", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
            {/* Watermark */}
            <img
              src="/img/logo_ss.png"
              alt=""
              crossOrigin="anonymous"
              style={{
                position: "absolute",
                inset: 0,
                margin: "auto",
                width: 360,
                opacity: 0.08,
                pointerEvents: "none",
                transform: "rotate(-12deg)",
              }}
            />
            {/* Header */}
            <div style={{ background: "#0f172a", color: "#fff", borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>S&S Burger & Hot dogs</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>Wsapp 3245447651</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>Factura — {invoiceOrder.customerName || "Sin nombre"}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 3 }}>{new Date(invoiceOrder.at).toLocaleString()}</div>
              </div>
              <img
                src="/img/logo_ss.png"
                alt="Logo S&S"
                crossOrigin="anonymous"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.1)",
                  padding: 4,
                  objectFit: "contain",
                }}
              />
            </div>
            {/* Info */}
            <div style={{ marginTop: 16, fontSize: 13 }}>
              {[["Cliente", invoiceOrder.customerName || "Sin nombre"], invoiceOrder.phone && ["Teléfono", invoiceOrder.phone], ["Estado", invoiceOrder.paid ? "PAGADO" : "PENDIENTE"], ["Pedido ID", invoiceOrder.id]].filter(Boolean).map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                  <span style={{ color: "#64748b" }}>{label}</span>
                  <span style={{ fontWeight: 600, textAlign: "right", fontFamily: label === "Pedido ID" ? "monospace" : "inherit", fontSize: label === "Pedido ID" ? 11 : 13 }}>{value}</span>
                </div>
              ))}
            </div>
            {/* Items */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Detalle</div>
              {(invoiceOrder.items || []).map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{it.qty}× {it.product.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{currency(it.product.price)} c/u</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{currency(it.product.price * it.qty)}</div>
                </div>
              ))}
            </div>
            {/* Total */}
            <div style={{ marginTop: 8, borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontWeight: 800 }}>{currency(orderTotal(invoiceOrder))}</span>
            </div>
            {/* Footer */}
            <div style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
              Gracias por tu compra ❤️<br />
              <span style={{ color: "#64748b" }}>Esta factura es un soporte interno de venta.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}