'use client';

import { useEffect, useRef } from 'react';

function showBrowserNotification(title: string, options: NotificationOptions) {
    if (document.visibilityState === 'visible') {
        return;
    }
    
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            ...options,
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

export function useBrowserNotifier(
    unreadMessagesCount: number,
    unreadNotificationsCount: number
) {
    const prevUnreadMessages = useRef(unreadMessagesCount);
    const prevUnreadNotifications = useRef(unreadNotificationsCount);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }
    }, []);

    useEffect(() => {
        if (unreadMessagesCount > prevUnreadMessages.current) {
            showBrowserNotification('Pesan Baru di Elitera', {
                body: 'Anda memiliki pesan baru yang belum dibaca.',
                tag: 'new-message',
            });
        }
        prevUnreadMessages.current = unreadMessagesCount;
    }, [unreadMessagesCount]);

    useEffect(() => {
        if (unreadNotificationsCount > prevUnreadNotifications.current) {
            showBrowserNotification('Notifikasi Baru di Elitera', {
                body: 'Anda memiliki notifikasi baru.',
                tag: 'new-notification',
            });
        }
        prevUnreadNotifications.current = unreadNotificationsCount;
    }, [unreadNotificationsCount]);
}
