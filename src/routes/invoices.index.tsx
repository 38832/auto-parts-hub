import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Receipt, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/invoices/")({
  component: () => (
    <RequireAuth><AppShell><InvoicesList /></AppShell></RequireAuth>
  ),
});

function InvoicesList() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(500);
      setList(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(i =>
      i.invoice_number.toLowerCase().includes(s) ||
      (i.customer_name ?? "").toLowerCase().includes(s) ||
      (i.customer_phone ?? "").includes(s),
    );
  }, [list, q]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">History</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Invoices</h1>
        </div>
        <Button asChild><Link to="/billing"><Receipt className="h-4 w-4 mr-1.5" />New Invoice</Link></Button>
      </header>

      <div className="bg-surface border border-border rounded-md shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice #, customer name, phone…" className="pl-9 h-11" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-md shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Receipt className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <div className="font-semibold">No invoices yet</div>
            <div className="text-sm text-muted-foreground mt-1">Create your first invoice from the billing screen.</div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(inv => (
              <li key={inv.id}>
                <Link to="/invoices/$id" params={{ id: inv.id }} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-alt">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{inv.payment_mode}</span>
                      {inv.credit_amount > 0 && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/15 text-warning">credit {inr(inv.credit_amount)}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{inv.customer_name ?? "Walk-in"} · {format(new Date(inv.created_at), "dd MMM yyyy, h:mm a")}</div>
                  </div>
                  <div className="text-right num font-semibold">{inr(inv.total)}</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
