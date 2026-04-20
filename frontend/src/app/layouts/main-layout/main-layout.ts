import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ProfileService, ProfileResponse } from '../../features/profile/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification, ToastNotification } from '../../models/notification.model';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { UserService } from '../../core/services/user.service';

interface StoredUser {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  friendTag?: string;
  token?: string;
  isOnline?: boolean;
}

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  isLoggedIn = false;
  displayName: string | null = null;
  friendTag: string | null = null;
  avatarUrl: string | null = null;
  manaColor: { name: string; color: string; code: string } | null = null;
  isOnline = false;

  private readonly manaColors = [
    { name: 'Blanco', code: 'W', color: 'f0f2f0' },
    { name: 'Azul', code: 'U', color: '0e68ab' },
    { name: 'Negro', code: 'B', color: '150b00' },
    { name: 'Rojo', code: 'R', color: 'd3202a' },
    { name: 'Verde', code: 'G', color: '00733e' }
  ];

  private readonly profileService = inject(ProfileService);
  private readonly notificationService = inject(NotificationService);
  private readonly userService = inject(UserService);

  constructor(private router: Router) {
    this.isLoggedIn = !!localStorage.getItem('user');
    this.loadUserFromStorage();

    // Listen to real-time updates from ProfileService
    this.profileService.profileUpdated$.subscribe((updated: ProfileResponse) => {
      this.isLoggedIn = !!localStorage.getItem('user');
      this.loadUserFromStorage();
      this.initializeNotifications();
    });

    // Re-check login state after every navigation (e.g. after login redirects to /)
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.isLoggedIn = !!localStorage.getItem('user');
        this.loadUserFromStorage();
        this.initializeNotifications();
      });

    this.initializeNotifications();
  }

    goHome(): void {
      this.router.navigateByUrl('/');
    }

  logout(): void {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    this.isLoggedIn = false;
    this.notificationService.disconnect();
    this.notificationService.setDropdownOpen(false);
    // redirect to public home (not login)
    this.isOnline = false;
    this.displayName = null;
    this.friendTag = null;
    this.avatarUrl = null;
    this.manaColor = null;
    if (token) {
      this.userService.logout(token).subscribe();
    }
    this.router.navigateByUrl('/');
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.toggleDropdown();
  }

  markAllNotificationsAsRead(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead();
  }

  deleteAllNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.deleteAllNotifications();
  }

  openNotification(notification: AppNotification): void {
    if (notification.unread) {
      this.notificationService.markAsRead(notification.id);
    }

    const target = typeof notification.data?.link === 'string' && notification.data.link.trim().length
      ? notification.data.link
      : '/';

    this.notificationService.setDropdownOpen(false);
    this.router.navigateByUrl(target);
  }

  deleteNotification(event: MouseEvent, notificationId: number): void {
    event.stopPropagation();
    this.notificationService.deleteNotification(notificationId);
  }

  dismissToast(toastId: number): void {
    this.notificationService.dismissToast(toastId);
  }

  notificationIcon(type: string): string {
    switch (type) {
      case 'FRIEND_REQUEST':
        return 'group_add';
      case 'NEW_MESSAGE':
        return 'chat';
      case 'BATTLE_INVITE':
        return 'sports_martial_arts';
      default:
        return 'notifications';
    }
  }

  notificationTitle(notification: AppNotification): string {
    const rawTitle = notification.data?.title;
    if (typeof rawTitle === 'string' && rawTitle.trim().length) {
      return rawTitle;
    }

    switch (notification.type) {
      case 'FRIEND_REQUEST':
        return 'Solicitud de amistad';
      case 'NEW_MESSAGE':
        return 'Nuevo mensaje';
      case 'BATTLE_INVITE':
        return 'Invitación a batalla';
      default:
        return 'Notificación';
    }
  }

  notificationMessage(notification: AppNotification): string {
    const rawMessage = notification.data?.message;
    if (typeof rawMessage === 'string' && rawMessage.trim().length) {
      return rawMessage;
    }

    return 'Tienes una actualización pendiente en MagicVS.';
  }

  toastTitle(toast: ToastNotification): string {
    return toast.title;
  }

  toastMessage(toast: ToastNotification): string {
    return toast.message;
  }

  get notifications(): AppNotification[] {
    return this.notificationService.notifications();
  }

  get unreadNotificationCount(): number {
    return this.notificationService.unreadCount();
  }

  get isNotificationDropdownOpen(): boolean {
    return this.notificationService.dropdownOpen();
  }

  get toasts(): ToastNotification[] {
    return this.notificationService.toasts();
  }

  @HostListener('document:click')
  closeNotificationsOnOutsideClick(): void {
    this.notificationService.setDropdownOpen(false);
  }

  private loadUserFromStorage(): void {
    const raw = localStorage.getItem('user');
    if (!raw) {
      this.displayName = null;
      this.friendTag = null;
      this.avatarUrl = null;
      this.manaColor = null;
      this.isOnline = false;
      return;
    }
    try {
      const u = JSON.parse(raw) as StoredUser;
      
      // Basic info
      const rawName = (u.displayName ?? u.username) as string | undefined;
      if (rawName) {
        const cleaned = rawName.replace(/\u00A0/g, ' ').trim();
        this.displayName = cleaned || (u.username ?? null);
      } else {
        this.displayName = u.username ?? null;
      }
      this.friendTag = (u.friendTag ?? null)?.toString() ?? null;
      this.isOnline = u.isOnline ?? false;

      // Magic Metadata
      this.avatarUrl = u.avatarUrl ?? null;
      if (this.avatarUrl && (this.avatarUrl.includes('?m=') || this.avatarUrl.includes('#'))) {
        const separator = this.avatarUrl.includes('?m=') ? '?m=' : '#';
        const code = this.avatarUrl.split(separator)[1];
        this.manaColor = this.manaColors.find(c => c.code === code) || null;
      } else {
        this.manaColor = null;
      }

    } catch {
      this.displayName = null;
      this.friendTag = null;
      this.avatarUrl = null;
      this.manaColor = null;
      this.isOnline = false;
    }
  }

  private initializeNotifications(): void {
    if (this.isLoggedIn) {
      this.notificationService.initForCurrentUser();
      return;
    }

    this.notificationService.disconnect();
  }

  getInitials(): string {
    const source = this.displayName || 'U';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}
