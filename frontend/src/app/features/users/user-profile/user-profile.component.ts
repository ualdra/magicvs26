import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { FriendshipService } from '../../../core/services/friendship.service';
import { ProfileService, ProfileResponse, ProfileDeckSummary } from '../../profile/profile.service';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

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
  private confirmService = inject(ConfirmService);

  user = signal<ProfileResponse | null>(null);
  decks = signal<ProfileDeckSummary[]>([]);
  isLoading = signal(true);
  hasError = signal(false);
  currentUserId = signal<number | null>(null);
  friendshipStatus = signal<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');

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
        
        // Fetch friendship status if logged in and not own profile
        if (this.currentUserId() && this.currentUserId() !== profileData.id) {
          this.friendshipService.getStatus(profileData.id).subscribe({
            next: (resp) => this.friendshipStatus.set(resp.status),
            error: (err) => console.error('Error fetching friendship status:', err)
          });
        }

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
      this.toastService.show('Debes iniciar sesión para interactuar con otros invocadores', 'info');
      return;
    }
    if (userId === this.currentUserId()) return;

    const status = this.friendshipStatus();

    if (status === 'NONE') {
      this.friendshipService.sendRequest(userId).subscribe({
        next: () => {
          this.friendshipStatus.set('PENDING');
          this.toastService.show('Solicitud de amistad enviada', 'success');
        },
        error: () => this.toastService.show('Error al enviar solicitud', 'error')
      });
    } else if (status === 'PENDING') {
      this.friendshipService.cancelRequest(userId).subscribe({
        next: () => {
          this.friendshipStatus.set('NONE');
          this.toastService.show('Solicitud cancelada', 'info');
        },
        error: () => this.toastService.show('Error al cancelar solicitud', 'error')
      });
    } else if (status === 'ACCEPTED') {
      this.confirmService.confirm('¿Estás seguro de que quieres dejar de ser amigos?').then(confirmed => {
        if (confirmed) {
          this.friendshipService.removeFriend(userId).subscribe({
            next: () => {
              this.friendshipStatus.set('NONE');
              this.user.update(u => u ? { ...u, friendsCount: Math.max(0, (u.friendsCount || 0) - 1) } : null);
              this.toastService.show('Amistad eliminada', 'info');
            },
            error: () => this.toastService.show('Error al eliminar amigo', 'error')
          });
        }
      });
    }
  }

  isFollowing(userId: number): boolean {
    // This method is kept for compatibility but logic is now in friendshipStatus
    return this.friendshipStatus() === 'ACCEPTED';
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
