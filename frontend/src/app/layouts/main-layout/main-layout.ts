import { Component, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { NgIf } from '@angular/common';
import { filter } from 'rxjs/operators';

interface StoredUser {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  friendTag?: string;
  token?: string;
}

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  isLoggedIn = false;
  displayName: string | null = null;
  friendTag: string | null = null;

  constructor(private router: Router) {
    this.isLoggedIn = !!localStorage.getItem('user');
    this.loadUserFromStorage();

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
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.isLoggedIn = false;
    // redirect to public home (not login)
    this.router.navigateByUrl('/');
  }

  private loadUserFromStorage(): void {
    const raw = localStorage.getItem('user');
    if (!raw) {
      this.displayName = null;
      this.friendTag = null;
      return;
    }
    try {
      const u = JSON.parse(raw) as StoredUser;
      this.displayName = u.displayName ?? u.username;
      this.friendTag = u.friendTag ?? null;
    } catch {
      this.displayName = null;
      this.friendTag = null;
    }
  }
}
