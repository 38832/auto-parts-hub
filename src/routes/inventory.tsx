import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { inr, num } from "@/lib/format";
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inventory")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <InventoryPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Product {
  id: string;
  part_number: string;
  part_name: string;
  brand: string | null;
  category: string | null;
  vehicle_compatibility: string[];
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_threshold: number;
  gst_rate: number;
  unit: string;
  barcode: string | null;
  notes: string | null;
}

const blank: Omit<Product, "id"> = {
  part_number: "", part_name: "", brand: "", category: "",
  vehicle_compatibility: [], purchase_price: 0, selling_price: 0,
  stock_quantity: 0, min_stock_threshold: 5, gst_rate: 18, unit: "pcs",
  barcode: "", notes: "",
};

function InventoryPage() {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [showLow, setShowLow] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products").select("*").order("part_name");
    if (error) toast.error(error.message);
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const v = vehicleFilter.trim().toLowerCase();
    return products.filter(p => {
      if (showLow && p.stock_quantity > p.min_stock_threshold) return false;
      if (v && !p.vehicle_compatibility.some(x => x.toLowerCase().includes(v))) return false;
      if (!q) return true;
      return (
        p.part_name.toLowerCase().includes(q) ||
        p.part_number.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        p.vehicle_compatibility.some(x => x.toLowerCase().includes(q))
      );
    });
  }, [products, query, vehicleFilter, showLow]);

  async function handleDelete(p: Product) {
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Deleted ${p.part_name}`);
      setProducts(prev => prev.filter(x => x.id !== p.id));
    }
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">Catalog</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">{num(products.length)} parts · {num(products.filter(p => p.stock_quantity <= p.min_stock_threshold).length)} low</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenForm(true); }} className="font-semibold">
          <Plus className="h-4 w-4 mr-1.5" /> Add Part
        </Button>
      </header>

      {/* Filters */}
      <div className="bg-surface rounded-md border border-border shadow-sm p-3 md:p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, part #, brand, vehicle…"
            className="pl-9 h-11"
          />
        </div>
        <Input
          value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
          placeholder="Vehicle e.g. Swift"
          className="h-11 w-full md:w-48"
        />
        <Button
          type="button" variant={showLow ? "default" : "outline"}
          onClick={() => setShowLow(!showLow)} className="h-11"
        >
          <AlertTriangle className="h-4 w-4 mr-1.5" /> Low stock only
        </Button>
      </div>

      {/* Table (desktop) */}
      <div className="hidden md:block bg-surface rounded-md border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt border-b border-border">
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Part #</th>
                <th className="px-4 py-3 font-semibold">Name & Brand</th>
                <th className="px-4 py-3 font-semibold">Vehicles</th>
                <th className="px-4 py-3 font-semibold text-right">Price</th>
                <th className="px-4 py-3 font-semibold text-right">Stock</th>
                <th className="px-4 py-3 font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <div className="font-semibold">No parts found</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {products.length === 0 ? "Add your first spare part to get started." : "Try a different search."}
                  </div>
                </td></tr>
              )}
              {filtered.map(p => {
                const low = p.stock_quantity <= p.min_stock_threshold;
                const out = p.stock_quantity === 0;
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-surface-alt transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{p.part_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.part_name}</div>
                      <div className="text-xs text-muted-foreground">{p.brand ?? "—"} · {p.category ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.vehicle_compatibility.length === 0 ? "—" : p.vehicle_compatibility.slice(0, 3).join(", ")}
                      {p.vehicle_compatibility.length > 3 && ` +${p.vehicle_compatibility.length - 3}`}
                    </td>
                    <td className="px-4 py-3 text-right num font-medium">{inr(p.selling_price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold num ${
                        out ? "bg-destructive/10 text-destructive" : low ? "bg-warning/10 text-warning" : "text-foreground"
                      }`}>
                        {p.stock_quantity} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(p); setOpenForm(true); }} className="p-1.5 rounded hover:bg-surface-alt" aria-label="Edit">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {role === "admin" && (
                          <button onClick={() => setConfirmDelete(p)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-2">
        {filtered.map(p => {
          const low = p.stock_quantity <= p.min_stock_threshold;
          const out = p.stock_quantity === 0;
          return (
            <div key={p.id} className="bg-surface rounded-md border border-border p-3 shadow-sm">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.part_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.part_number}</div>
                </div>
                <div className={`text-sm font-semibold num ${out ? "text-destructive" : low ? "text-warning" : ""}`}>
                  {p.stock_quantity} {p.unit}
                </div>
              </div>
              <div className="mt-2 flex justify-between items-center text-sm">
                <span className="text-muted-foreground text-xs">{p.brand ?? "—"}</span>
                <span className="num font-medium">{inr(p.selling_price)}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(p); setOpenForm(true); }}>Edit</Button>
                {role === "admin" && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ProductForm
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
        onSaved={() => { setOpenForm(false); void load(); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this part?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.part_name} ({confirmDelete?.part_number}) will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductForm({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: Product | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<Omit<Product, "id">>(blank);
  const [vehicleInput, setVehicleInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...editing } : blank);
      setVehicleInput("");
    }
  }, [open, editing]);

  function addVehicle() {
    const v = vehicleInput.trim();
    if (!v) return;
    if (form.vehicle_compatibility.includes(v)) return;
    setForm({ ...form, vehicle_compatibility: [...form.vehicle_compatibility, v] });
    setVehicleInput("");
  }

  function removeVehicle(v: string) {
    setForm({ ...form, vehicle_compatibility: form.vehicle_compatibility.filter(x => x !== v) });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.part_number.trim() || !form.part_name.trim()) {
      toast.error("Part number and name required");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      purchase_price: Number(form.purchase_price),
      selling_price: Number(form.selling_price),
      stock_quantity: Number(form.stock_quantity),
      min_stock_threshold: Number(form.min_stock_threshold),
      gst_rate: Number(form.gst_rate),
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("products").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("products").insert(payload));
      // record initial stock movement
      if (!error && payload.stock_quantity > 0) {
        const { data: created } = await supabase.from("products").select("id").eq("part_number", payload.part_number).single();
        if (created) {
          await supabase.from("stock_movements").insert({
            product_id: created.id, movement_type: "in", quantity: payload.stock_quantity,
            reference_type: "initial", notes: "Initial stock",
          });
        }
      }
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(editing ? "Part updated" : "Part added"); onSaved(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit part" : "Add new part"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Part Number *">
              <Input value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} className="h-11 font-mono" required />
            </Field>
            <Field label="Part Name *">
              <Input value={form.part_name} onChange={e => setForm({ ...form, part_name: e.target.value })} className="h-11" required />
            </Field>
            <Field label="Brand">
              <Input value={form.brand ?? ""} onChange={e => setForm({ ...form, brand: e.target.value })} className="h-11" />
            </Field>
            <Field label="Category">
              <Input value={form.category ?? ""} onChange={e => setForm({ ...form, category: e.target.value })} className="h-11" placeholder="Engine, Brake, …" />
            </Field>
          </div>

          <Field label="Vehicle Compatibility">
            <div className="flex gap-2">
              <Input
                value={vehicleInput} onChange={e => setVehicleInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addVehicle(); } }}
                placeholder="Add vehicle then Enter (Swift, i20…)"
                className="h-11"
              />
              <Button type="button" variant="outline" onClick={addVehicle}>Add</Button>
            </div>
            {form.vehicle_compatibility.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.vehicle_compatibility.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary rounded text-xs font-medium">
                    {v}
                    <button type="button" onClick={() => removeVehicle(v)} className="text-muted-foreground hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Purchase ₹">
              <Input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: Number(e.target.value) })} className="h-11 font-mono" />
            </Field>
            <Field label="Selling ₹ *">
              <Input type="number" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: Number(e.target.value) })} className="h-11 font-mono" required />
            </Field>
            <Field label="GST %">
              <Input type="number" step="0.01" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: Number(e.target.value) })} className="h-11 font-mono" />
            </Field>
            <Field label="Unit">
              <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="h-11" />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Stock Qty">
              <Input type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) })} className="h-11 font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">{editing ? "Tip: prefer Purchases for stock-in audit trail" : "Initial opening stock"}</p>
            </Field>
            <Field label="Low alert at">
              <Input type="number" value={form.min_stock_threshold} onChange={e => setForm({ ...form, min_stock_threshold: Number(e.target.value) })} className="h-11 font-mono" />
            </Field>
            <Field label="Barcode (optional)">
              <Input value={form.barcode ?? ""} onChange={e => setForm({ ...form, barcode: e.target.value })} className="h-11 font-mono" />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add part"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
