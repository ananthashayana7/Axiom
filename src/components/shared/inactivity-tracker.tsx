'use client';

import { useEffect, useRef, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function InactivityTracker({ timeoutMinutes = 30 }: { timeoutMinutes?: number }) {
    const { data: session } = useSession();
    const router = useRouter();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isPromptedRef = useRef(false);

    const handleLogout = useCallback(async () => {
        if (isPromptedRef.current) return;
        isPromptedRef.current = true;
        toast.warning("Session Expired", {
            description: "You have been logged out due to inactivity.",
            duration: Infinity,
            action: {
                label: "Login Again",
                onClick: () => router.push('/login')
            }
        });
        await signOut({ redirect: true, callbackUrl: '/login' });
    }, [router]);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (session && !isPromptedRef.current) {
            timeoutRef.current = setTimeout(() => {
                handleLogout();
            }, timeoutMinutes * 60 * 1000);
        }
    }, [session, timeoutMinutes, handleLogout]);

    useEffect(() => {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

        const handler = () => resetTimeout();

        if (session) {
            events.forEach(event => document.addEventListener(event, handler));
            resetTimeout();
        }

        return () => {
            events.forEach(event => document.removeEventListener(event, handler));
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [session, resetTimeout]);

    return null;
}
