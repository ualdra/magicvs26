import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ProfileService, ProfileResponse } from '../../features/profile/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification, ToastNotification } from '../../models/notification.model';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { UserService } from '../../core/services/user.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { ToastService } from '../../core/services/toast.service';
import { ArenaService } from '../../core/services/arena.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastComponent, ConfirmDialogComponent],
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
  isBattleActive = false;

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
  private readonly friendshipService = inject(FriendshipService);
  private readonly toastService = inject(ToastService);
  private readonly arenaService = inject(ArenaService);

  constructor(private router: Router) {
    this.isLoggedIn = !!localStorage.getItem('user');
    this.loadUserFromStorage();

    // Listen to real-time updates from ProfileService
    this.profileService.profileUpdated$.subscribe((updated: ProfileResponse) => {
      this.isLoggedIn = !!localStorage.getItem('user');
      this.loadUserFromStorage();
      this.initializeNotifications();
    });

    // Re-check login state after every navigation
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.isLoggedIn = !!localStorage.getItem('user');
        this.loadUserFromStorage();
        this.initializeNotifications();
        this.isBattleActive = this.router.url.startsWith('/battle');
        this.updateLayoutClasses();
      });

    this.isBattleActive = this.router.url.startsWith('/battle');
    this.initializeNotifications();
    this.setupMatchmakingListener();
    this.updateLayoutClasses();
  }

  private updateLayoutClasses(): void {
    if (this.isBattleActive) {
      document.body.classList.add('in-battle');
    } else {
      document.body.classList.remove('in-battle');
    }
  }

  private setupMatchmakingListener(): void {
    // Listen for new notifications to see if a match was found while searching
    this.notificationService.notifications$.subscribe(notifications => {
      const matchFound = notifications.find(n => n.type === 'MATCH_FOUND' && n.unread);
      if (matchFound) {
        const matchId = matchFound.data?.['matchId'];
        if (matchId) {
          this.notificationService.markAsRead(matchFound.id);
          this.toastService.show('¡Partida encontrada! Entrando...', 'success');
          this.router.navigateByUrl(`/battle/${matchId}`);
        }
      }
    });
  }

  get isBattleRoute(): boolean {
    return this.router.url.startsWith('/battle');
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

  acceptFriendRequest(notification: AppNotification): void {
    const senderId = notification.data?.['senderId'];
    if (!senderId) return;

    this.friendshipService.acceptRequest(Number(senderId)).subscribe({
      next: () => {
        this.toastService.show('¡Ahora sois amigos!', 'success');
        this.notificationService.deleteNotification(notification.id);
      },
      error: () => this.toastService.show('Error al aceptar solicitud', 'error')
    });
  }

  rejectFriendRequest(notification: AppNotification): void {
    const senderId = notification.data?.['senderId'];
    if (!senderId) return;

    this.friendshipService.rejectRequest(Number(senderId)).subscribe({
      next: () => {
        this.toastService.show('Solicitud rechazada', 'info');
        this.notificationService.deleteNotification(notification.id);
      },
      error: () => this.toastService.show('Error al rechazar solicitud', 'error')
    });
  }

  acceptBattleInvite(notification: AppNotification): void {
    const matchId = notification.data?.['matchId'];
    if (matchId) {
      this.arenaService.acceptInvite(Number(matchId)).subscribe({
        next: () => {
          this.toastService.show('¡Desafío aceptado! Entrando a la arena...', 'success');
          this.notificationService.deleteNotification(notification.id);
          this.router.navigateByUrl(`/battle/${matchId}`);
        },
        error: () => this.toastService.show('Error al aceptar la invitación', 'error')
      });
    } else {
      this.toastService.show('¡Desafío aceptado! Buscando mesa...', 'success');
      this.notificationService.deleteNotification(notification.id);
      this.router.navigateByUrl('/arena');
    }
  }

  rejectBattleInvite(notification: AppNotification): void {
    this.toastService.show('Desafío rechazado', 'info');
    this.notificationService.deleteNotification(notification.id);
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
      case 'MATCH_FOUND':
        return 'arena';
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
