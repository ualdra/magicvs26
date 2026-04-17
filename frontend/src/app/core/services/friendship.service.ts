import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FriendshipService {
  // Mock state: IDs of users being followed
  private _followedUsers = signal<Set<number>>(new Set());

  // Expose follows read-only
  followedUsers = computed(() => this._followedUsers());

  isFollowing(userId: number): boolean {
    return this._followedUsers().has(userId);
  }

  toggleFollow(userId: number): void {
    const current = new Set(this._followedUsers());
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    this._followedUsers.set(current);
  }
}
