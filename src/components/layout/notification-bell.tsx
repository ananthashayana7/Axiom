'use client'

import { useState, useEffect } from "react";
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/app/actions/notifications";
import Link from "next/link";

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error' | null;
    isRead: string | null;
    link: string | null;
    createdAt: Date | null;
}

export function NotificationBell() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const unreadCount = notifications.filter(n => n.isRead === 'no').length;

    const fetchNotifications = async () => {
        const data = await getNotifications();
        setNotifications(data as Notification[]);
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await markNotificationAsRead(id);
        setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: 'yes' } : n));
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsAsRead();
        setNotifications(notifications.map(n => ({ ...n, isRead: 'yes' })));
    };

    const getIcon = (type: string | null) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
            case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className={`relative rounded-full hover:bg-muted transition-all ${open ? 'bg-muted' : ''}`}
                onClick={() => setOpen(!open)}
            >
                <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'text-primary animate-ring' : 'text-muted-foreground'}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                )}
            </Button>

            {open && (
                <Card className="absolute right-0 mt-3 w-96 z-50 shadow-2xl border-accent/40 bg-background/95 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
                    <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Alerts & Notifications</CardTitle>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase hover:text-primary" onClick={handleMarkAllRead}>
                                Mark all read
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
                                <Bell className="h-10 w-10 text-muted-foreground/20" />
                                <p className="text-sm font-bold text-muted-foreground">All caught up!</p>
                                <p className="text-xs text-muted-foreground/60">No new alerts at this time.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`p-5 hover:bg-muted/50 transition-all cursor-pointer group ${n.isRead === 'no' ? 'bg-primary/5' : ''}`}
                                        onClick={() => n.link && router.push(n.link)}
                                    >
                                        <div className="flex gap-4">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${n.isRead === 'no' ? 'bg-background border-primary/20 shadow-sm' : 'bg-muted/50 border-transparent'
                                                }`}>
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className={`text-sm font-bold truncate ${n.isRead === 'no' ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                                                    {n.isRead === 'no' && (
                                                        <button
                                                            onClick={(e) => handleMarkRead(n.id, e)}
                                                            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                            title="Mark as read"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className={`text-xs mt-1 leading-relaxed ${n.isRead === 'no' ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                                                    {n.message}
                                                </p>
                                                <div className="flex items-center gap-3 mt-3">
                                                    <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-tighter">
                                                        {n.createdAt ? getTimeAgo(new Date(n.createdAt)) : ''}
                                                    </p>
                                                    {n.link && (
                                                        <span className="text-[10px] font-black text-primary uppercase flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            View Details <ExternalLink className="h-2 w-2" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    {notifications.length > 0 && (
                        <CardFooter className="py-3 px-6 border-t bg-muted/20 flex justify-center">
                            <Link href="/admin/activity" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                                View Full Audit History
                            </Link>
                        </CardFooter>
                    )}
                </Card>
            )}
        </div>
    );
}

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}
