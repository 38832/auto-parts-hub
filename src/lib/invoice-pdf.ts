import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface InvoiceData {
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  subtotal: number;
  discount: number;
  gst_amount: number;
  total: number;
  paid_amount: number;
  credit_amount: number;
  payment_mode: string;
  notes: string | null;
  created_at: string;
  shop_name?: string;
  items: Array<{
    part_number: string;
    part_name: string;
    quantity: number;
    unit_price: number;
    gst_rate: number;
    line_total: number;
  }>;
}

export function generateInvoicePDF(inv: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.width;

  // Header
  doc.setFillColor(26, 32, 44);
  doc.rect(0, 0, w, 28, "F");
  doc.setTextColor(255, 159, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(inv.shop_name || "SparePilot Shop", 14, 14);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Tax Invoice", 14, 21);

  doc.setFontSize(10);
  doc.text(inv.invoice_number, w - 14, 14, { align: "right" });
  doc.setFontSize(8);
  doc.text(format(new Date(inv.created_at), "dd MMM yyyy, h:mm a"), w - 14, 20, { align: "right" });

  // Customer
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 14, 38);
  doc.setFont("helvetica", "normal");
  doc.text(inv.customer_name || "Walk-in Customer", 14, 44);
  if (inv.customer_phone) doc.text(`Phone: ${inv.customer_phone}`, 14, 50);
  if (inv.customer_gstin) doc.text(`GSTIN: ${inv.customer_gstin}`, 14, 56);

  // Items table
  autoTable(doc, {
    startY: 64,
    head: [["Part #", "Item", "Qty", "Rate", "GST %", "Total"]],
    body: inv.items.map(i => [
      i.part_number, i.part_name, String(i.quantity),
      Number(i.unit_price).toFixed(2),
      `${i.gst_rate}%`,
      Number(i.line_total).toFixed(2),
    ]),
    headStyles: { fillColor: [237, 242, 247], textColor: [26, 32, 44], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "grid",
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Totals
  doc.setFontSize(9);
  const x = w - 14;
  let y = finalY;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, x - 60, y);
    doc.text(value, x, y, { align: "right" });
    y += 6;
  };
  row("Subtotal:", `Rs. ${inv.subtotal.toFixed(2)}`);
  if (inv.discount > 0) row("Discount:", `- Rs. ${inv.discount.toFixed(2)}`);
  row("GST:", `Rs. ${inv.gst_amount.toFixed(2)}`);
  doc.setDrawColor(200);
  doc.line(x - 60, y - 3, x, y - 3);
  doc.setFontSize(11);
  row("TOTAL:", `Rs. ${inv.total.toFixed(2)}`, true);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  y += 4;
  doc.text(`Payment: ${inv.payment_mode.toUpperCase()}`, 14, y);
  doc.text(`Paid: Rs. ${inv.paid_amount.toFixed(2)}`, 14, y + 5);
  if (inv.credit_amount > 0) {
    doc.setTextColor(220, 100, 30);
    doc.text(`Credit Due: Rs. ${inv.credit_amount.toFixed(2)}`, 14, y + 10);
    doc.setTextColor(0, 0, 0);
  }

  if (inv.notes) {
    doc.text(`Notes: ${inv.notes}`, 14, y + 18);
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Thank you for your business.", w / 2, doc.internal.pageSize.height - 10, { align: "center" });

  return doc;
}

export function shareViaWhatsApp(inv: InvoiceData) {
  const lines = [
    `*${inv.shop_name || "Invoice"}*`,
    `Invoice: ${inv.invoice_number}`,
    `Date: ${format(new Date(inv.created_at), "dd MMM yyyy")}`,
    "",
    ...inv.items.map(i => `${i.part_name} x${i.quantity} - Rs.${(i.quantity * i.unit_price).toFixed(2)}`),
    "",
    `Subtotal: Rs.${inv.subtotal.toFixed(2)}`,
    `GST: Rs.${inv.gst_amount.toFixed(2)}`,
    `*Total: Rs.${inv.total.toFixed(2)}*`,
    inv.credit_amount > 0 ? `Credit Due: Rs.${inv.credit_amount.toFixed(2)}` : "",
    "",
    "Thank you!",
  ].filter(Boolean).join("\n");
  const phone = (inv.customer_phone || "").replace(/\D/g, "");
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`
    : `https://wa.me/?text=${encodeURIComponent(lines)}`;
  window.open(url, "_blank");
}
