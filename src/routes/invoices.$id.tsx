import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Download, Share2, Printer, IndianRupee } from "lucide-react";
import { format } from "date-fns";
import { generateInvoicePDF, shareViaWhatsApp } from "@/lib/invoice-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/$id")({
  component: () => (
    <RequireAuth><AppShell><InvoiceDetail /></AppShell></RequireAuth>
  ),
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [shopName, setShopName] = useState<string>("SparePilot Shop");
  const [payOpen, setPayOpen] = useState(false);

  async function load() {
    const [{ data: i }, { data: it }, { data: profile }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id),
      supabase.from("profiles").select("shop_name").maybeSingle(),
    ]);
    setInv(i);
    setItems(it ?? []);
    if (profile?.shop_name) setShopName(profile.shop_name);
  }

  useEffect(() => { void load(); }, [id]);

  function buildData() {
    return { ...inv, shop_name: shopName, items };
  }

  function handleDownload() {
    if (!inv) return;
    const doc = generateInvoicePDF(buildData());
    doc.save(`${inv.invoice_number}.pdf`);
  }
  function handlePrint() {
    if (!inv) return;
    const doc = generateInvoicePDF(buildData());
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  }
  function handleWhatsApp() {
    if (!inv) return;
    if (!inv.customer_phone) toast.info("No customer phone — opening generic share");
    shareViaWhatsApp(buildData());
  }

  if (!inv) return <div className="text-muted-foreground">Loading invoice…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/invoices" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> All invoices
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}><Download className="h-4 w-4 mr-1" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button size="sm" onClick={handleWhatsApp}><Share2 className="h-4 w-4 mr-1" /> WhatsApp</Button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-md shadow-sm overflow-hidden">
        <div className="bg-sidebar text-sidebar-foreground p-6 flex justify-between items-start">
          <div>
            <div className="text-primary text-xs uppercase tracking-[0.2em] font-semibold">Tax Invoice</div>
            <h1 className="text-2xl font-bold mt-1">{shopName}</h1>
          </div>
          <div className="text-right">
            <div className="font-mono font-semibold">{inv.invoice_number}</div>
            <div className="text-xs text-sidebar-foreground/70 mt-1">{format(new Date(inv.created_at), "dd MMM yyyy, h:mm a")}</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Bill To</div>
            <div className="font-semibold mt-1">{inv.customer_name || "Walk-in Customer"}</div>
            {inv.customer_phone && <div className="text-sm text-muted-foreground">{inv.customer_phone}</div>}
            {inv.customer_gstin && <div className="text-xs text-muted-foreground font-mono">GSTIN: {inv.customer_gstin}</div>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded">
              <thead className="bg-surface-alt">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Part #</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">GST</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{it.part_number}</td>
                    <td className="px-3 py-2">{it.part_name}</td>
                    <td className="px-3 py-2 text-right num">{it.quantity}</td>
                    <td className="px-3 py-2 text-right num">{inr(it.unit_price)}</td>
                    <td className="px-3 py-2 text-right num">{it.gst_rate}%</td>
                    <td className="px-3 py-2 text-right num font-medium">{inr(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <Row label="Subtotal" value={inr(inv.subtotal)} />
              {inv.discount > 0 && <Row label="Discount" value={`- ${inr(inv.discount)}`} />}
              <Row label="GST" value={inr(inv.gst_amount)} />
              <div className="border-t border-border pt-2 flex justify-between items-baseline">
                <span className="font-semibold">TOTAL</span>
                <span className="num text-2xl font-bold text-primary">{inr(inv.total)}</span>
              </div>
              <Row label={`Paid (${inv.payment_mode})`} value={inr(inv.paid_amount)} />
              {inv.credit_amount > 0 ? (
                <>
                  <div className="flex justify-between text-warning font-semibold">
                    <span>Credit Due</span><span className="num">{inr(inv.credit_amount)}</span>
                  </div>
                  <Button size="sm" className="w-full mt-2" onClick={() => setPayOpen(true)}>
                    <IndianRupee className="h-3.5 w-3.5 mr-1" /> Receive Payment
                  </Button>
                </>
              ) : Number(inv.paid_amount) >= Number(inv.total) && (
                <div className="flex justify-between text-success font-semibold">
                  <span>Status</span><span>PAID</span>
                </div>
              )}
            </div>
          </div>

          {inv.notes && <div className="text-sm text-muted-foreground border-t border-border pt-4">📝 {inv.notes}</div>}
        </div>
      </div>

      <SettleDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        inv={inv}
        onSaved={() => { setPayOpen(false); void load(); }}
      />
    </div>
  );
}

function SettleDialog({ open, onOpenChange, inv, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; inv: any; onSaved: () => void }) {
  const [amount, setAmount] = useState<number | "">("");
  const [mode, setMode] = useState("cash");

  useEffect(() => { if (open) { setAmount(Number(inv?.credit_amount ?? 0)); setMode("cash"); } }, [open, inv]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter amount"); return; }
    if (amt > Number(inv.credit_amount)) { toast.error("Cannot exceed credit due"); return; }

    const newPaid = Number(inv.paid_amount) + amt;
    const newCredit = Number(inv.credit_amount) - amt;

    const { error: e1 } = await supabase.from("invoices")
      .update({ paid_amount: newPaid, credit_amount: newCredit })
      .eq("id", inv.id);

    let e2: any = null;
    if (inv.customer_id) {
      const { data: c } = await supabase.from("customers").select("credit_balance").eq("id", inv.customer_id).maybeSingle();
      if (c) {
        const newBal = Math.max(0, Number(c.credit_balance) - amt);
        ({ error: e2 } = await supabase.from("customers").update({ credit_balance: newBal }).eq("id", inv.customer_id));
      }
    }

    const { error: e3 } = await supabase.from("payments").insert({
      party_type: "customer",
      party_id: inv.customer_id ?? inv.id,
      amount: amt,
      payment_mode: mode as any,
      notes: `Settlement for ${inv.invoice_number}`,
    });

    if (e1 || e2 || e3) toast.error(friendlyError(e1 || e2 || e3));
    else { toast.success(`Received ${inr(amt)}`); onSaved(); }
  }

  if (!inv) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Receive payment for {inv.invoice_number}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="bg-surface-alt rounded p-3 flex justify-between text-sm">
            <span>Credit Due</span>
            <span className="num font-bold text-warning">{inr(inv.credit_amount)}</span>
          </div>
          <div><Label>Amount ₹</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))} className="h-11 font-mono text-lg" autoFocus /></div>
          <div><Label>Mode</Label>
            <select value={mode} onChange={e => setMode(e.target.value)} className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm">
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Record Payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
