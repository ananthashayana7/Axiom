'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileUp, Database, CheckCircle2, AlertTriangle, Upload, ShieldCheck, Link2, Radar, RefreshCcw, PlugZap } from 'lucide-react';
import { dryRunSapImport, executeSapImport } from '@/app/actions/import';
import { toast } from 'sonner';

type EntityType = 'suppliers' | 'parts' | 'invoices';

type SapConnectorStatus = {
    configured: boolean;
    baseUrlConfigured: boolean;
    authConfigured: boolean;
    authMethod: string;
    lastSuccessfulSyncAt: string | null;
    recentSyncs: Array<{
        id: string;
        entityType: string;
        status: string;
        totalRows: number | null;
        successRows: number | null;
        errorRows: number | null;
        sourceSystemId: string | null;
        completedAt: string | null;
        createdAt: string | null;
    }>;
};

export default function AdminImportPage() {
    const [entityType, setEntityType] = useState<EntityType>('suppliers');
    const [csvText, setCsvText] = useState('');
    const [dryRunResult, setDryRunResult] = useState<any>(null);
    const [isDryRunning, setIsDryRunning] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [connectorStatus, setConnectorStatus] = useState<SapConnectorStatus | null>(null);
    const [isConnectorLoading, setIsConnectorLoading] = useState(true);

    const loadSapConnectorStatus = async () => {
        setIsConnectorLoading(true);
        try {
            const response = await fetch('/api/sap', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Failed to load SAP connector status');
            }
            const payload = await response.json() as SapConnectorStatus;
            setConnectorStatus(payload);
        } catch {
            toast.error('Could not load SAP connector status');
        } finally {
            setIsConnectorLoading(false);
        }
    };

    useEffect(() => {
        loadSapConnectorStatus();
    }, []);

    const onFileChange = async (file: File | null) => {
        if (!file) return;
        const text = await file.text();
        setCsvText(text);
        setDryRunResult(null);
    };

    const runDry = async () => {
        if (!csvText.trim()) {
            toast.error('Please upload a CSV file or paste CSV content.');
            return;
        }

        setIsDryRunning(true);
        try {
            const result = await dryRunSapImport(csvText, entityType);
            setDryRunResult(result);
            if (result.success) {
                toast.success('Dry run complete', {
                    description: `${result.validRows} valid rows, ${result.invalidRows} invalid rows`,
                });
            } else {
                toast.error('Dry run failed');
            }
        } catch {            toast.error('Dry run failed');
        } finally {
            setIsDryRunning(false);
        }
    };

    const executeImport = async () => {
        if (!csvText.trim()) {
            toast.error('CSV content is empty.');
            return;
        }

        setIsImporting(true);
        try {
            const result = await executeSapImport(csvText, entityType);
            if (result.success) {
                toast.success('Import completed', {
                    description: `Inserted: ${result.inserted}, Updated: ${result.updated}, Skipped: ${result.skipped}`,
                });
                const refreshedDryRun = await dryRunSapImport(csvText, entityType);
                setDryRunResult(refreshedDryRun);
                await loadSapConnectorStatus();
            } else {
                toast.error(result.message || 'Import failed');
            }
        } catch {            toast.error('Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    const templateByEntity: Record<EntityType, string> = {
        suppliers: 'name,contact_email,status,categories,country_code,city,risk_score,performance_score,esg_score,financial_score',
        parts: 'sku,name,category,price,stock_level,reorder_point,min_stock_level,market_trend',
        invoices: 'invoice_number,order_id,supplier_id,amount,status,currency,region,country,continent',
    };

    return (
        <div className="min-h-full bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <FileUp className="h-8 w-8 text-primary" /> Controlled Data Import
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">
                        Admin-only CSV intake with dry-run validation, suspicious-input blocking, referential checks, and post-import intelligence sync.
                    </p>
                </div>
                <Badge variant="outline" className="text-xs font-bold">Admin Only</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Schema validation
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Headers, numeric ranges, currency codes, and suspicious spreadsheet formulas are checked before commit.
                    </p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Link2 className="h-4 w-4 text-blue-600" />
                        Referential checks
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Invoice imports verify linked orders and suppliers so broken records do not bridge into live workflows.
                    </p>
                </div>
                <div className="rounded-2xl border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Radar className="h-4 w-4 text-amber-600" />
                        Post-import sync
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Successful imports trigger downstream refresh so dashboards, alerts, and recovery routes stay aligned.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <PlugZap className="h-5 w-5 text-primary" /> SAP Connector Status
                        </CardTitle>
                        <CardDescription>
                            Axiom can test SAP connectivity, map OData fields, dry-run imports, and track committed syncs with job history.
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2" onClick={loadSapConnectorStatus} disabled={isConnectorLoading}>
                        <RefreshCcw className={`h-4 w-4 ${isConnectorLoading ? 'animate-spin' : ''}`} />
                        Refresh Status
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border bg-background p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Configuration</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                                {connectorStatus?.configured ? 'Ready' : 'Missing environment settings'}
                            </p>
                        </div>
                        <div className="rounded-2xl border bg-background p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Auth Method</p>
                            <p className="mt-2 text-sm font-semibold capitalize text-foreground">
                                {connectorStatus?.authMethod?.replace(/_/g, ' ') || 'Unknown'}
                            </p>
                        </div>
                        <div className="rounded-2xl border bg-background p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Last Successful Sync</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                                {connectorStatus?.lastSuccessfulSyncAt
                                    ? new Date(connectorStatus.lastSuccessfulSyncAt).toLocaleString('en-IN')
                                    : 'No successful SAP sync yet'}
                            </p>
                        </div>
                        <div className="rounded-2xl border bg-background p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Recent SAP Jobs</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                                {connectorStatus?.recentSyncs?.length || 0} tracked runs
                            </p>
                        </div>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-4">
                        {connectorStatus?.recentSyncs?.length ? (
                            <div className="space-y-3">
                                {connectorStatus.recentSyncs.slice(0, 4).map((job) => (
                                    <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-3 py-3 text-sm">
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                {job.entityType} sync
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {job.sourceSystemId || 'manual'} • {job.successRows || 0}/{job.totalRows || 0} rows applied
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline">{job.status}</Badge>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {job.completedAt ? new Date(job.completedAt).toLocaleString('en-IN') : 'In progress'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No SAP sync jobs are tracked yet. Once you commit a SAP-backed import, Axiom records the run here with row counts and completion status.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" /> Import Configuration
                    </CardTitle>
                    <CardDescription>
                        Supported datasets: Suppliers, Parts, Invoices. Run the dry run first, then commit only the rows that pass validation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Dataset</Label>
                            <select
                                value={entityType}
                                onChange={(e) => {
                                    setEntityType(e.target.value as EntityType);
                                    setDryRunResult(null);
                                }}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="suppliers">Suppliers</option>
                                <option value="parts">Parts</option>
                                <option value="invoices">Invoices</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Upload CSV</Label>
                            <label className="h-10 inline-flex w-full items-center gap-2 rounded-md border border-input px-3 text-sm cursor-pointer hover:bg-muted/50">
                                <Upload className="h-4 w-4" /> Choose file
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".csv,text/csv"
                                    onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>CSV Content</Label>
                        <Textarea
                            value={csvText}
                            onChange={(e) => {
                                setCsvText(e.target.value);
                                setDryRunResult(null);
                            }}
                            rows={12}
                            placeholder="Paste CSV content here..."
                        />
                        <p className="text-xs text-muted-foreground">
                            Expected headers for {entityType}: <span className="font-mono">{templateByEntity[entityType]}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Files with duplicate headers, oversized payloads, or suspicious spreadsheet formulas are rejected before commit.
                        </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <Button onClick={runDry} disabled={isDryRunning || !csvText.trim()} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" /> {isDryRunning ? 'Running Dry-Run...' : 'Run Dry-Run'}
                        </Button>
                        <Button
                            onClick={executeImport}
                            disabled={isImporting || !dryRunResult || dryRunResult.validRows === 0}
                            variant="outline"
                            className="gap-2"
                        >
                            <FileUp className="h-4 w-4" /> {isImporting ? 'Importing...' : 'Commit Import'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {dryRunResult && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dry-Run Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex items-center justify-between"><span>Total Rows</span><strong>{dryRunResult.totalRows}</strong></div>
                            <div className="flex items-center justify-between"><span>Valid Rows</span><strong className="text-emerald-700">{dryRunResult.validRows}</strong></div>
                            <div className="flex items-center justify-between"><span>Invalid Rows</span><strong className="text-red-700">{dryRunResult.invalidRows}</strong></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Validation Issues</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {dryRunResult.issues?.length ? (
                                <div className="space-y-2 max-h-48 overflow-auto pr-2 text-sm">
                                    {dryRunResult.issues.map((issue: any, idx: number) => (
                                        <div key={idx} className={`rounded-md border px-3 py-2 ${issue.row <= 1 ? 'border-red-300 bg-red-50 text-red-800 font-semibold' : 'border-amber-200 bg-amber-50'}`}>
                                            {/* row 0 = empty-file error, row 1 = header-level error */}
                                            {issue.row <= 1 ? '⚠ Header issue: ' : `Row ${issue.row}: `}{issue.message}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-emerald-700 font-medium">No issues found.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Preview (first 10 rows)</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-auto">
                            {dryRunResult.preview?.length ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            {Object.keys(dryRunResult.preview[0]).map((key) => (
                                                <th key={key} className="px-3 py-2 text-left text-xs uppercase text-muted-foreground">{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dryRunResult.preview.map((row: Record<string, string>, idx: number) => (
                                            <tr key={idx} className="border-b">
                                                {Object.values(row).map((value, vIdx) => (
                                                    <td key={vIdx} className="px-3 py-2">{value || '—'}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-sm text-muted-foreground">No preview available.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
