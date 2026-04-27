import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr, num } from "@/lib/format";
import {
  Receipt, Package, Users, AlertTriangle, IndianRupee,
  TrendingUp, ArrowRight, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <DashboardPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Stats {
  todayRevenue: number;
  todayInvoices: number;
  totalProducts: number;
  lowStockCount: number;
  totalCredit: number;
  totalCustomers: number;
  recentInvoices: Array<{ id: string; invoice_number: string; total: number; customer_name: string | null; created_at: string }>;
  lowStock: Array<{ id: string; part_name: string; part_number: string; stock_quantity: number; min_stock_threshold: number }>;
}

function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [invToday, products, lowStock, customers, recentInv] = await Promise.all([
      supabase.from("invoices").select("total").gte("created_at", today.toISOString()),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id, part_name, part_number, stock_quantity, min_stock_threshold").order("stock_quantity", { ascending: true }).limit(20),
      supabase.from("customers").select("id, credit_balance"),
      supabase.from("invoices").select("id, invoice_number, total, customer_name, created_at").order("created_at", { ascending: false }).limit(6),
    ]);

    const lowStockList = (lowStock.data ?? []).filter(p => p.stock_quantity <= p.min_stock_threshold);
    const totalCredit = (customers.data ?? []).reduce((s, c) => s + Number(c.credit_balance ?? 0), 0);
    const todayRevenue = (invToday.data ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);

    setStats({
      todayRevenue,
      todayInvoices: invToday.data?.length ?? 0,
      totalProducts: products.count ?? 0,
      lowStockCount: lowStockList.length,
      totalCredit,
      totalCustomers: customers.data?.length ?? 0,
      recentInvoices: recentInv.data ?? [],
      lowStock: lowStockList.slice(0, 6),
    });
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            {format(new Date(), "EEEE, dd MMM yyyy")}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/inventory">Manage stock</Link>
          </Button>
          <Button asChild className="font-semibold">
            <Link to="/billing"><Receipt className="h-4 w-4 mr-1.5" />New Invoice</Link>
          </Button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi
          label="Today's Sales"
          value={inr(stats?.todayRevenue ?? 0)}
          sub={`${stats?.todayInvoices ?? 0} invoices`}
          icon={<IndianRupee className="h-4 w-4" />}
          accent
        />
        <Kpi
          label="Outstanding Credit"
          value={inr(stats?.totalCredit ?? 0)}
          sub="across customers"
          icon={<TrendingUp className="h-4 w-4" />}
          warn={(stats?.totalCredit ?? 0) > 0}
        />
        <Kpi
          label="Inventory"
          value={num(stats?.totalProducts ?? 0)}
          sub="parts catalogued"
          icon={<Package className="h-4 w-4" />}
        />
        <Kpi
          label="Low Stock"
          value={num(stats?.lowStockCount ?? 0)}
          sub="needs reorder"
          icon={<AlertTriangle className="h-4 w-4" />}
          alert={(stats?.lowStockCount ?? 0) > 0}
        />
      </div>

      {/* Two-column */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Low stock */}
        <section className="lg:col-span-2 bg-surface rounded-md border border-border shadow-sm">
          <header className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold tracking-tight">Low stock alerts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Reorder before you run out.</p>
            </div>
            <Link to="/inventory" className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <ul className="divide-y divide-border">
            {stats?.lowStock.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">All stock levels healthy.</li>
            )}
            {stats?.lowStock.map((p) => (
              <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.part_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.part_number}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold num ${p.stock_quantity === 0 ? "text-destructive" : "text-warning"}`}>
                    {p.stock_quantity} / {p.min_stock_threshold}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">stock</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent invoices */}
        <section className="lg:col-span-3 bg-surface rounded-md border border-border shadow-sm">
          <header className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold tracking-tight">Recent invoices</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Last 6 transactions.</p>
            </div>
            <Link to="/invoices" className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          <ul className="divide-y divide-border">
            {stats?.recentInvoices.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">No invoices yet — create your first one.</li>
            )}
            {stats?.recentInvoices.map((inv) => (
              <li key={inv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-medium">{inv.invoice_number}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {inv.customer_name ?? "Walk-in"} · {format(new Date(inv.created_at), "dd MMM, h:mm a")}
                  </div>
                </div>
                <div className="text-right num font-semibold">{inr(inv.total)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink to="/customers" icon={<Users className="h-5 w-5" />} label="Customers" sub={`${stats?.totalCustomers ?? 0} total`} />
        <QuickLink to="/suppliers" icon={<Truck className="h-5 w-5" />} label="Suppliers" sub="Manage purchases" />
        <QuickLink to="/inventory" icon={<Package className="h-5 w-5" />} label="Add Part" sub="New SKU" />
        <QuickLink to="/billing" icon={<Receipt className="h-5 w-5" />} label="New Bill" sub="Quick checkout" />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, icon, accent, alert, warn }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  accent?: boolean; alert?: boolean; warn?: boolean;
}) {
  return (
    <div className={`bg-surface rounded-md border p-4 md:p-5 shadow-sm transition-shadow hover:shadow-md ${
      alert ? "border-destructive/30" : warn ? "border-warning/30" : "border-border"
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">{label}</span>
        <span className={`h-7 w-7 rounded-md flex items-center justify-center ${
          accent ? "bg-primary/15 text-primary"
            : alert ? "bg-destructive/10 text-destructive"
            : warn ? "bg-warning/10 text-warning"
            : "bg-surface-alt text-muted-foreground"
        }`}>{icon}</span>
      </div>
      <div className="mt-3 text-2xl md:text-3xl font-bold num tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function QuickLink({ to, icon, label, sub }: { to: string; icon: React.ReactNode; label: string; sub: string }) {
  return (
    <Link
      to={to}
      className="group bg-surface rounded-md border border-border p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex items-center gap-3"
    >
      <span className="h-10 w-10 rounded-md bg-surface-alt flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{sub}</div>
      </div>
    </Link>
  );
}
