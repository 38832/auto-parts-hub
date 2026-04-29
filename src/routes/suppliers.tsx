import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Truck, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/suppliers")({
  component: () => (
    <RequireAuth><AppShell><SuppliersPage /></AppShell></RequireAuth>
  ),
});

interface Supplier {
  id: string; name: string; contact_person: string | null; phone: string | null;
  address: string | null; gstin: string | null; payable_balance: number; notes: string | null;
}

function SuppliersPage() {
  const [list, setList] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<Supplier | null>(null);
  const [payFor, setPayFor] = useState<Supplier | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setList((data ?? []) as Supplier[]);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(c => c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s));
  }, [list, q]);

  const totalPayable = list.reduce((s, c) => s + Number(c.payable_balance ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Procurement</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">{list.length} total · <span className="text-warning font-semibold num">{inr(totalPayable)}</span> payable</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="font-semibold"><Plus className="h-4 w-4 mr-1.5" />Add Supplier</Button>
      </header>

      <div className="bg-surface rounded-md border border-border shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-11" />
        </div>
      </div>

      <div className="bg-surface rounded-md border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Truck className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <div className="font-semibold">No suppliers yet</div>
            <div className="text-sm text-muted-foreground mt-1">Add suppliers to record stock purchases.</div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(s => (
              <li key={s.id} className="px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-surface-alt">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.contact_person ?? "—"} · {s.phone ?? "—"}</div>
                </div>
                {Number(s.payable_balance) > 0 && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-warning font-semibold">Payable</div>
                    <div className="num font-semibold text-warning">{inr(s.payable_balance)}</div>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setPurchaseFor(s)}>+ Purchase</Button>
                  {Number(s.payable_balance) > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setPayFor(s)}><IndianRupee className="h-3.5 w-3.5 mr-1" />Pay</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>Edit</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SupplierForm open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { setOpen(false); void load(); }} />
      <PurchaseDialog supplier={purchaseFor} onClose={() => setPurchaseFor(null)} onSaved={() => { setPurchaseFor(null); void load(); }} />
      <SupplierPayDialog supplier={payFor} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); void load(); }} />
    </div>
  );
}

function SupplierForm({ open, onOpenChange, editing, onSaved }: any) {
  const [form, setForm] = useState({ name: "", contact_person: "", phone: "", address: "", gstin: "", notes: "" });
  useEffect(() => {
    if (open) setForm(editing ? {
      name: editing.name, contact_person: editing.contact_person ?? "", phone: editing.phone ?? "",
      address: editing.address ?? "", gstin: editing.gstin ?? "", notes: editing.notes ?? "",
    } : { name: "", contact_person: "", phone: "", address: "", gstin: "", notes: "" });
  }, [open, editing]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name required"); return; }
    let error;
    if (editing) ({ error } = await supabase.from("suppliers").update(form).eq("id", editing.id));
    else ({ error } = await supabase.from("suppliers").insert(form));
    if (error) toast.error(friendlyError(error)); else { toast.success(editing ? "Updated" : "Added"); onSaved(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact person</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="h-11" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-11 font-mono" /></div>
          </div>
          <div><Label>GSTIN</Label><Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} className="h-11 font-mono" /></div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PurchaseRow { product_id: string; part_number: string; part_name: string; quantity: number; unit_cost: number; current_stock: number; }
interface NewProductForm {
  part_number: string;
  part_name: string;
  brand: string;
  category: string;
  purchase_price: number | "";
  selling_price: number | "";
  min_stock_threshold: number | "";
}

function PurchaseDialog({ supplier, onClose, onSaved }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [orderFrequency, setOrderFrequency] = useState<Record<string, number>>({});
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItem, setNewItem] = useState<NewProductForm>({
    part_number: "",
    part_name: "",
    brand: "",
    category: "",
    purchase_price: "",
    selling_price: "",
    min_stock_threshold: 5,
  });
  const [paid, setPaid] = useState<number | "">("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (supplier) {
      void supabase.from("products").select("id, part_number, part_name, purchase_price, stock_quantity").order("part_name").then(({ data }) => setProducts(data ?? []));
      void supabase
        .from("purchase_items")
        .select("product_id,purchases!inner(supplier_id)")
        .eq("purchases.supplier_id", supplier.id)
        .then(({ data }) => {
          const counts: Record<string, number> = {};
          for (const entry of data ?? []) {
            const productId = entry.product_id as string | null;
            if (!productId) continue;
            counts[productId] = (counts[productId] ?? 0) + 1;
          }
          setOrderFrequency(counts);
        });
      setRows([]); setPaid(""); setInvoiceRef(""); setSearch("");
      setNewItemOpen(false);
      setNewItem({ part_number: "", part_name: "", brand: "", category: "", purchase_price: "", selling_price: "", min_stock_threshold: 5 });
    }
  }, [supplier]);

  const suggestions = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return [];
    return products
      .filter(p => p.part_name.toLowerCase().includes(s) || p.part_number.toLowerCase().includes(s))
      .sort((a, b) => (orderFrequency[b.id] ?? 0) - (orderFrequency[a.id] ?? 0))
      .slice(0, 6);
  }, [products, search, orderFrequency]);

  const frequentlyOrdered = useMemo(() => {
    return [...products]
      .filter((p) => (orderFrequency[p.id] ?? 0) > 0)
      .sort((a, b) => (orderFrequency[b.id] ?? 0) - (orderFrequency[a.id] ?? 0))
      .slice(0, 5);
  }, [products, orderFrequency]);

  function addRow(p: any) {
    setRows((prevRows) => {
      if (prevRows.find((r) => r.product_id === p.id)) return prevRows;
      return [...prevRows, { product_id: p.id, part_number: p.part_number, part_name: p.part_name, quantity: 1, unit_cost: Number(p.purchase_price), current_stock: p.stock_quantity }];
    });
    setSearch("");
  }

  const total = rows.reduce((s, r) => s + r.quantity * r.unit_cost, 0);

  async function save() {
    if (rows.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    const due = Math.max(0, total - Number(paid || 0));
    const { data: purchase, error } = await supabase.from("purchases").insert({
      supplier_id: supplier.id, supplier_name: supplier.name,
      invoice_ref: invoiceRef || null,
      subtotal: total, total, paid_amount: Number(paid || 0), due_amount: due,
    }).select().single();
    if (error || !purchase) { setSaving(false); toast.error(friendlyError(error, "Failed to save purchase")); return; }

    await supabase.from("purchase_items").insert(rows.map(r => ({
      purchase_id: purchase.id, product_id: r.product_id, part_number: r.part_number,
      part_name: r.part_name, quantity: r.quantity, unit_cost: r.unit_cost,
      line_total: r.quantity * r.unit_cost,
    })));

    for (const r of rows) {
      await supabase.from("products").update({ stock_quantity: r.current_stock + r.quantity, purchase_price: r.unit_cost }).eq("id", r.product_id);
      await supabase.from("stock_movements").insert({
        product_id: r.product_id, movement_type: "in", quantity: r.quantity,
        reference_type: "purchase", reference_id: purchase.id,
      });
    }

    if (due > 0) {
      await supabase.from("suppliers").update({ payable_balance: Number(supplier.payable_balance) + due }).eq("id", supplier.id);
    }
    setSaving(false);
    toast.success(`Purchase ${purchase.purchase_number} recorded`);
    onSaved();
  }

  async function createAndAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.part_number.trim() || !newItem.part_name.trim()) {
      toast.error("Part number and part name are required");
      return;
    }
    const payload = {
      part_number: newItem.part_number.trim(),
      part_name: newItem.part_name.trim(),
      brand: newItem.brand.trim() || null,
      category: newItem.category.trim() || null,
      purchase_price: Number(newItem.purchase_price || 0),
      selling_price: Number(newItem.selling_price || 0),
      min_stock_threshold: Number(newItem.min_stock_threshold || 5),
    };
    const { data, error } = await supabase.from("products").insert(payload).select("id, part_number, part_name, purchase_price, stock_quantity").single();
    if (error || !data) {
      toast.error(friendlyError(error, "Failed to create item"));
      return;
    }
    setProducts((prev) => [...prev, data]);
    addRow(data);
    setNewItemOpen(false);
    setNewItem({ part_number: "", part_name: "", brand: "", category: "", purchase_price: "", selling_price: "", min_stock_threshold: 5 });
    toast.success("New item created and added to purchase");
  }

  if (!supplier) return null;

  return (
    <Dialog open={!!supplier} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record purchase from {supplier.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search part to add…" className="pl-9 h-11" />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-20">
                {suggestions.map(p => (
                  <button key={p.id} onClick={() => addRow(p)} className="w-full px-3 py-2 text-left text-sm hover:bg-surface-alt border-b border-border last:border-0">
                    <div className="font-medium">{p.part_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.part_number} · stock {p.stock_quantity}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {frequentlyOrdered.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Frequently ordered from this supplier</div>
              <div className="flex flex-wrap gap-2">
                {frequentlyOrdered.map((p) => (
                  <Button key={p.id} type="button" size="sm" variant="outline" onClick={() => addRow(p)}>
                    {p.part_name} <span className="ml-1 text-xs text-muted-foreground">({orderFrequency[p.id]}x)</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="border border-dashed border-border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Need a new item?</div>
                <div className="text-xs text-muted-foreground">Create a SKU directly while recording this supplier order.</div>
              </div>
              <Button type="button" variant="outline" onClick={() => setNewItemOpen(v => !v)}>{newItemOpen ? "Hide" : "Add New Item"}</Button>
            </div>
            {newItemOpen && (
              <form onSubmit={createAndAddItem} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Part number *" value={newItem.part_number} onChange={e => setNewItem({ ...newItem, part_number: e.target.value })} />
                  <Input placeholder="Part name *" value={newItem.part_name} onChange={e => setNewItem({ ...newItem, part_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Brand" value={newItem.brand} onChange={e => setNewItem({ ...newItem, brand: e.target.value })} />
                  <Input placeholder="Category" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.01" placeholder="Purchase price" value={newItem.purchase_price} onChange={e => setNewItem({ ...newItem, purchase_price: e.target.value === "" ? "" : Number(e.target.value) })} />
                  <Input type="number" step="0.01" placeholder="Selling price" value={newItem.selling_price} onChange={e => setNewItem({ ...newItem, selling_price: e.target.value === "" ? "" : Number(e.target.value) })} />
                  <Input type="number" min={0} placeholder="Min stock" value={newItem.min_stock_threshold} onChange={e => setNewItem({ ...newItem, min_stock_threshold: e.target.value === "" ? "" : Number(e.target.value) })} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm">Create & Add</Button>
                </div>
              </form>
            )}
          </div>

          {rows.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-alt text-[11px] uppercase text-muted-foreground">
                  <tr><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2">Qty</th><th className="px-2 py-2">Cost ₹</th><th className="px-2 py-2 text-right">Total</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.product_id} className="border-t border-border">
                      <td className="px-2 py-2"><div className="text-sm">{r.part_name}</div><div className="text-xs text-muted-foreground font-mono">{r.part_number}</div></td>
                      <td className="px-2 py-2"><Input type="number" min={1} value={r.quantity} onChange={e => { const v = [...rows]; v[idx].quantity = Math.max(1, Number(e.target.value)); setRows(v); }} className="h-9 w-20 text-center font-mono" /></td>
                      <td className="px-2 py-2"><Input type="number" step="0.01" value={r.unit_cost} onChange={e => { const v = [...rows]; v[idx].unit_cost = Number(e.target.value); setRows(v); }} className="h-9 w-24 text-right font-mono" /></td>
                      <td className="px-2 py-2 text-right num font-medium">{inr(r.quantity * r.unit_cost)}</td>
                      <td className="px-2 py-2"><button onClick={() => setRows(rows.filter(x => x.product_id !== r.product_id))} className="text-destructive text-sm">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Supplier invoice ref</Label><Input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} className="h-11" /></div>
            <div><Label>Paid now ₹</Label><Input type="number" value={paid} onChange={e => setPaid(e.target.value === "" ? "" : Number(e.target.value))} className="h-11 font-mono" /></div>
          </div>

          <div className="bg-surface-alt rounded p-3 flex justify-between items-baseline">
            <span className="font-semibold">Total</span>
            <span className="num text-2xl font-bold text-primary">{inr(total)}</span>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || rows.length === 0}>{saving ? "Saving…" : "Record Purchase"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupplierPayDialog({ supplier, onClose, onSaved }: any) {
  const [amount, setAmount] = useState<number | "">("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter amount"); return; }
    if (amt > Number(supplier.payable_balance)) { toast.error("Cannot exceed payable"); return; }
    const newBal = Number(supplier.payable_balance) - amt;
    await supabase.from("suppliers").update({ payable_balance: newBal }).eq("id", supplier.id);
    await supabase.from("payments").insert({ party_type: "supplier", party_id: supplier.id, amount: amt, payment_mode: "cash" });
    toast.success(`Paid ${inr(amt)} to ${supplier.name}`);
    onSaved();
  }

  return (
    <Dialog open={!!supplier} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Pay {supplier?.name}</DialogTitle></DialogHeader>
        {supplier && (
          <form onSubmit={save} className="space-y-3">
            <div className="bg-surface-alt rounded p-3 flex justify-between text-sm">
              <span>Payable</span><span className="num font-bold text-warning">{inr(supplier.payable_balance)}</span>
            </div>
            <div><Label>Amount ₹</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : Number(e.target.value))} className="h-11 font-mono text-lg" autoFocus /></div>
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
