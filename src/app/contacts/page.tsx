'use client'

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SendEmailButton } from "@/components/shared/send-email-button";
import { toast } from "sonner";
import { Users, Phone, Globe, Plus, Search, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContacts, createContact, updateContactStatus } from "@/app/actions/contacts";

export default function ContactsPage() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterContinent, setFilterContinent] = useState('all');
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '', email: '', phone: '', company: '', jobTitle: '',
        region: '', country: '', continent: 'Europe', currency: 'EUR', notes: '', status: 'active' as const,
    });

    useEffect(() => {
        getContacts().then(data => { setContacts(data); setLoading(false); });
    }, []);

    const filtered = contacts.filter(c => {
        const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase()) ||
            c.company?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || c.status === filterStatus;
        const matchContinent = filterContinent === 'all' || c.continent === filterContinent;
        return matchSearch && matchStatus && matchContinent;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const result = await createContact(form);
        if (result.success) {
            const data = await getContacts();
            setContacts(data);
            setShowAddForm(false);
            setForm({ name: '', email: '', phone: '', company: '', jobTitle: '', region: '', country: '', continent: 'Europe', currency: 'EUR', notes: '', status: 'active' });
            toast.success("Contact added successfully");
        } else {
            toast.error(result.error || "Failed to add contact");
        }
        setSaving(false);
    };

    const handleStatusChange = async (id: string, status: 'active' | 'inactive' | 'on_hold') => {
        const result = await updateContactStatus(id, status);
        if (result.success) {
            setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
            toast.success("Status updated");
        }
    };

    const exportCSV = () => {
        const headers = ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Country', 'Region', 'Continent', 'Currency', 'Status'];
        const rows = filtered.map(c => [c.name, c.email, c.phone || '', c.company || '', c.jobTitle || '', c.country || '', c.region || '', c.continent || '', c.currency || '', c.status]);
        const csv = [headers, ...rows].map(r => r.map((v) => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `axiom_contacts_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Contacts exported");
    };

    const statusColors: Record<string, string> = {
        active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        inactive: 'bg-stone-100 text-stone-600 border-stone-200',
        on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Users className="h-8 w-8 text-primary" /> Contacts
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">Manage supplier and partner contact directory.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
                    <Button onClick={() => setShowAddForm(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Contact</Button>
                </div>
            </div>

            {/* Add Contact Form */}
            {showAddForm && (
                <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">New Contact</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)} className="h-7 w-7 p-0"><X className="h-4 w-4" /></Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {[
                                    { key: 'name', label: 'Full Name', required: true },
                                    { key: 'email', label: 'Email Address', required: true, type: 'email' },
                                    { key: 'phone', label: 'Phone Number' },
                                    { key: 'company', label: 'Company / Supplier' },
                                    { key: 'jobTitle', label: 'Job Title' },
                                    { key: 'country', label: 'Country' },
                                    { key: 'region', label: 'Region / Zone' },
                                ].map(field => (
                                    <div key={field.key} className="space-y-1">
                                        <Label className="text-xs font-semibold">{field.label}{field.required && ' *'}</Label>
                                        <Input type={field.type || 'text'} required={field.required} value={(form as any)[field.key]}
                                            onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} className="h-9 text-sm" />
                                    </div>
                                ))}
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">Continent</Label>
                                    <select value={form.continent} onChange={e => setForm(f => ({ ...f, continent: e.target.value }))}
                                        className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                                        {['Europe', 'Asia', 'Americas', 'Africa', 'Oceania'].map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold">Currency</Label>
                                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                                        className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                                        <option value="EUR">EUR (€)</option>
                                        <option value="INR">INR (₹)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="GBP">GBP (£)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1 mb-4">
                                <Label className="text-xs font-semibold">Notes</Label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div className="flex gap-2">
                                <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Contact"}</Button>
                                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name, email, company..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_hold">On Hold</option>
                </select>
                <select value={filterContinent} onChange={e => setFilterContinent(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                    <option value="all">All Continents</option>
                    {['Europe', 'Asia', 'Americas', 'Africa', 'Oceania'].map(c => <option key={c}>{c}</option>)}
                </select>
                <span className="text-sm text-muted-foreground">{filtered.length} contacts</span>
            </div>

            {/* Contacts Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map(contact => (
                        <Card key={contact.id} className="hover:shadow-md transition-all">
                            <CardContent className="pt-5 pb-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-bold text-base">{contact.name}</h3>
                                        {contact.jobTitle && <p className="text-xs text-muted-foreground">{contact.jobTitle}</p>}
                                        {contact.company && <p className="text-xs font-medium text-primary">{contact.company}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge className={cn("text-[10px] font-bold border", statusColors[contact.status] || 'bg-stone-100')}>{contact.status}</Badge>
                                        {contact.currency && <Badge variant="outline" className="text-[10px]">{contact.currency}</Badge>}
                                    </div>
                                </div>
                                <div className="space-y-1.5 text-sm text-muted-foreground">
                                    <SendEmailButton email={contact.email} name={contact.name} className="flex items-center gap-2 text-sm hover:text-primary transition-colors" />
                                    {contact.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-3.5 w-3.5 shrink-0" />
                                            <span>{contact.phone}</span>
                                        </div>
                                    )}
                                    {(contact.country || contact.continent) && (
                                        <div className="flex items-center gap-2">
                                            <Globe className="h-3.5 w-3.5 shrink-0" />
                                            <span>{[contact.country, contact.region, contact.continent].filter(Boolean).join(' · ')}</span>
                                        </div>
                                    )}
                                </div>
                                {contact.notes && <p className="mt-2 text-xs text-muted-foreground italic border-t pt-2">{contact.notes}</p>}
                                <div className="mt-3 flex gap-1">
                                    {(['active', 'inactive', 'on_hold'] as const).map(s => (
                                        <button key={s} onClick={() => handleStatusChange(contact.id, s)}
                                            className={cn("text-[10px] font-bold px-2 py-1 rounded-md border transition-all",
                                                contact.status === s ? statusColors[s] : "hover:bg-muted text-muted-foreground")}>
                                            {s.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {filtered.length === 0 && !loading && (
                        <div className="col-span-3 text-center py-16 text-muted-foreground italic">
                            No contacts found. Add your first contact to get started.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
