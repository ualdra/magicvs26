import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AppNotification, NotificationPageResponse, ToastNotification, NotificationType } from '../../models/notification.model';

import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = 'http://localhost:8080/api/notifications';
  private eventSource: EventSource | null = null;
  private reconnectTimer: number | null = null;

  private notificationsSignal = signal<AppNotification[]>([]);
  private unreadCountSignal = signal<number>(0);
  private toastsSignal = signal<ToastNotification[]>([]);
  private dropdownOpenSignal = signal<boolean>(false);

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = this.unreadCountSignal.asReadonly();
  readonly toasts = this.toastsSignal.asReadonly();
  readonly dropdownOpen = this.dropdownOpenSignal.asReadonly();

  // Observable for legacy or simplified subscriptions
  readonly notifications$ = new BehaviorSubject<AppNotification[]>([]);

  constructor(private readonly http: HttpClient) {
    this.notifications$.next(this.notificationsSignal());
  }

  // Update signal helper (private)
  private updateNotifications(newList: AppNotification[]) {
    this.notificationsSignal.set(newList);
    this.notifications$.next(newList);
  }

  initForCurrentUser(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.disconnect();
      this.notificationsSignal.set([]);
      this.unreadCountSignal.set(0);
      this.toastsSignal.set([]);
      return;
    }

    this.loadNotifications();
    this.connect(token);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  loadNotifications(page: number = 0, size: number = 20): void {
    this.http
      .get<NotificationPageResponse>(`${this.apiUrl}?page=${page}&size=${size}`, { headers: this.authHeaders() })
      .subscribe({
        next: (response) => {
          this.updateNotifications(response.content ?? []);
          this.unreadCountSignal.set(response.unreadCount ?? 0);
        },
        error: () => {
          // Silent fail to avoid UI noise on initial paint.
        }
      });
  }

  markAsRead(notificationId: number): void {
    this.http.patch<AppNotification>(`${this.apiUrl}/${notificationId}/read`, {}, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.updateNotifications(
          this.notificationsSignal().map((item) => (item.id === notificationId ? { ...item, unread: false, readAt: new Date().toISOString() } : item))
        );

        this.unreadCountSignal.update((count) => Math.max(0, count - 1));
      }
    });
  }

  markAllAsRead(): void {
    this.http.patch<{ updated: number }>(`${this.apiUrl}/read-all`, {}, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.updateNotifications(this.notificationsSignal().map((item) => ({ ...item, unread: false, readAt: item.readAt ?? new Date().toISOString() })));
        this.unreadCountSignal.set(0);
      }
    });
  }

  deleteNotification(notificationId: number): void {
    this.http.delete<void>(`${this.apiUrl}/${notificationId}`, { headers: this.authHeaders() }).subscribe({
      next: () => {
        const target = this.notificationsSignal().find((item) => item.id === notificationId);
        this.updateNotifications(this.notificationsSignal().filter((item) => item.id !== notificationId));
        this.toastsSignal.update((items) => items.filter((item) => item.id !== notificationId));

        if (target?.unread) {
          this.unreadCountSignal.update((count) => Math.max(0, count - 1));
        }
      }
    });
  }

  deleteAllNotifications(): void {
    this.http.delete<{ deleted: number }>(this.apiUrl, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.notificationsSignal.set([]);
        this.toastsSignal.set([]);
        this.unreadCountSignal.set(0);
      }
    });
  }

  setDropdownOpen(open: boolean): void {
    this.dropdownOpenSignal.set(open);
  }

  toggleDropdown(): void {
    this.dropdownOpenSignal.update((open) => !open);
  }

  dismissToast(toastId: number): void {
    this.toastsSignal.update((items) => items.filter((item) => item.id !== toastId));
  }

  showToast(title: string, message: string, type: string = 'SYSTEM'): void {
    const id = Date.now();
    const toast: ToastNotification = { id, title, message, type: type as NotificationType };
    this.toastsSignal.update((items) => [toast, ...items].slice(0, 4));
    window.setTimeout(() => this.dismissToast(id), 4000);
  }

  private connect(token: string): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const streamUrl = `${this.apiUrl}/stream?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(streamUrl);

    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      const incoming = JSON.parse(event.data) as AppNotification;

      this.updateNotifications([incoming, ...this.notificationsSignal()].slice(0, 50));

      if (incoming.unread) {
        this.unreadCountSignal.update((count) => count + 1);
      }

      if (document.visibilityState === 'visible') {
        this.pushToast(incoming);
      }
    });

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      const token = localStorage.getItem('token');
      if (token) {
        this.connect(token);
      }
    }, 5000);
  }

  private pushToast(notification: AppNotification): void {
    const toast: ToastNotification = {
      id: notification.id,
      title: this.titleFor(notification),
      message: this.messageFor(notification),
      type: notification.type,
      link: typeof notification.data?.link === 'string' ? notification.data.link : undefined
    };

    this.toastsSignal.update((items) => [toast, ...items].slice(0, 4));
    window.setTimeout(() => this.dismissToast(toast.id), 4600);
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private titleFor(notification: AppNotification): string {
    if (typeof notification.data?.title === 'string' && notification.data.title.trim().length) {
      return notification.data.title;
    }

    switch (notification.type) {
      case 'FRIEND_REQUEST':
        return 'Nueva solicitud de amistad';
      case 'NEW_MESSAGE':
        return 'Nuevo mensaje';
      case 'BATTLE_INVITE':
        return 'Invitación a batalla';
      case 'MATCH_FOUND':
        return '¡Vámonos a la Arena!';
      default:
        return 'Notificación';
    }
  }

  private messageFor(notification: AppNotification): string {
    if (typeof notification.data?.message === 'string' && notification.data.message.trim().length) {
      return notification.data.message;
    }

    switch (notification.type) {
      case 'FRIEND_REQUEST':
        return 'Tienes una nueva solicitud pendiente.';
      case 'NEW_MESSAGE':
        return 'Han respondido en tu chat.';
      case 'BATTLE_INVITE':
        return 'Un jugador te ha retado a duelo.';
      case 'MATCH_FOUND':
        return 'Se ha encontrado un rival de tu nivel. ¡Mucha suerte!';
      default:
        return 'Tienes actividad reciente en MagicVS.';
    }
  }
}
