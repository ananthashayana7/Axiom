'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Loader2, Eye, EyeOff } from "lucide-react";
import { changePassword, updateProfile } from "@/app/actions/auth";

interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    createdAt: Date | null;
}

interface ProfileClientProps {
    user: User;
}

export default function ProfileClient({ user }: ProfileClientProps) {
    const [isPending, startTransition] = useTransition();
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleUpdateProfile = async (formData: FormData) => {
        startTransition(async () => {
            const result = await updateProfile(formData);
            if (result.success) {
                setProfileMessage({ type: 'success', text: result.message || 'Profile updated successfully' });
            } else {
                setProfileMessage({ type: 'error', text: result.error || 'Failed to update profile' });
            }
            setTimeout(() => setProfileMessage(null), 3000);
        });
    };

    const handleChangePassword = async (formData: FormData) => {
        const currentPassword = formData.get('currentPassword') as string;
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        // Client-side validation
        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
            setTimeout(() => setPasswordMessage(null), 3000);
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
            setTimeout(() => setPasswordMessage(null), 3000);
            return;
        }

        startTransition(async () => {
            const result = await changePassword(currentPassword, newPassword);
            if (result.success) {
                setPasswordMessage({ type: 'success', text: result.message || 'Password changed successfully' });
                // Clear form
                const form = document.getElementById('password-form') as HTMLFormElement;
                if (form) form.reset();
            } else {
                setPasswordMessage({ type: 'error', text: result.error || 'Failed to change password' });
            }
            setTimeout(() => setPasswordMessage(null), 3000);
        });
    };

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="max-w-4xl w-full mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                    <p className="text-muted-foreground mt-1">Manage your account settings and password.</p>
                </div>

                {/* User Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {user.role === 'admin' ? (
                                <Shield className="h-5 w-5 text-amber-500" />
                            ) : (
                                <User className="h-5 w-5 text-muted-foreground" />
                            )}
                            User Information
                        </CardTitle>
                        <CardDescription>Your account details and role</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                                <p className="font-medium">{user.name}</p>
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                                <p className="font-medium">{user.email}</p>
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                                <div className="mt-1">
                                    <Badge className={
                                        user.role === 'admin' 
                                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-50' 
                                            : 'bg-blue-50 text-blue-700 hover:bg-blue-50'
                                    }>
                                        {user.role}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
                                <p className="font-medium">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Update Profile Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Update Profile</CardTitle>
                        <CardDescription>Update your name and email address</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={handleUpdateProfile} className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" name="name" defaultValue={user.name} required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" defaultValue={user.email} required />
                            </div>
                            {profileMessage && (
                                <div className={`p-3 rounded-md text-sm ${
                                    profileMessage.type === 'success' 
                                        ? 'bg-green-50 text-green-700 border border-green-200' 
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {profileMessage.text}
                                </div>
                            )}
                            <div className="flex justify-end">
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Profile
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Change Password Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>Update your account password</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form id="password-form" action={handleChangePassword} className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <div className="relative">
                                    <Input
                                        id="currentPassword"
                                        name="currentPassword"
                                        type={showCurrentPassword ? "text" : "password"}
                                        className="pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        name="newPassword"
                                        type={showNewPassword ? "text" : "password"}
                                        className="pr-10"
                                        minLength={6}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    minLength={6}
                                    required
                                />
                            </div>
                            {passwordMessage && (
                                <div className={`p-3 rounded-md text-sm ${
                                    passwordMessage.type === 'success' 
                                        ? 'bg-green-50 text-green-700 border border-green-200' 
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {passwordMessage.text}
                                </div>
                            )}
                            <div className="flex justify-end">
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Change Password
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
