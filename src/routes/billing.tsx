import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr } from "@/lib/format";
import { Search, Plus, Trash2, Receipt, User } from "lucide-react";
import { toast } from "sonner";
import { generateInvoicePDF, shareViaWhatsApp } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/billing")({
  component: () => (
    <RequireAuth><AppShell><BillingPage /></AppShell></RequireAuth>
  ),
});

interface Product {
  id: string; part_number: string; part_name: string; selling_price: number;
  stock_quantity: number; gst_rate: number; unit: string; vehicle_compatibility: string[];
  brand: string | null; category: string | null;
}
interface Customer { id: string; name: string; phone: string | null; gstin: string | null; }
interface CartItem {
  product_id: string; part_number: string; part_name: string;
  quantity: number; unit_price: number; gst_rate: number; max_stock: number;
  brand: string | null; vehicles: string[]; category: string | null;
}

function BillingPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "credit">("cash");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => { void load(); }, []);
  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("products").select("id, part_number, part_name, selling_price, stock_quantity, gst_rate, unit, vehicle_compatibility, brand, category").order("part_name"),
      supabase.from("customers").select("id, name, phone, gstin").order("name"),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setCustomers((c.data ?? []) as Customer[]);
  }

  const suggestions = useMemo(() => {
    const raw = search.trim().toLowerCase();
    if (!raw) return [];
    const tokens = raw.split(/\s+/).filter(Boolean);

    const scoreProduct = (p: Product): number => {
      const name = p.part_name.toLowerCase();
      const num = p.part_number.toLowerCase();
      const brand = (p.brand ?? "").toLowerCase();
      const cat = (p.category ?? "").toLowerCase();
      const vehicles = p.vehicle_compatibility.map(v => v.toLowerCase());
      const haystack = [name, num, brand, cat, ...vehicles].join(" | ");

      let score = 0;
      for (const t of tokens) {
        let tokenScore = 0;
        if (num === t) tokenScore = 1000;
        else if (num.startsWith(t)) tokenScore = 600;
        else if (num.includes(t)) tokenScore = 300;
        else if (name.startsWith(t)) tokenScore = 500;
        else if (name.split(/\s+/).some(w => w.startsWith(t))) tokenScore = 400;
        else if (name.includes(t)) tokenScore = 250;
        else if (brand.startsWith(t)) tokenScore = 200;
        else if (vehicles.some(v => v === t)) tokenScore = 350;
        else if (vehicles.some(v => v.includes(t))) tokenScore = 180;
        else if (cat.includes(t)) tokenScore = 120;
        else if (haystack.includes(t)) tokenScore = 60;
        else return -1; // every token must match somewhere
        score += tokenScore;
      }
      // Tiny boosts: in-stock first, shorter names rank slightly higher
      if (p.stock_quantity > 0) score += 20;
      score -= Math.min(20, Math.floor(name.length / 4));
      return score;
    };

    return products
      .map(p => ({ p, s: scoreProduct(p) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map(x => x.p);
  }, [products, search]);

  // Reset highlight when query changes
  useEffect(() => { setActiveIdx(0); }, [search]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 10);
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)
    ).slice(0, 10);
  }, [customers, customerQuery]);

  function addToCart(p: Product) {
    if (p.stock_quantity <= 0) { toast.error(`${p.part_name} is out of stock`); return; }
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) {
        if (existing.quantity >= p.stock_quantity) {
          toast.error(`Only ${p.stock_quantity} in stock`);
          return prev;
        }
        return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: p.id, part_number: p.part_number, part_name: p.part_name,
        quantity: 1, unit_price: Number(p.selling_price), gst_rate: Number(p.gst_rate),
        max_stock: p.stock_quantity,
        brand: p.brand, vehicles: p.vehicle_compatibility ?? [],
        category: p.category,
      }];
    });
    setSearch("");
  }

  function updateQty(id: string, qty: number) {
    setCart(prev => prev.map(i => {
      if (i.product_id !== id) return i;
      const q = Math.max(1, Math.min(qty, i.max_stock));
      return { ...i, quantity: q };
    }));
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i.product_id !== id));
  }

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const gstAmount = cart.reduce((s, i) => s + (i.quantity * i.unit_price * i.gst_rate / 100), 0);
    const afterDiscount = subtotal - Number(discount || 0);
    const total = Math.max(0, afterDiscount + gstAmount);
    return { subtotal, gstAmount, total };
  }, [cart, discount]);

  async function handleCheckout() {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    setSaving(true);

    const customerId = customer?.id ?? null;
    const customerName = customer?.name ?? walkInName.trim() ?? "Walk-in";
    const customerPhone = customer?.phone ?? walkInPhone.trim() ?? null;
    const customerGstin = customer?.gstin ?? null;

    const paid = paymentMode === "credit" ? Number(paidAmount || 0) : totals.total;
    const credit = Math.max(0, totals.total - paid);

    const { data: invoice, error: invErr } = await supabase.from("invoices").insert({
      customer_id: customerId,
      customer_name: customerName || "Walk-in",
      customer_phone: customerPhone,
      customer_gstin: customerGstin,
      subtotal: totals.subtotal,
      discount: Number(discount || 0),
      gst_amount: totals.gstAmount,
      total: totals.total,
      paid_amount: paid,
      credit_amount: credit,
      payment_mode: paymentMode,
      notes: notes || null,
    }).select().single();

    if (invErr || !invoice) { setSaving(false); toast.error(friendlyError(invErr, "Failed to create invoice")); return; }

    // insert items
    const itemsPayload = cart.map(i => ({
      invoice_id: invoice.id, product_id: i.product_id,
      part_number: i.part_number, part_name: i.part_name,
      quantity: i.quantity, unit_price: i.unit_price,
      gst_rate: i.gst_rate, line_total: i.quantity * i.unit_price,
    }));
    await supabase.from("invoice_items").insert(itemsPayload);

    // deduct stock + record movements
    for (const i of cart) {
      const newStock = i.max_stock - i.quantity;
      await supabase.from("products").update({ stock_quantity: newStock }).eq("id", i.product_id);
      await supabase.from("stock_movements").insert({
        product_id: i.product_id, movement_type: "out", quantity: i.quantity,
        reference_type: "invoice", reference_id: invoice.id,
      });
    }

    // update customer credit
    if (credit > 0 && customerId) {
      const cust = customers.find(c => c.id === customerId);
      const newBalance = Number((cust as any)?.credit_balance ?? 0) + credit;
      await supabase.from("customers").update({ credit_balance: newBalance }).eq("id", customerId);
    }

    setSaving(false);
    toast.success(`Invoice ${invoice.invoice_number} created`);
    navigate({ to: "/invoices/$id", params: { id: invoice.id } });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Counter</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">New Invoice</h1>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT: Search + Cart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface rounded-md border border-border shadow-sm p-4 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (suggestions.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIdx(i => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const pick = suggestions[activeIdx];
                    if (pick) addToCart(pick);
                  } else if (e.key === "Escape") {
                    setSearch("");
                  }
                }}
                placeholder="Search part name, number, brand or vehicle…"
                className="pl-9 h-12 text-base"
                autoFocus
              />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-20 overflow-hidden">
                {suggestions.map((p, idx) => (
                  <button
                    key={p.id}
                    onMouseDown={e => { e.preventDefault(); addToCart(p); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    disabled={p.stock_quantity === 0}
                    className={`w-full px-4 py-2.5 flex justify-between items-center text-left disabled:opacity-50 ${idx === activeIdx ? "bg-surface-alt" : "hover:bg-surface-alt"}`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {p.part_name}
                        {p.category ? <span className="text-muted-foreground font-normal"> — {p.category}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {p.part_number}
                        {p.brand ? ` · ${p.brand}` : ""}
                        {p.vehicle_compatibility.length > 0 ? ` · ${p.vehicle_compatibility.slice(0, 2).join(", ")}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="num font-semibold text-sm">{inr(p.selling_price)}</div>
                      <div className={`text-xs ${p.stock_quantity === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {p.stock_quantity} {p.unit}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {search && suggestions.length === 0 && (
              <div className="absolute left-4 right-4 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-20 px-4 py-3 text-sm text-muted-foreground">
                No parts match "{search}". Try a different name or vehicle.
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-surface rounded-md border border-border shadow-sm overflow-hidden">
            <header className="px-4 py-3 border-b border-border flex justify-between items-center">
              <h2 className="font-semibold tracking-tight">Cart ({cart.length})</h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:text-destructive">Clear all</button>
              )}
            </header>
            {cart.length === 0 ? (
              <div className="px-4 py-12 text-center text-muted-foreground text-sm">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Search above to add parts to the bill.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {cart.map(i => (
                  <li key={i.product_id} className="px-4 py-3 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 md:col-span-5 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {i.part_name}
                        {i.category ? <span className="text-muted-foreground font-normal"> — {i.category}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        <span className="font-mono">{i.part_number}</span>
                        {i.brand ? ` · ${i.brand}` : ""}
                        {i.vehicles.length > 0 ? ` · fits ${i.vehicles.join(", ")}` : ""}
                      </div>
                    </div>
                    <div className="col-span-4 md:col-span-2 flex items-center">
                      <Input
                        type="number" min={1} max={i.max_stock} value={i.quantity}
                        onChange={e => updateQty(i.product_id, Number(e.target.value))}
                        className="h-9 text-center font-mono"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-2 text-right num text-sm">{inr(i.unit_price)}</div>
                    <div className="col-span-4 md:col-span-2 text-right num font-semibold text-sm">{inr(i.quantity * i.unit_price)}</div>
                    <div className="col-span-1 text-right">
                      <button onClick={() => removeItem(i.product_id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT: Customer + Totals + Pay */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="bg-surface rounded-md border border-border shadow-sm p-4 space-y-3">
            <h2 className="font-semibold tracking-tight flex items-center gap-2"><User className="h-4 w-4" />Customer</h2>
            {customer ? (
              <div className="bg-surface-alt rounded p-3">
                <div className="font-medium">{customer.name}</div>
                <div className="text-xs text-muted-foreground">{customer.phone ?? "—"}</div>
                <button onClick={() => setCustomer(null)} className="text-xs text-primary hover:text-primary-hover mt-2">Change</button>
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowCustomerPicker(!showCustomerPicker)} className="w-full">
                  {showCustomerPicker ? "Hide list" : "Pick existing customer"}
                </Button>
                {showCustomerPicker && (
                  <div className="space-y-2">
                    <Input placeholder="Search…" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} className="h-9" />
                    <div className="max-h-40 overflow-y-auto border border-border rounded">
                      {filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => { setCustomer(c); setShowCustomerPicker(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-surface-alt border-b border-border last:border-0">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone ?? "—"}</div>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="px-3 py-3 text-xs text-muted-foreground">No matches</div>
                      )}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Or walk-in</div>
                  <Input placeholder="Name (optional)" value={walkInName} onChange={e => setWalkInName(e.target.value)} className="h-9" />
                  <Input placeholder="Phone (optional)" value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} className="h-9" />
                </div>
              </>
            )}
          </div>

          {/* Totals */}
          <div className="bg-surface rounded-md border border-border shadow-sm p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="num">{inr(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm gap-3">
              <Label className="text-muted-foreground shrink-0">Discount ₹</Label>
              <Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} className="h-9 w-28 text-right font-mono" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST</span>
              <span className="num">{inr(totals.gstAmount)}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between items-baseline">
              <span className="font-semibold text-sm">TOTAL</span>
              <span className="num text-2xl font-bold text-primary">{inr(totals.total)}</span>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit (Udhaar)</SelectItem>
                </SelectContent>
              </Select>
              {paymentMode === "credit" && (
                <>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Paid now ₹</Label>
                  <Input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" className="h-11 font-mono" />
                  {!customer && (
                    <p className="text-xs text-warning">⚠ Pick a customer to track credit balance.</p>
                  )}
                </>
              )}
              <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-sm" />
            </div>

            <Button
              onClick={handleCheckout} disabled={saving || cart.length === 0}
              className="w-full h-12 text-base font-semibold"
            >
              {saving ? "Generating…" : `Generate Invoice · ${inr(totals.total)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
