import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { FriendshipService } from '../../../core/services/friendship.service';
import { User } from '../../../models/user.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private friendshipService = inject(FriendshipService);
  private location = inject(Location);

  user = signal<User | null>(null);
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

    this.userService.getUserProfile(id).subscribe({
      next: (data) => {
        this.user.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading user profile:', err);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  toggleFollow(userId: number): void {
    if (userId === this.currentUserId()) return;
    this.friendshipService.toggleFollow(userId);
  }

  isFollowing(userId: number): boolean {
    return this.friendshipService.isFollowing(userId);
  }
}
