import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { FriendshipService } from '../../../core/services/friendship.service';
import { ProfileService, ProfileResponse, ProfileDeckSummary } from '../../profile/profile.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private profileService = inject(ProfileService);
  private friendshipService = inject(FriendshipService);
  private toastService = inject(ToastService);
  private location = inject(Location);

  user = signal<ProfileResponse | null>(null);
  decks = signal<ProfileDeckSummary[]>([]);
  isLoading = signal(true);
  hasError = signal(false);
  currentUserId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadCurrentUserId();
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadProfile(id);
      }
    });
  }

  loadCurrentUserId(): void {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        this.currentUserId.set(u.id);
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
  }

  loadProfile(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    // Load both profile information and decks
    this.profileService.getProfile(id).subscribe({
      next: (profileData) => {
        this.user.set(profileData);
        // Once profile is loaded, load decks
        this.profileService.getDecks(id).subscribe({
          next: (deckData) => {
            this.decks.set(deckData);
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('Error loading user decks:', err);
            // We don't fail the whole page just for decks
            this.isLoading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error loading user profile:', err);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  get winRate(): number {
    const p = this.user();
    if (!p || !p.gamesPlayed) return 0;
    return Math.round(((p.gamesWon || 0) / p.gamesPlayed) * 100);
  }

  goBack(): void {
    this.location.back();
  }

  toggleFollow(userId: number): void {
    if (!this.currentUserId()) {
      this.toastService.show('Debes iniciar sesión para seguir a otros invocadores', 'info');
      return;
    }
    if (userId === this.currentUserId()) return;
    this.friendshipService.toggleFollow(userId);
  }

  isFollowing(userId: number): boolean {
    return this.friendshipService.isFollowing(userId);
  }

  getColorName(code: string): string {
    const names: Record<string, string> = {
      'W': 'Blanco',
      'U': 'Azul',
      'B': 'Negro',
      'R': 'Rojo',
      'G': 'Verde'
    };
    return names[code] || code;
  }
}
