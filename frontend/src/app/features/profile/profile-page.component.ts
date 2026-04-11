import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProfileDeckListComponent } from './profile-deck-list.component';
import { ProfileHeaderComponent } from './profile-header.component';
import { ProfileResponse, ProfileService, ProfileDeckSummary } from './profile.service';

interface StoredUser {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  friendTag?: string | null;
  token?: string;
  createdAt?: string | null;
  role?: string | null;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileHeaderComponent, ProfileDeckListComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<ProfileResponse | null>(null);
  readonly decks = signal<ProfileDeckSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly currentTarget = signal<string>('me');
  readonly storedUser = signal<StoredUser | null>(this.readStoredUser());

  readonly showPrivateDetails = computed(() => {
    const profile = this.profile();
    const storedUser = this.storedUser();
    const currentTarget = this.currentTarget();

    if (!profile || !storedUser) {
      return currentTarget === 'me';
    }

    return currentTarget === 'me' || storedUser.id === profile.id;
  });

  private activeRequest: Subscription | null = null;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const target = params.get('userId') || 'me';
      this.currentTarget.set(target);
      this.loadProfile(target);
    });
  }

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  private loadProfile(target: string): void {
    this.activeRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.profile.set(null);
    this.decks.set([]);

    if (target === 'me' && !localStorage.getItem('token')) {
      this.loading.set(false);
      this.error.set('Necesitas iniciar sesión para ver tu perfil.');
      return;
    }

    if (target !== 'me' && !/^\d+$/.test(target)) {
      this.loading.set(false);
      this.error.set('El identificador de usuario no es valido. Usa /profile/me/decks o /profile/{id}/decks con un id numerico.');
      return;
    }

    this.activeRequest = forkJoin({
      profile: this.profileService.getProfile(target),
      decks: this.profileService.getDecks(target),
    }).subscribe({
      next: ({ profile, decks }) => {
        this.profile.set(profile);
        this.decks.set(decks);
        this.loading.set(false);
        this.syncStoredUser(profile);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.resolveErrorMessage(err?.status));
      },
    });
  }

  private syncStoredUser(profile: ProfileResponse): void {
    const storedUser = this.storedUser();
    if (!storedUser) {
      return;
    }

    if (storedUser.id === profile.id || this.currentTarget() === 'me') {
      this.storedUser.set({
        ...storedUser,
        username: profile.username,
        displayName: profile.displayName ?? storedUser.displayName,
        friendTag: profile.friendTag ?? storedUser.friendTag,
      });
    }
  }

  private readStoredUser(): StoredUser | null {
    const raw = localStorage.getItem('user');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  }

  private resolveErrorMessage(status?: number): string {
    if (status === 401) {
      return 'Necesitas iniciar sesión para ver tu perfil.';
    }

    if (status === 404) {
      return 'El perfil solicitado no existe.';
    }

    return 'No se pudo cargar el perfil en este momento.';
  }
}
