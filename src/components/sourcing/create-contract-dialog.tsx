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

interface CreateContractDialogProps {
    suppliers: any[]
}

export function CreateContractDialog({ suppliers }: CreateContractDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

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
        }

        try {
            const result = await createContract(data as any)
            if (result.success) {
                toast.success('Contract created successfully')
                setOpen(false)
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Contract
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Contract</DialogTitle>
                        <DialogDescription>
                            Define the terms for your partnership with the supplier.
                        </DialogDescription>
                    </DialogHeader>
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
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="validFrom" className="text-right col-span-1">
                                    From
                                </Label>
                                <Input id="validFrom" name="validFrom" type="date" className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="validTo" className="text-right col-span-1">
                                    To
                                </Label>
                                <Input id="validTo" name="validTo" type="date" className="col-span-3" required />
                            </div>
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
