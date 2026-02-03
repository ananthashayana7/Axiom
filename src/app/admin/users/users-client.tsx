'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Shield as ShieldIcon, Users as UsersIcon, Building2, UserCheck, Mail } from "lucide-react";

import { createUser, deleteUser, updateUser } from "@/app/actions/users";

export const dynamic = 'force-dynamic';

interface AppUser {
    id: string;
    name: string;
    email: string;
    employeeId: string | null;
    department: string | null;
    role: 'admin' | 'user' | null;
    createdAt: Date | null;
}

const DEPARTMENTS = [
    "Finance & Budgeting",
    "Supplier Operations",
    "Procurement Team",
    "Inventory Control",
    "IT & Admin",
    "Executive Leadership"
];

interface UsersClientProps {
    users: AppUser[];
    currentUserRole: string;
}

export default function UsersClient({ users, currentUserRole }: UsersClientProps) {
    const [open, setOpen] = useState(false);
    const [editUser, setEditUser] = useState<AppUser | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleCreateUser = async (formData: FormData) => {
        startTransition(async () => {
            const result = await createUser(formData);
            if (result.success) setOpen(false);
            else alert(result.error);
        });
    };

    const handleUpdateUser = async (formData: FormData) => {
        if (!editUser) return;
        startTransition(async () => {
            const result = await updateUser(editUser.id, formData);
            if (result.success) setEditUser(null);
            else alert(result.error);
        });
    };

    const handleDeleteUser = async (id: string) => {
        if (confirm("Are you sure you want to delete this user?")) {
            startTransition(async () => {
                const result = await deleteUser(id);
                if (!result.success) alert(result.error);
            });
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase leading-none">Access Control</h1>
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-2">Departmental mapping & permissions</p>
                </div>

                {currentUserRole === 'admin' && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 bg-amber-600 hover:bg-amber-700 transition-all shadow-lg shadow-amber-100">
                                <Plus className="mr-1 h-4 w-4" />
                                Add User
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New User</DialogTitle>
                                <DialogDescription>
                                    Create a new user account. They will use these credentials to log in.
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
                                        {DEPARTMENTS.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="role">Role</Label>
                                    <select
                                        id="role"
                                        name="role"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        defaultValue="user"
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="flex justify-end mt-4">
                                    <Button type="submit" disabled={isPending}>
                                        {isPending && <span className="mr-2 h-4 w-4 animate-spin inline-block border-2 border-current border-t-transparent rounded-full" />}
                                        Create User
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
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Users</CardTitle>
                        <UsersIcon className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900">{users.length}</div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">Authorized platform accounts</p>
                    </CardContent>
                </Card>

                {DEPARTMENTS.slice(0, 3).map((dept) => {
                    const count = users.filter(u => u.department === dept).length;
                    return (
                        <Card key={dept} className="glass-card border-l-4 border-l-slate-400">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{dept.split(' ')[0]}</CardTitle>
                                <Building2 className="h-4 w-4 text-slate-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-900">{count}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="glass-card border-none shadow-2xl overflow-hidden">
                <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 px-6 py-6 border-slate-100">
                    <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-indigo-600" />
                        Directory
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        Comprehensive list of all platform operators
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
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Emp ID</th>
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
                                            <td className="p-4 align-middle font-medium flex items-center gap-2">
                                                {user.role === 'admin' ? (
                                                    <span className="text-amber-500 mr-2">🛡️</span>
                                                ) : (
                                                    <span className="text-muted-foreground mr-2">👤</span>
                                                )}
                                                {user.name}
                                            </td>
                                            <td className="p-4 align-middle font-mono text-xs">{user.email}</td>
                                            <td className="p-4 align-middle font-mono text-xs">{user.employeeId || '-'}</td>
                                            <td className="p-4 align-middle text-xs">
                                                {user.department ? (
                                                    <Badge variant="outline" className="font-normal bg-muted/50">{user.department}</Badge>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 align-middle capitalize">
                                                <Badge className={cn(
                                                    "uppercase text-[10px] font-black tracking-widest px-3 py-1 rounded-lg",
                                                    user.role === 'admin'
                                                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                        : 'bg-stone-100 text-stone-600 border-stone-200'
                                                )}>
                                                    <ShieldIcon className="mr-1 h-3 w-3" />
                                                    {user.role}
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
                                                            onClick={() => setEditUser(user)}
                                                            className="text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors font-bold"
                                                        >
                                                            <span>Edit</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            disabled={isPending}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <span>Delete</span>
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-4 text-center text-muted-foreground">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update name, email, or reset password for {editUser?.name}.
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
                                    {DEPARTMENTS.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <select
                                    id="edit-role"
                                    name="role"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue={editUser.role || 'user'}
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <span className="mr-2 h-4 w-4 animate-spin inline-block border-2 border-current border-t-transparent rounded-full" />}
                                    Update User
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
