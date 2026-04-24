'use client'

import { useState, useTransition } from "react";
import { createUser, deleteUser, updateUser } from "@/app/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    Briefcase,
    Building2,
    Plus,
    Shield as ShieldIcon,
    Store,
    UserCheck,
    UserRound,
    Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

type UserRole = 'admin' | 'user' | 'supplier';

interface AppUser {
    id: string;
    name: string;
    email: string;
    employeeId: string | null;
    department: string | null;
    role: UserRole | null;
    supplierId: string | null;
    supplierName: string | null;
    createdAt: Date | null;
}

interface SupplierOption {
    id: string;
    name: string;
}

const DEPARTMENTS = [
    "Finance & Budgeting",
    "Supplier Operations",
    "Procurement Team",
    "Inventory Control",
    "IT & Admin",
    "Executive Leadership",
];

interface UsersClientProps {
    users: AppUser[];
    suppliers: SupplierOption[];
    currentUserRole: string;
}

function roleBadgeClass(role: UserRole | null) {
    if (role === 'admin') return "bg-amber-100 text-amber-700 border-amber-200";
    if (role === 'supplier') return "bg-emerald-100 text-emerald-700 border-emerald-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
}

function accessLabel(user: AppUser) {
    if (user.role === 'admin') return "Admin Console";
    if (user.role === 'supplier') return user.supplierName ? `Supplier Portal: ${user.supplierName}` : "Supplier Portal";
    return "Internal Workspace";
}

export default function UsersClient({ users, suppliers, currentUserRole }: UsersClientProps) {
    const [open, setOpen] = useState(false);
    const [editUser, setEditUser] = useState<AppUser | null>(null);
    const [createRole, setCreateRole] = useState<UserRole>('user');
    const [createSupplierId, setCreateSupplierId] = useState('');
    const [editRole, setEditRole] = useState<UserRole>('user');
    const [editSupplierId, setEditSupplierId] = useState('');
    const [isPending, startTransition] = useTransition();

    const adminCount = users.filter((user) => user.role === 'admin').length;
    const internalUserCount = users.filter((user) => user.role === 'user').length;
    const supplierAccountCount = users.filter((user) => user.role === 'supplier').length;

    const resetCreateState = () => {
        setCreateRole('user');
        setCreateSupplierId('');
    };

    const handleCreateUser = async (formData: FormData) => {
        startTransition(async () => {
            const result = await createUser(formData);
            if (result.success) {
                toast.success("Access account created.");
                setOpen(false);
                resetCreateState();
            } else {
                toast.error(result.error || "Failed to create user");
            }
        });
    };

    const handleUpdateUser = async (formData: FormData) => {
        if (!editUser) return;
        startTransition(async () => {
            const result = await updateUser(editUser.id, formData);
            if (result.success) {
                toast.success("Access account updated.");
                setEditUser(null);
            } else {
                toast.error(result.error || "Failed to update user");
            }
        });
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm("Are you sure you want to delete this access account?")) {
            return;
        }

        startTransition(async () => {
            const result = await deleteUser(id);
            if (result.success) {
                toast.success("Access account removed.");
            } else {
                toast.error(result.error || "Failed to delete user");
            }
        });
    };

    const openEditDialog = (user: AppUser) => {
        setEditUser(user);
        setEditRole((user.role || 'user') as UserRole);
        setEditSupplierId(user.supplierId || '');
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase leading-none">Access & Roles</h1>
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-2">Admin, internal user, and supplier access control</p>
                </div>

                {currentUserRole === 'admin' && (
                    <Dialog
                        open={open}
                        onOpenChange={(nextOpen) => {
                            setOpen(nextOpen);
                            if (!nextOpen) {
                                resetCreateState();
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="gap-2 bg-amber-600 hover:bg-amber-700 transition-all shadow-lg shadow-amber-100">
                                <Plus className="mr-1 h-4 w-4" />
                                Add Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Access Account</DialogTitle>
                                <DialogDescription>
                                    Provision an admin, internal user, or supplier login for the platform.
                                </DialogDescription>
                            </DialogHeader>
                            <form action={handleCreateUser} className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" name="name" placeholder="John Doe" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" name="email" type="email" placeholder="john@company.com" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="employeeId">Employee ID</Label>
                                    <Input id="employeeId" name="employeeId" placeholder="EMP001" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" name="password" type="password" placeholder="Minimum 6 characters" required minLength={6} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="department">Department</Label>
                                    <select
                                        id="department"
                                        name="department"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">Select Department</option>
                                        {DEPARTMENTS.map((department) => (
                                            <option key={department} value={department}>{department}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Role</Label>
                                    <select
                                        id="role"
                                        name="role"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={createRole}
                                        onChange={(event) => {
                                            const nextRole = event.target.value as UserRole;
                                            setCreateRole(nextRole);
                                            if (nextRole !== 'supplier') {
                                                setCreateSupplierId('');
                                            }
                                        }}
                                    >
                                        <option value="user">Internal User</option>
                                        <option value="admin">Admin</option>
                                        <option value="supplier" disabled={suppliers.length === 0}>Supplier</option>
                                    </select>
                                </div>
                                {createRole === 'supplier' && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="supplierId">Linked Supplier</Label>
                                        <select
                                            id="supplierId"
                                            name="supplierId"
                                            required
                                            value={createSupplierId}
                                            onChange={(event) => setCreateSupplierId(event.target.value)}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="">Select Supplier</option>
                                            {suppliers.map((supplier) => (
                                                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-muted-foreground">
                                            Supplier logins are portal-only and must be mapped to an existing supplier record.
                                        </p>
                                    </div>
                                )}
                                <div className="flex justify-end mt-4">
                                    <Button type="submit" disabled={isPending}>
                                        {isPending && <span className="mr-2 h-4 w-4 animate-spin inline-block border-2 border-current border-t-transparent rounded-full" />}
                                        Create Account
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card className="glass-card border-l-4 border-l-indigo-600">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Accounts</CardTitle>
                        <UsersIcon className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{users.length}</div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">Authorized platform identities</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-l-4 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Admins</CardTitle>
                        <ShieldIcon className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{adminCount}</div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">Restricted control-plane access</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Internal Users</CardTitle>
                        <Briefcase className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{internalUserCount}</div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">Operational workspace accounts</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-l-4 border-l-emerald-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Supplier Logins</CardTitle>
                        <Store className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{supplierAccountCount}</div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">Portal-only external access</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="glass-card border-none shadow-2xl overflow-hidden">
                <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 px-6 py-6 border-slate-100">
                    <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-indigo-600" />
                        Directory
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        Role assignments, linked suppliers, and workspace scope
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Access Scope</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Department</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Created</th>
                                        {currentUserRole === 'admin' && (
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-right px-8">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "flex h-8 w-8 items-center justify-center rounded-lg border",
                                                        user.role === 'admin'
                                                            ? "border-amber-200 bg-amber-50 text-amber-700"
                                                            : user.role === 'supplier'
                                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                                : "border-blue-200 bg-blue-50 text-blue-700"
                                                    )}>
                                                        {user.role === 'admin' ? <ShieldIcon className="h-4 w-4" /> : user.role === 'supplier' ? <Store className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                                                    </span>
                                                    <div>
                                                        <p>{user.name}</p>
                                                        {user.employeeId ? <p className="text-[11px] text-muted-foreground font-mono">{user.employeeId}</p> : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle font-mono text-xs">{user.email}</td>
                                            <td className="p-4 align-middle text-xs">
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className="w-fit font-normal bg-muted/50">
                                                        {accessLabel(user)}
                                                    </Badge>
                                                    {user.role === 'supplier' && !user.supplierName ? (
                                                        <span className="text-[11px] text-red-500">Supplier mapping required</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-xs">
                                                {user.department ? (
                                                    <Badge variant="outline" className="font-normal bg-muted/50">
                                                        <Building2 className="mr-1 h-3 w-3" />
                                                        {user.department}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle capitalize">
                                                <Badge className={cn("uppercase text-[10px] font-black tracking-widest px-3 py-1 rounded-lg", roleBadgeClass(user.role))}>
                                                    <ShieldIcon className="mr-1 h-3 w-3" />
                                                    {user.role || 'user'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground">
                                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>
                                            {currentUserRole === 'admin' && (
                                                <td className="p-4 align-middle text-right px-8">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditDialog(user)}
                                                            className="text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors font-bold"
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            disabled={isPending}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-4 text-center text-muted-foreground">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={!!editUser}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setEditUser(null);
                        setEditRole('user');
                        setEditSupplierId('');
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Access Account</DialogTitle>
                        <DialogDescription>
                            Update profile details, role assignment, or portal access for {editUser?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    {editUser && (
                        <form action={handleUpdateUser} className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-name">Full Name</Label>
                                <Input id="edit-name" name="name" defaultValue={editUser.name} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input id="edit-email" name="email" type="email" defaultValue={editUser.email} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-employeeId">Employee ID</Label>
                                <Input id="edit-employeeId" name="employeeId" defaultValue={editUser.employeeId || ''} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
                                <Input id="edit-password" name="password" type="password" placeholder="Minimum 6 characters" minLength={6} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-department">Department</Label>
                                <select
                                    id="edit-department"
                                    name="department"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue={editUser.department || ''}
                                >
                                    <option value="">Select Department</option>
                                    {DEPARTMENTS.map((department) => (
                                        <option key={department} value={department}>{department}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <select
                                    id="edit-role"
                                    name="role"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={editRole}
                                    onChange={(event) => {
                                        const nextRole = event.target.value as UserRole;
                                        setEditRole(nextRole);
                                        if (nextRole !== 'supplier') {
                                            setEditSupplierId('');
                                        }
                                    }}
                                >
                                    <option value="user">Internal User</option>
                                    <option value="admin">Admin</option>
                                    <option value="supplier" disabled={suppliers.length === 0}>Supplier</option>
                                </select>
                            </div>
                            {editRole === 'supplier' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-supplierId">Linked Supplier</Label>
                                    <select
                                        id="edit-supplierId"
                                        name="supplierId"
                                        required
                                        value={editSupplierId}
                                        onChange={(event) => setEditSupplierId(event.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">Select Supplier</option>
                                        {suppliers.map((supplier) => (
                                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex justify-end mt-4">
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <span className="mr-2 h-4 w-4 animate-spin inline-block border-2 border-current border-t-transparent rounded-full" />}
                                    Update Account
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
