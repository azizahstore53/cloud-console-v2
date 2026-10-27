"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/billing/calculator";
import { format } from "date-fns";
import { Download, Loader2, ArrowLeft } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function InvoicePrintPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const res = await fetch(`/api/billing/invoice/${id}`);
        if (!res.ok) throw new Error("Failed to fetch invoice");
        const data = await res.json();
        setInvoice(data.invoice);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [id]);

  const downloadPDF = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${invoice.invoiceNumber}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-screen items-center justify-center text-center p-4">
        <p>Invoice not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      {/* Toolbar - Hidden during PDF export */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between no-print">
        <Button variant="outline" onClick={() => router.push("/billing/history")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to History
        </Button>
        <Button
          onClick={downloadPDF}
          disabled={isGenerating}
          className="gap-2 bg-primary text-white"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isGenerating ? "Generating PDF..." : "Download PDF"}
        </Button>
      </div>

      {/* Invoice Template - This part is captured by html2canvas */}
      <div
        ref={printRef}
        className="max-w-4xl mx-auto bg-white p-12 shadow-lg text-slate-900"
        style={{ minHeight: "297mm", width: "210mm", margin: "0 auto" }}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-200 pb-8 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary uppercase tracking-tight">DevCloudhost</h1>
            <p className="text-sm text-slate-500 mt-1">Secure Universal Gateway Services</p>
            <p className="text-xs text-slate-400">Digital Infrastructure Hub, Cloud City</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-semibold text-slate-700 uppercase">Invoice</h2>
            <p className="text-sm font-medium mt-1">{invoice.invoiceNumber}</p>
            <p className="text-xs text-slate-500">Issued: {format(new Date(invoice.createdAt), "d MMM yyyy")}</p>
          </div>
        </div>

        {/* Client & Due Date */}
        <div className="grid grid-cols-2 gap-12 mb-10">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Billed To:</p>
            <p className="font-semibold text-slate-800">{invoice.user?.name || "Valued Customer"}</p>
            <p className="text-sm text-slate-600">{invoice.user?.email || "N/A"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Payment Terms:</p>
            <p className="text-sm text-slate-700">Due Date: <span className="font-semibold">{format(new Date(invoice.dueDate), "d MMM yyyy")}</span></p>
            <p className="text-sm text-slate-700">Status: <span className={`font-bold ${invoice.status === "PAID" ? "text-green-600" : "text-red-600"}`}>{invoice.status}</span></p>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-200">
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase">Description</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-center">Qty</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-right">Unit Price</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-4 px-4 text-sm text-slate-700">{item.description}</td>
                  <td className="py-4 px-4 text-sm text-slate-700 text-center">{item.quantity}</td>
                  <td className="py-4 px-4 text-sm text-slate-700 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-4 px-4 text-sm text-slate-700 text-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-20">
          <div className="w-64 space-y-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tax (0%)</span>
              <span>{formatCurrency(invoice.tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-900 border-t-2 border-slate-200 pt-3">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 text-center">
          <p className="text-sm text-slate-500 italic">Thank you for using DevCloudhost Services!</p>
          <p className="text-xs text-slate-400 mt-1">This is a computer-generated document. No signature is required.</p>
        </div>
      </div>
    </div>
  );
}
