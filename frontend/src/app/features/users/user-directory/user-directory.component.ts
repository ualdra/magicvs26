import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { PublicUser } from '../../../models/user.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-user-directory',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent],
  templateUrl: './user-directory.component.html',
  styleUrl: './user-directory.component.scss'
})
export class UserDirectoryComponent implements OnInit {
  private userService = inject(UserService);

  users = signal<PublicUser[]>([]);
  isLoading = signal(true);
  hasError = signal(false);
  currentUserId = signal<number | null>(null);

  // Filters & Sorting
  searchTerm = signal('');
  sortBy = signal<'username' | 'elo'>('elo');
  sortOrder = signal<'asc' | 'desc'>('desc');
  
  // Mock Friendship state (Visual only)
  followedUsers = signal<Set<number>>(new Set());

  filteredUsers = computed(() => {
    let list = [...this.users()];
    const search = this.searchTerm().toLowerCase().trim();

    // Filter by search term
    if (search) {
      list = list.filter(u => u.username.toLowerCase().includes(search));
    }

    // Sort users
    list.sort((a, b) => {
      const field = this.sortBy();
      const order = this.sortOrder();

      let valA = field === 'username' ? a.username.toLowerCase() : a.elo;
      let valB = field === 'username' ? b.username.toLowerCase() : b.elo;

      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;

      // Tie-breaker: sort by username ASC if ELO is the same
      if (field === 'elo') {
        const nameA = a.username.toLowerCase();
        const nameB = b.username.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
      }

      return 0;
    });

    return list;
  });

  ngOnInit(): void {
    this.loadUsers();
    this.loadCurrentUserId();
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

  loadUsers(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.userService.getUsers().subscribe({
      next: (data) => {
        console.log('Users data:', data);
        console.log('Sample user isOnline values:', data.slice(0, 3).map(u => ({ username: u.username, isOnline: u.isOnline, type: typeof u.isOnline })));
        this.users.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  toggleSortOrder(): void {
    this.sortOrder.update(current => current === 'asc' ? 'desc' : 'asc');
  }

  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as 'username' | 'elo');
  }

  toggleFollow(userId: number): void {
    this.followedUsers.update(set => {
      const newSet = new Set(set);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }

  isFollowing(userId: number): boolean {
    return this.followedUsers().has(userId);
  }
}
