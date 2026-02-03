'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createContract } from '@/app/actions/contracts'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { ContractUpload } from '@/components/contracts/contract-upload'

interface CreateContractDialogProps {
    suppliers: any[]
}

export function CreateContractDialog({ suppliers }: CreateContractDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [aiData, setAiData] = useState<any>(null)
    const router = useRouter()

    const handleDataExtracted = (data: any) => {
        setAiData(JSON.stringify(data));
        // Auto-fill logic would ideally utilize form refs or react-hook-form, 
        // but for native forms, we can rely on defaultValue mapping if we re-render or just let user manually check.
        // For better UX with native forms, we can set key prop to force re-render with new defaults
    };

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)

        const formData = new FormData(event.currentTarget)
        const data = {
            supplierId: formData.get('supplierId') as string,
            title: formData.get('title') as string,
            type: formData.get('type') as any,
            value: Number(formData.get('value')),
            validFrom: new Date(formData.get('validFrom') as string),
            validTo: new Date(formData.get('validTo') as string),
            noticePeriod: Number(formData.get('noticePeriod')),
            renewalStatus: formData.get('renewalStatus') as any,
            // Hidden AI fields
            liabilityCap: formData.get('liabilityCap') ? Number(formData.get('liabilityCap')) : undefined,
            priceLockExpiry: formData.get('priceLockExpiry') ? new Date(formData.get('priceLockExpiry') as string) : undefined,
            autoRenewalAlert: formData.get('autoRenewalAlert') as string,
            aiExtractedData: formData.get('aiExtractedData') as string,
        }

        try {
            const result = await createContract(data as any)
            if (result.success) {
                toast.success('Contract created successfully')
                setOpen(false)
                setAiData(null)
                router.refresh()
            } else {
                toast.error(result.error || 'Failed to create contract')
            }
        } catch (error) {
            toast.error('An error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const aiDefaults = aiData ? JSON.parse(aiData) : null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Contract
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Contract</DialogTitle>
                    <DialogDescription>
                        Define the terms for your partnership with the supplier.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 border-b border-border/50 mb-4">
                    <ContractUpload onDataExtracted={handleDataExtracted} />
                </div>

                <form onSubmit={handleSubmit} key={aiData ? 'loaded' : 'empty'}>
                    <input type="hidden" name="aiExtractedData" value={aiData || ''} />
                    {aiDefaults?.liabilityCapAmount && <input type="hidden" name="liabilityCap" value={aiDefaults.liabilityCapAmount} />}
                    {aiDefaults?.priceLockDurationMonths && (
                        // Estimate price lock expiry based on duration if start date is today - simplistic
                        <input type="hidden" name="priceLockExpiry" value={new Date(Date.now() + aiDefaults.priceLockDurationMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} />
                    )}
                    <input type="hidden" name="autoRenewalAlert" value={aiDefaults?.autoRenewal ? 'true' : 'false'} />

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                name="title"
                                className="col-span-3"
                                placeholder="Master Service Agreement 2024"
                                required
                                defaultValue={aiDefaults?.summary ? `Contract - ${aiDefaults.summary.substring(0, 30)}...` : ''}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="supplierId" className="text-right">
                                Supplier
                            </Label>
                            <div className="col-span-3">
                                <Select name="supplierId" required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type
                            </Label>
                            <div className="col-span-3">
                                <Select name="type" required defaultValue="framework_agreement">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="framework_agreement">Framework Agreement</SelectItem>
                                        <SelectItem value="nda">NDA</SelectItem>
                                        <SelectItem value="service_agreement">Service Agreement</SelectItem>
                                        <SelectItem value="one_off">One-off Contract</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="value" className="text-right">
                                Value (₹)
                            </Label>
                            <Input
                                id="value"
                                name="value"
                                type="number"
                                className="col-span-3"
                                placeholder="0.00"
                                required
                                defaultValue={aiDefaults?.liabilityCapAmount || ''}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="validFrom" className="text-right col-span-1">
                                    From
                                </Label>
                                <Input
                                    id="validFrom"
                                    name="validFrom"
                                    type="date"
                                    className="col-span-3"
                                    required
                                    defaultValue={aiDefaults?.effectiveDate || ''}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="validTo" className="text-right col-span-1">
                                    To
                                </Label>
                                <Input
                                    id="validTo"
                                    name="validTo"
                                    type="date"
                                    className="col-span-3"
                                    required
                                    defaultValue={aiDefaults?.expirationDate || ''}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="noticePeriod" className="text-right">
                                Notice (Days)
                            </Label>
                            <Input
                                id="noticePeriod"
                                name="noticePeriod"
                                type="number"
                                className="col-span-3"
                                placeholder="30"
                                required
                                defaultValue={aiDefaults?.noticePeriodDays || 30}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Contract'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
