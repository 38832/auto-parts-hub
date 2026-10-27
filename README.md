# SparePilot — Auto Parts Hub

A modern workshop and spare-parts management application for automotive businesses. The app helps shops manage inventory, track customer credit, create GST invoices, monitor stock alerts, and handle supplier and billing workflows from a single dashboard.

## Overview

SparePilot is built as a TypeScript React application with Supabase for persistence and TanStack Router for navigation. It is designed for workshop owners and counter staff who need a fast and organized way to:

- Track spare parts inventory
- Create and manage invoices
- Search parts by name, part number, brand, or vehicle compatibility
- Monitor low-stock conditions
- Maintain customer credit balances
- Manage suppliers and purchase-related workflows
- View a live business dashboard with sales and stock summaries

## Features

- Dashboard with KPI summary cards
- Inventory catalog with search, filtering, and low-stock alerts
- New invoice workflow with cart, customer selection, payment mode, and discount handling
- Invoice detail view and generated billing data
- Customer management and outstanding credit tracking
- Supplier management
- Product and stock movement tracking
- Authentication and protected routes
- Responsive UI optimized for desktop and mobile use

## Tech Stack

- React 19
- Vite
- TypeScript
- TanStack Router
- Tailwind CSS
- Supabase
- Radix UI components
- Recharts / UI components for analytics-style views
- Cloudflare integration support via Vite/Workers config

## Project Structure

```text
.
├── src
│   ├── components
│   │   ├── AppShell.tsx
│   │   ├── RequireAuth.tsx
│   │   └── ui
│   ├── integrations
│   │   └── supabase
│   ├── lib
│   ├── routes
│   │   ├── __root.tsx
│   │   ├── auth.tsx
│   │   ├── billing.tsx
│   │   ├── customers.tsx
│   │   ├── dashboard.tsx
│   │   ├── inventory.tsx
│   │   ├── invoices.$id.tsx
│   │   ├── invoices.index.tsx
│   │   ├── suppliers.tsx
│   │   └── index.tsx
│   ├── router.tsx
│   ├── routeTree.gen.ts
│   ├── styles.css
│   └── ...
├── supabase
│   ├── config.toml
│   └── migrations
├── .env
├── .npmrc
├── bunfig.toml
├── components.json
├── eslint.config.js
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc
└── ...
