'use client'

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileUp, Database, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { dryRunSapImport, executeSapImport } from '@/app/actions/import';
import { toast } from 'sonner';

type EntityType = 'suppliers' | 'parts' | 'invoices';

export default function AdminImportPage() {
    const [entityType, setEntityType] = useState<EntityType>('suppliers');
    const [csvText, setCsvText] = useState('');
    const [dryRunResult, setDryRunResult] = useState<any>(null);
    const [isDryRunning, setIsDryRunning] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

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
        } catch (error) {
            toast.error('Dry run failed');
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
            } else {
                toast.error(result.message || 'Import failed');
            }
        } catch (error) {
            toast.error('Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    const templateByEntity: Record<EntityType, string> = {
        suppliers: 'name,contact_email,status,country_code,city,risk_score,performance_score,esg_score,financial_score',
        parts: 'sku,name,category,price,stock_level,reorder_point,min_stock_level,market_trend',
        invoices: 'invoice_number,order_id,supplier_id,amount,status,currency,region,country,continent',
    };

    return (
        <div className="min-h-full bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <FileUp className="h-8 w-8 text-primary" /> SAP Data Import Console
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">
                        Admin-only bulk import with safe dry-run validation and commit controls.
                    </p>
                </div>
                <Badge variant="outline" className="text-xs font-bold">Admin Only</Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" /> Import Configuration
                    </CardTitle>
                    <CardDescription>
                        Supported datasets: Suppliers, Parts, Invoices. Run dry-run first to validate before commit.
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
