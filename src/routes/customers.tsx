import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Users, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  component: () => (
    <RequireAuth><AppShell><CustomersPage /></AppShell></RequireAuth>
  ),
});

interface Customer {
  id: string; name: string; phone: string | null; address: string | null;
  gstin: string | null; credit_balance: number; notes: string | null;
}

function CustomersPage() {
  const [list, setList] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [payOpen, setPayOpen] = useState<Customer | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await supabase.from("customers").select("*").order("name");
    setList((data ?? []) as Customer[]);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(c => c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s));
  }, [list, q]);

  const totalCredit = list.reduce((s, c) => s + Number(c.credit_balance ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">CRM</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">{list.length} total · <span className="text-warning font-semibold num">{inr(totalCredit)}</span> in credit</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="font-semibold"><Plus className="h-4 w-4 mr-1.5" />Add Customer</Button>
      </header>

      <div className="bg-surface rounded-md border border-border shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or phone…" className="pl-9 h-11" />
        </div>
      </div>

      <div className="bg-surface rounded-md border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <div className="font-semibold">No customers yet</div>
            <div className="text-sm text-muted-foreground mt-1">Add a customer to start tracking sales and credit.</div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(c => (
              <li key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-surface-alt">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.phone ?? "—"} {c.gstin && `· GSTIN ${c.gstin}`}
                  </div>
                </div>
                {Number(c.credit_balance) > 0 && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-warning font-semibold">Credit Due</div>
                    <div className="num font-semibold text-warning">{inr(c.credit_balance)}</div>
                  </div>
                )}
                <div className="flex gap-1.5">
                  {Number(c.credit_balance) > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setPayOpen(c)}>
                      <IndianRupee className="h-3.5 w-3.5 mr-1" />Receive
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>Edit</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CustomerForm open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { setOpen(false); void load(); }} />
      <PaymentDialog customer={payOpen} onClose={() => setPayOpen(null)} onSaved={() => { setPayOpen(null); void load(); }} />
    </div>
  );
}

function CustomerForm({ open, onOpenChange, editing, onSaved }: any) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", gstin: "", notes: "" });
  useEffect(() => {
    if (open) setForm(editing ? { name: editing.name, phone: editing.phone ?? "", address: editing.address ?? "", gstin: editing.gstin ?? "", notes: editing.notes ?? "" } : { name: "", phone: "", address: "", gstin: "", notes: "" });
  }, [open, editing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name required"); return; }
    let error;
    if (editing) ({ error } = await supabase.from("customers").update(form).eq("id", editing.id));
    else ({ error } = await supabase.from("customers").insert(form));
    if (error) toast.error(error.message); else { toast.success(editing ? "Updated" : "Added"); onSaved(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-11 font-mono" /></div>
            <div><Label>GSTIN</Label><Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} className="h-11 font-mono" /></div>
          </div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ customer, onClose, onSaved }: any) {
  const [amount, setAmount] = useState<number | "">("");
  const [mode, setMode] = useState("cash");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter amount"); return; }
    if (amt > Number(customer.credit_balance)) { toast.error("Cannot exceed credit balance"); return; }
    const newBal = Number(customer.credit_balance) - amt;
    const { error: e1 } = await supabase.from("customers").update({ credit_balance: newBal }).eq("id", customer.id);
    const { error: e2 } = await supabase.from("payments").insert({ party_type: "customer", party_id: customer.id, amount: amt, payment_mode: mode as any });
    if (e1 || e2) toast.error((e1 || e2)!.message);
    else { toast.success(`Received ${inr(amt)}`); setAmount(""); onSaved(); }
  }

  return (
    <Dialog open={!!customer} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Receive payment from {customer?.name}</DialogTitle></DialogHeader>
        {customer && (
          <form onSubmit={save} className="space-y-3">
            <div className="bg-surface-alt rounded p-3 flex justify-between text-sm">
              <span>Outstanding</span>
              <span className="num font-bold text-warning">{inr(customer.credit_balance)}</span>
            </div>
            <div><Label>Amount ₹</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))} className="h-11 font-mono text-lg" autoFocus /></div>
            <div><Label>Mode</Label>
              <select value={mode} onChange={e => setMode(e.target.value)} className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm">
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">Record Payment</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
