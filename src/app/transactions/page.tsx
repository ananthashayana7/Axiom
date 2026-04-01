'use client'

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, ArrowRightLeft, ShoppingCart, Truck, FileText, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getOrders } from "@/app/actions/orders";
import { getInvoices } from "@/app/actions/invoices";
import { getGoodsReceipts } from "@/app/actions/goods-receipts";
import { getContracts } from "@/app/actions/contracts";
import { formatCurrencyByCode } from "@/lib/utils/currency";

type TxType = 'all' | 'orders' | 'goods_receipts' | 'invoices' | 'quantity_contracts';
type TxRow = {
    _type: string;
    _ref: string;
    _amount: string | null;
    _currency: string;
    _status: string | null;
    _date: Date | string | null;
};

type OrderRow = { id?: string; totalAmount?: string; status?: string | null; createdAt?: Date | string | null };
type InvoiceRow = { invoiceNumber?: string; amount?: string; currency?: string | null; status?: string | null; createdAt?: Date | string | null };
type ReceiptRow = { id?: string; inspectionStatus?: string | null; receivedAt?: Date | string | null };
type ContractRow = { title?: string; value?: string; status?: string | null; createdAt?: Date | string | null };

const TX_TYPES = [
    { id: 'all' as TxType, label: 'All Transactions', icon: ArrowRightLeft },
    { id: 'orders' as TxType, label: 'Orders', icon: ShoppingCart },
    { id: 'goods_receipts' as TxType, label: 'Goods Receipts', icon: Truck },
    { id: 'invoices' as TxType, label: 'Invoices', icon: FileText },
    { id: 'quantity_contracts' as TxType, label: 'Quantity Contracts', icon: Handshake },
];

export default function TransactionsPage() {
    const [txType, setTxType] = useState<TxType>('all');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [rows, setRows] = useState<TxRow[]>([]);

    const fmt = (val: number, currencyCode = 'INR') => formatCurrencyByCode(val, currencyCode);

    useEffect(() => {
        const cancelled = false;
        Promise.all([
            txType === 'all' || txType === 'orders' ? getOrders() : Promise.resolve([]),
            txType === 'all' || txType === 'invoices' ? getInvoices() : Promise.resolve([]),
            txType === 'all' || txType === 'goods_receipts' ? getGoodsReceipts() : Promise.resolve([]),
            txType === 'all' || txType === 'quantity_contracts' ? getContracts() : Promise.resolve([]),
        ]).then(([orders, invoices, receipts, contracts]) => {
            if (cancelled) return;
            const combined: TxRow[] = [
                ...(orders as OrderRow[]).map(o => ({ _type: 'Order', _ref: o.id?.slice(0, 8) || 'N/A', _amount: o.totalAmount || null, _currency: 'INR', _status: o.status || null, _date: o.createdAt || null })),
                ...(invoices as InvoiceRow[]).map(i => ({ _type: 'Invoice', _ref: i.invoiceNumber || 'N/A', _amount: i.amount || null, _currency: i.currency || 'INR', _status: i.status || null, _date: i.createdAt || null })),
                ...(receipts as ReceiptRow[]).map(r => ({ _type: 'Goods Receipt', _ref: r.id?.slice(0, 8) || 'N/A', _amount: null, _currency: 'INR', _status: r.inspectionStatus || null, _date: r.receivedAt || null })),
                ...(contracts as ContractRow[]).map(c => ({ _type: 'Quantity Contract', _ref: c.title || 'N/A', _amount: c.value || null, _currency: 'INR', _status: c.status || null, _date: c.createdAt || null })),
            ].sort((a, b) => new Date(b._date || 0).getTime() - new Date(a._date || 0).getTime());
            setRows(combined);
            setLoading(false);
        });
    }, [txType]);

    const filtered = rows.filter(r => {
        const matchSearch = !search || r._ref?.toLowerCase().includes(search.toLowerCase()) || r._type?.toLowerCase().includes(search.toLowerCase());
        const matchFrom = !dateFrom || new Date(r._date) >= new Date(dateFrom);
        const matchTo = !dateTo || new Date(r._date) <= new Date(dateTo);
        return matchSearch && matchFrom && matchTo;
    });

    const exportCSV = () => {
        const headers = ['Type', 'Reference', 'Status', 'Amount', 'Date'];
        const csvRows = filtered.map(r => [r._type, r._ref || 'N/A', r._status || 'N/A', r._amount ? fmt(parseFloat(r._amount), r._currency) : 'N/A', r._date ? new Date(r._date).toLocaleDateString() : 'N/A']);
        const csv = [headers, ...csvRows].map(row => row.map((v) => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `axiom_transactions_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Transactions exported");
    };

    const typeColors: Record<string, string> = {
        'Order': 'bg-blue-100 text-blue-700 border-blue-200',
        'Invoice': 'bg-amber-100 text-amber-700 border-amber-200',
        'Goods Receipt': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Quantity Contract': 'bg-violet-100 text-violet-700 border-violet-200',
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <ArrowRightLeft className="h-8 w-8 text-primary" /> Transactions
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">Unified view of Orders, Goods Receipts, Invoices, and Contracts in their recorded currency.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
                </div>
            </div>

            {/* Type Tabs */}
            <div className="flex flex-wrap gap-2">
                {TX_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                        <button key={type.id} onClick={() => setTxType(type.id)}
                            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all",
                                txType === type.id ? "bg-primary text-white border-primary shadow" : "bg-card hover:bg-muted")}>
                            <Icon className="h-4 w-4" />
                            {type.label}
                        </button>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Search</Label>
                    <Input placeholder="Search reference, type..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-64" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">From Date</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">To Date</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9" />
                </div>
                {(search || dateFrom || dateTo) && (
                    <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} className="gap-1 mb-0.5">Clear</Button>
                )}
                <span className="text-sm text-muted-foreground mb-0.5">{filtered.length} records</span>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <div className="rounded-md overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        {['Type', 'Reference', 'Status', 'Amount', 'Date'].map(h => (
                                            <th key={h} className="h-11 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((row, i) => (
                                        <tr key={i} className="border-b hover:bg-muted/50 transition-colors">
                                            <td className="p-4 align-middle">
                                                <Badge className={cn("text-[10px] font-bold border", typeColors[row._type] || 'bg-stone-100')}>{row._type}</Badge>
                                            </td>
                                            <td className="p-4 align-middle font-medium">{row._ref || 'N/A'}</td>
                                            <td className="p-4 align-middle">
                                                <span className="text-xs font-medium uppercase text-muted-foreground">{row._status || '—'}</span>
                                            </td>
                                            <td className="p-4 align-middle font-black tabular-nums">
                                                {row._amount ? fmt(parseFloat(row._amount), row._currency) : '—'}
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground text-sm">
                                                {row._date ? new Date(row._date).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan={5} className="p-12 text-center text-muted-foreground italic">No transactions found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
