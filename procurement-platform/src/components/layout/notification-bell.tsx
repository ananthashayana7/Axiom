'use client'

import { useState, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNotifications, markNotificationRead } from "@/app/actions/activity";

interface Notification {
    id: string;
    title: string;
    message: string;
    read: string | null;
    createdAt: Date | null;
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const unreadCount = notifications.filter(n => n.read === 'no').length;

    useEffect(() => {
        const fetchNotifications = async () => {
            const data = await getNotifications();
            setNotifications(data as Notification[]);
        };
        fetchNotifications();
        // In a real app, we might poll or use websockets here
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkRead = async (id: string) => {
        await markNotificationRead(id);
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: 'yes' } : n));
    };

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setOpen(!open)}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-600 border-2 border-background" />
                )}
            </Button>

            {open && (
                <Card className="absolute right-0 mt-2 w-80 z-50 shadow-xl border-accent">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm">Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="p-4 text-xs text-center text-muted-foreground">No notifications</p>
                        ) : (
                            <div className="divide-y divide-accent">
                                {notifications.map((n) => (
                                    <div key={n.id} className={`p-4 hover:bg-muted/50 transition-colors ${n.read === 'no' ? 'bg-blue-50/30' : ''}`}>
                                        <div className="flex justify-between gap-2">
                                            <p className={`text-xs font-semibold ${n.read === 'no' ? 'text-blue-700' : ''}`}>{n.title}</p>
                                            {n.read === 'no' && (
                                                <button onClick={() => handleMarkRead(n.id)} className="text-muted-foreground hover:text-primary">
                                                    <Check className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-1">{n.message}</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-2">
                                            {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
