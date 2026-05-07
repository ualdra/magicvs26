import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProfileDeckListComponent } from './profile-deck-list.component';
import { ProfileHeaderComponent } from './profile-header.component';
import { ProfileResponse, ProfileService, ProfileDeckSummary } from './profile.service';
import { UserService } from '../../core/services/user.service';
import { AchievementService } from '../../core/services/achievement.service';
import { UserAchievement } from '../../models/achievement.model';

interface StoredUser {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  profileTitle?: string | null;
  friendTag?: string | null;
  token?: string;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileHeaderComponent, ProfileDeckListComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly profileService = inject(ProfileService);
  private readonly userService = inject(UserService);
  private readonly achievementService = inject(AchievementService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<ProfileResponse | null>(null);
  readonly decks = signal<ProfileDeckSummary[]>([]);
  readonly achievements = signal<UserAchievement[]>([]);
  readonly unlockedAchievementTitles = computed(() => this.achievements()
    .filter((achievement) => achievement.unlocked)
    .map((achievement) => achievement.achievement.name));
  readonly totalAchievements = signal(0);
  readonly achievementsLoading = signal(false);
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

  logout(): void {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    if (token) {
      this.userService.logout(token).subscribe();
    }
    this.router.navigateByUrl('/');
  }

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

    this.achievementsLoading.set(true);

    this.activeRequest = forkJoin({
      profile: this.profileService.getProfile(target),
      decks: this.profileService.getDecks(target),
    }).subscribe({
      next: ({ profile, decks }) => {
        this.profile.set(profile);
        this.decks.set(decks);
        this.loading.set(false);
        this.syncStoredUser(profile);
        this.loadAchievements(target, profile.id);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.resolveErrorMessage(err?.status));
      },
    });
  }

  loadAchievementsPublic(target: string, profileId: number): void {
    this.loadAchievements(target, profileId);
  }

  private loadAchievements(target: string, profileId: number): void {
    const userAchievements$ = target === 'me'
      ? this.achievementService.getMyAchievements()
      : this.achievementService.getUserAchievements(profileId);

    forkJoin({
      all: this.achievementService.getAllAchievements(),
      mine: userAchievements$,
    }).subscribe({
      next: ({ all, mine }) => {
        this.totalAchievements.set(all.length);
        this.achievements.set(mine);
        this.achievementsLoading.set(false);
      },
      error: () => this.achievementsLoading.set(false),
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
        profileTitle: profile.profileTitle ?? storedUser.profileTitle,
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
