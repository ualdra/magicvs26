import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { PublicUser } from '../../../models/user.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ToastService } from '../../../core/services/toast.service';
import { FriendshipService } from '../../../core/services/friendship.service';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-user-directory',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent],
  templateUrl: './user-directory.component.html',
  styleUrl: './user-directory.component.scss'
})
export class UserDirectoryComponent implements OnInit {
  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private friendshipService = inject(FriendshipService);
  private confirmService = inject(ConfirmService);

  users = signal<PublicUser[]>([]);
  isLoading = signal(true);
  hasError = signal(false);
  currentUserId = signal<number | null>(null);

  // Filters & Sorting
  searchTerm = signal('');
  sortBy = signal<'username' | 'elo'>('elo');
  sortOrder = signal<'asc' | 'desc'>('desc');
  
  // No longer using mock followedUsers set

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

  toggleFriendship(user: PublicUser): void {
    if (!this.currentUserId()) {
      this.toastService.show('Debes iniciar sesión para interactuar con otros invocadores', 'info');
      return;
    }
    if (user.id === this.currentUserId()) return;

    const status = user.friendshipStatus || 'NONE';

    if (status === 'NONE') {
      this.friendshipService.sendRequest(user.id).subscribe({
        next: () => {
          this.updateUserStatus(user.id, 'PENDING');
          this.toastService.show('Solicitud de amistad enviada', 'success');
        },
        error: () => this.toastService.show('Error al enviar solicitud', 'error')
      });
    } else if (status === 'PENDING') {
      this.friendshipService.cancelRequest(user.id).subscribe({
        next: () => {
          this.updateUserStatus(user.id, 'NONE');
          this.toastService.show('Solicitud cancelada', 'info');
        },
        error: () => this.toastService.show('Error al cancelar solicitud', 'error')
      });
    } else if (status === 'ACCEPTED') {
      this.confirmService.confirm('¿Estás seguro de que quieres dejar de ser amigos?').then(confirmed => {
        if (confirmed) {
          this.friendshipService.removeFriend(user.id).subscribe({
            next: () => {
              this.updateUserStatus(user.id, 'NONE');
              this.toastService.show('Amistad eliminada', 'info');
            },
            error: () => this.toastService.show('Error al eliminar amigo', 'error')
          });
        }
      });
    }
  }

  private updateUserStatus(userId: number, status: 'NONE' | 'PENDING' | 'ACCEPTED'): void {
    this.users.update(users => users.map(u => u.id === userId ? { ...u, friendshipStatus: status } : u));
  }

  isFollowing(userId: number): boolean {
    const user = this.users().find(u => u.id === userId);
    return user?.friendshipStatus === 'ACCEPTED';
  }
}
