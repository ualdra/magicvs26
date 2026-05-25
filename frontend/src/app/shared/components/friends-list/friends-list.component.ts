import { Component, OnInit, ViewChild, ElementRef, inject, HostListener, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { FriendshipService } from '../../../core/services/friendship.service';
import { BlockService } from '../../../core/services/block.service';
import { ToastService } from '../../../core/services/toast.service';
import { MatchService } from '../../../core/services/match.service';

interface Friend {
  id: number;
  username: string;
  displayName: string;
  elo: number;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeenAt: string;
  friendshipStatus: string;
}

@Component({
  selector: 'app-friends-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './friends-list.component.html',
  styleUrl: './friends-list.component.scss'
})
export class FriendsListComponent implements OnInit {
  @ViewChild('dropdownMenu') dropdownMenu!: ElementRef;
  @Output() friendSelected = new EventEmitter<Friend>();

  friends: Friend[] = [];
  onlineFriends: Friend[] = [];
  offlineFriends: Friend[] = [];
  blockedUsers: Array<{ id: number; username: string }> = [];
  blockedIds: number[] = [];
  isLoading = false;
  isDropdownOpen = false;
  filterMode: 'all' | 'online' = 'all';
  searchQuery = '';

  private readonly userService = inject(UserService);
  private readonly friendshipService = inject(FriendshipService);
  private readonly blockService = inject(BlockService);
  private readonly toastService = inject(ToastService);
  private readonly matchService = inject(MatchService);
  private readonly router = inject(Router);

  activeMatchIds: Record<number, string> = {};

  ngOnInit() {
    this.loadFriends();
    this.loadBlockedUsers();
    // Poll active matches periodically
    setInterval(() => this.loadActiveMatches(), 5000);
  }

  loadActiveMatches() {
    if (!this.userService.getStoredUser()?.id) return;
    this.matchService.getActiveFriendsMatches().subscribe({
      next: (matches: any[]) => {
        const newActiveMatches: Record<number, string> = {};
        for (const match of matches) {
          // Si tenemos que matchear por username porque MatchHistoryDto tiene PlayerDto(username, avatarUrl)
          // Necesitamos encontrar el amigo correspondiente.
          // Wait, MatchHistoryDto en backend devuelve el username del player1 y player2.
          const p1 = this.friends.find(f => f.username === match.player1.username);
          if (p1) newActiveMatches[p1.id] = match.id.toString();
          
          if (match.player2) {
            const p2 = this.friends.find(f => f.username === match.player2.username);
            if (p2) newActiveMatches[p2.id] = match.id.toString();
          }
        }
        this.activeMatchIds = newActiveMatches;
      },
      error: () => {} // silent fail for polling
    });
  }

  loadFriends() {
    this.isLoading = true;
    const userId = this.userService.getStoredUser()?.id;

    if (!userId) {
      this.isLoading = false;
      return;
    }

    // Cargar amigos con filtros iniciales (todos, sin límite)
    this.friendshipService.getFriendsOfUser(userId).subscribe({
      next: (friends) => {
        this.friends = friends;
        this.separateOnlineOffline();
        this.loadActiveMatches(); // fetch matches right after friends load
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading friends:', err);
        this.toastService.showError('Error al cargar amigos');
        this.isLoading = false;
      }
    });
  }

  loadBlockedUsers() {
    this.blockService.getBlockedUsers().subscribe({
      next: (blockedUsers) => {
        this.blockedUsers = blockedUsers;
        this.blockedIds = blockedUsers.map((user: any) => user.id);
      },
      error: (err) => {
        console.error('Error loading blocked users:', err);
      }
    });
  }

  separateOnlineOffline() {
    this.onlineFriends = this.friends.filter(f => f.isOnline);
    this.offlineFriends = this.friends.filter(f => !f.isOnline);
  }

  isBlocked(userId: number): boolean {
    return this.blockedIds.includes(userId);
  }

  get filteredFriends(): Friend[] {
    let filtered = this.filterMode === 'online' ? this.onlineFriends : this.friends;

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.username.toLowerCase().includes(query) ||
        f.displayName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.dropdownMenu && !this.dropdownMenu.nativeElement.contains(target)) {
      this.isDropdownOpen = false;
    }
  }

  selectFriend(friend: Friend) {
    this.friendSelected.emit(friend);
    this.isDropdownOpen = false;
  }

  goToProfile(friend: Friend, event: MouseEvent) {
    event.stopPropagation();
    this.isDropdownOpen = false;
    // La navegación ocurre automáticamente por routerLink
  }

  goToChat(friend: Friend, event: MouseEvent) {
    event.stopPropagation();
    this.selectFriend(friend);
    // El parent component (MainLayout) manejará la apertura del chat
  }

  spectateMatch(matchId: string, friendId: number, event: MouseEvent) {
    event.stopPropagation();
    this.isDropdownOpen = false;
    this.router.navigate(['/spectator', matchId], { queryParams: { friendId } });
  }

  blockUser(friend: Friend, event: MouseEvent) {
    event.stopPropagation();

    if (confirm(`¿Estás seguro de que quieres bloquear a ${friend.displayName}? Esto eliminará la amistad.`)) {
      this.blockService.blockUser(friend.id).subscribe({
        next: (response) => {
          this.toastService.showSuccess(response.message || 'Usuario bloqueado correctamente');
          // Recargar la lista de amigos y bloqueados para reflejar los cambios
          this.loadFriends();
          this.loadBlockedUsers();
        },
        error: (error) => {
          console.error('Error blocking user:', error);
          this.toastService.showError(error.error?.error || error.message || 'Error al bloquear usuario');
        }
      });
    }
  }

  unblockUser(user: { id: number; username: string }, event: MouseEvent) {
    event.stopPropagation();

    if (confirm(`¿Quieres desbloquear a ${user.username}?`)) {
      this.blockService.unblockUser(user.id).subscribe({
        next: (response) => {
          this.toastService.showSuccess(response.message || 'Usuario desbloqueado correctamente');
          // Recargar la lista de amigos y bloqueados para reflejar los cambios
          this.loadFriends();
          this.loadBlockedUsers();
        },
        error: (error) => {
          console.error('Error unblocking user:', error);
          this.toastService.showError(error.error?.error || 'Error al desbloquear usuario');
        }
      });
    }
  }

  setFilter(mode: 'all' | 'online') {
    this.filterMode = mode;
  }

  clearSearch() {
    this.searchQuery = '';
  }

  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES');
  }
}
