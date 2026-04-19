import { Component, signal, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ProfileService, ProfileResponse } from '../../features/profile/profile.service';
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
  private readonly userService = inject(UserService);

  constructor(private router: Router) {
    this.isLoggedIn = !!localStorage.getItem('user');
    this.loadUserFromStorage();

    // Listen to real-time updates from ProfileService
    this.profileService.profileUpdated$.subscribe((updated: ProfileResponse) => {
      this.isLoggedIn = !!localStorage.getItem('user');
      this.loadUserFromStorage();
    });

    // Re-check login state after every navigation (e.g. after login redirects to /)
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.isLoggedIn = !!localStorage.getItem('user');
        this.loadUserFromStorage();
      });
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

  getInitials(): string {
    const source = this.displayName || 'U';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}
