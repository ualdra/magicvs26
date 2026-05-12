import { CommonModule } from '@angular/common';
import { Component, Input, signal, Output, EventEmitter, inject, computed, HostListener, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProfileResponse, ProfileService } from './profile.service';
import { Country, CountryService } from '../../core/services/country.service';
import { BlockService } from '../../core/services/block.service';
import { FriendshipService } from '../../core/services/friendship.service';
import { ChatService } from '../../core/services/chat.service';
import { ToastService } from '../../core/services/toast.service';
import { UserService } from '../../core/services/user.service';
import { UserAchievement } from '../../models/achievement.model';

@Component({
  selector: 'app-profile-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile-header.component.html',
  styleUrl: './profile-header.component.scss',
})
export class ProfileHeaderComponent implements OnInit, OnChanges {
  private readonly profileService = inject(ProfileService);
  private readonly countryService = inject(CountryService);
  private readonly blockService = inject(BlockService);
  private readonly friendshipService = inject(FriendshipService);
  private readonly chatService = inject(ChatService);
  private readonly toastService = inject(ToastService);
  private readonly userService = inject(UserService);

  @Input({ required: true }) profile!: ProfileResponse;
  @Input() email: string | null = null;
  @Input() registrationDate: string | null = null;
  @Input() isOwnProfile = false;
  @Input() totalAchievements = 0;
  @Input() unlockedAchievements: UserAchievement[] = [];
  @Input() unlockedAchievementTitles: string[] = [];

  @Output() profileUpdated = new EventEmitter<ProfileResponse>();

  // Use a signal to wrap the profile input for reactivity in computed signals
  profileSignal = signal<ProfileResponse | null>(null);

  isEditing = signal(false);
  isSaving = signal(false);
  isBlocked = signal(false);

  // Password Change Modal states
  isPasswordModalOpen = signal(false);
  isDeleteModalOpen = signal(false);
  isSuccessModalOpen = signal(false);
  oldPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showOldPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  passwordError = signal<string | null>(null);
  isChangingPassword = signal(false);

  // Buffer for editing
  editData = signal<Partial<ProfileResponse>>({});
  unlockedAchievementsSignal = signal<UserAchievement[]>([]);

  // Display featured achievements: custom selection or first 3 unlocked
  displayedFeaturedAchievements = computed(() => {
    const featured = this.selectedFeaturedAchievementKeys();
    const unlocked = this.unlockedAchievementsSignal();
    
    if (featured && featured.length > 0) {
      // Show achievements in the custom order
      return unlocked.filter(a => featured.includes(a.achievement.key));
    } else {
      // Default: first 3 unlocked
      return unlocked.slice(0, 3);
    }
  });

  totalAchievementPoints = computed(() => {
    return this.unlockedAchievementsSignal().reduce((total, item) => {
      return total + (item.achievement.points ?? 0);
    }, 0);
  });

  // MTG Color Palette
  readonly manaColors = [
    { name: 'Blanco', code: 'W', color: 'f0f2f0', text: 'zinc-900' },
    { name: 'Azul', code: 'U', color: '0e68ab', text: 'white' },
    { name: 'Negro', code: 'B', color: '150b00', text: 'zinc-100' },
    { name: 'Rojo', code: 'R', color: 'd3202a', text: 'white' },
    { name: 'Verde', code: 'G', color: '00733e', text: 'white' }
  ];

  selectedManaColor = signal(this.manaColors[0]);

  currentSeed = signal('mage-1');
  hoveredSeed = signal<string | null>(null);

  getPreviewUrl = computed(() => {
    const seed = this.hoveredSeed() || this.currentSeed();
    return `/assets/avatars/${seed}.webp?m=${this.selectedManaColor().code}`;
  });

  manaColorFromUrl = computed(() => {
    const url = this.profileSignal()?.avatarUrl;
    if (!url || !url.includes('?m=')) return this.manaColors[0];
    const code = url.split('?m=')[1];
    return this.manaColors.find(c => c.code === code) || this.manaColors[0];
  });

  // Country Selection Logic
  isCountryDropdownOpen = signal(false);
  countrySearch = signal('');

  isProfileTitleDropdownOpen = signal(false);
  isFeaturedAchievementsEditorOpen = signal(false);
  selectedFeaturedAchievementKeys = signal<string[]>([]);

  countries = signal<Country[]>([]);

  ngOnInit(): void {
    this.countryService.getCountries().subscribe(list => {
      this.countries.set(list);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile']) {
      this.profileSignal.set(this.profile);
      this.loadBlockedState();
      // Initialize selected featured achievement keys from profile when viewing other users
      try {
        const raw = this.profile?.featuredAchievementKeys;
        if (raw) {
          const parsed = JSON.parse(raw);
          this.selectedFeaturedAchievementKeys.set(Array.isArray(parsed) ? parsed : []);
        } else {
          this.selectedFeaturedAchievementKeys.set([]);
        }
      } catch (e) {
        this.selectedFeaturedAchievementKeys.set([]);
      }
    }

    if (changes['unlockedAchievements']) {
      this.unlockedAchievementsSignal.set(this.unlockedAchievements ?? []);
    }
  }

  filteredCountries = computed(() => {
    const search = this.countrySearch().toLowerCase().trim();
    const list = this.countries();
    if (!search) return list;
    return list.filter(c => c.name.toLowerCase().includes(search));
  });

  selectedCountryFlag = computed(() => {
    const term = this.countrySearch().toLowerCase().trim();
    const country = this.countries().find(c => c.name.toLowerCase() === term);
    return country ? country.flag : null;
  });

  profileCountryFlag = computed(() => {
    const name = this.profileSignal()?.country;
    if (!name) return null;
    const country = this.countries().find(c => c.name.toLowerCase() === name.toLowerCase());
    return country ? country.flag : null;
  });

  // Local Avatar Files naming convention: mage-1.webp, mage-2.webp, etc.
  readonly avatarSeeds = Array.from({ length: 20 }, (_, i) => `mage-${i + 1}`);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.country-dropdown-container')) {
      this.isCountryDropdownOpen.set(false);
    }
    if (!target.closest('.profile-title-dropdown-container')) {
      this.isProfileTitleDropdownOpen.set(false);
    }
  }

  selectCountry(country: Country): void {
    this.editData.update(d => ({ ...d, country: country.name }));
    this.countrySearch.set(country.name);
    this.isCountryDropdownOpen.set(false);
  }

  toggleFeaturedAchievement(key: string): void {
    this.selectedFeaturedAchievementKeys.update(keys => {
      const idx = keys.indexOf(key);
      if (idx === -1) {
        // Add if not present (max 3)
        if (keys.length < 3) {
          return [...keys, key];
        }
        return keys;
      } else {
        // Remove if present
        return keys.filter((_, i) => i !== idx);
      }
    });
    // Store as JSON string in editData
    this.editData.update(d => ({
      ...d,
      featuredAchievementKeys: JSON.stringify(this.selectedFeaturedAchievementKeys())
    }));
  }

  openFeaturedAchievementsEditor(): void {
    // Initialize from current profile data if available
    if (this.profile.featuredAchievementKeys) {
      try {
        const keys = JSON.parse(this.profile.featuredAchievementKeys);
        this.selectedFeaturedAchievementKeys.set(Array.isArray(keys) ? keys : []);
      } catch (e) {
        this.selectedFeaturedAchievementKeys.set([]);
      }
    } else {
      this.selectedFeaturedAchievementKeys.set([]);
    }
    this.isFeaturedAchievementsEditorOpen.set(true);
  }

  closeFeaturedAchievementsEditor(): void {
    this.isFeaturedAchievementsEditorOpen.set(false);
  }

  selectAvatar(seed: string): void {
    this.currentSeed.set(seed);
    this.updateAvatarUrl();
  }

  setHoveredSeed(seed: string | null): void {
    this.hoveredSeed.set(seed);
  }

  onCountrySearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.countrySearch.set(value);
    this.editData.update(d => ({ ...d, country: value }));
    this.isCountryDropdownOpen.set(true);
  }

  toggleProfileTitleDropdown(): void {
    this.isProfileTitleDropdownOpen.update(v => !v);
  }

  selectProfileTitle(title: string | null): void {
    this.editData.update(d => ({ ...d, profileTitle: title }));
    this.isProfileTitleDropdownOpen.set(false);
  }

  profileTitleOptions(): string[] {
    const titles = new Set<string>();

    for (const title of this.unlockedAchievementTitles) {
      const normalized = title?.trim();
      if (normalized) {
        titles.add(normalized);
      }
    }

    const currentTitle = this.profileSignal()?.profileTitle?.trim();
    if (currentTitle) {
      titles.add(currentTitle);
    }

    return Array.from(titles);
  }

  rankColor(rango: string | null | undefined): string {
    const colors: Record<string, string> = {
      BRONCE: 'text-amber-600',
      PLATA: 'text-slate-300',
      ORO: 'text-yellow-400',
      PLATINO: 'text-blue-400',
      DIAMANTE: 'text-white',
    };

    return (rango && colors[rango]) ?? 'text-zinc-400';
  }

  toggleEdit(): void {
    if (this.isEditing()) {
      this.cancelEdit();
    } else {
      const p = this.profileSignal();
      if (!p) return;

      this.editData.set({
        displayName: p.displayName,
        profileTitle: p.profileTitle,
        featuredAchievementKeys: p.featuredAchievementKeys,
        avatarUrl: p.avatarUrl,
        country: p.country,
        bio: p.bio
      });
      this.countrySearch.set(p.country || '');
      
      // Initialize selected featured achievements
      if (p.featuredAchievementKeys) {
        try {
          const keys = JSON.parse(p.featuredAchievementKeys);
          this.selectedFeaturedAchievementKeys.set(Array.isArray(keys) ? keys : []);
        } catch (e) {
          this.selectedFeaturedAchievementKeys.set([]);
        }
      } else {
        this.selectedFeaturedAchievementKeys.set([]);
      }
      
      // Attempt to restore seed and color from saved URL
      if (p.avatarUrl) {
        const url = p.avatarUrl;
        
        // Extract seed
        const parts = url.split('/');
        const fileAndParams = parts[parts.length - 1];
        const [seedWithExt] = fileAndParams.split('?');
        const [seed] = seedWithExt.split('.');
        
        if (seed) this.currentSeed.set(seed);

        // Extract mana code
        if (url.includes('?m=')) {
          const code = url.split('?m=')[1];
          const color = this.manaColors.find(c => c.code === code);
          if (color) this.selectedManaColor.set(color);
        }
      }
      
      this.isEditing.set(true);
    }
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  toggleDeleteModal(): void {
    this.isDeleteModalOpen.update(v => !v);
  }

  confirmDeleteAccount(): void {
    this.isSaving.set(true);
    this.profileService.deleteAccount().subscribe({
      next: () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        window.location.href = '/';
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toggleDeleteModal();
        console.error('Error al eliminar la cuenta:', err);
        alert('Hubo un error al eliminar tu cuenta. Por favor, inténtalo de nuevo.');
      }
    });
  }

  togglePasswordModal(): void {
    this.isPasswordModalOpen.update(v => !v);
    if (!this.isPasswordModalOpen()) {
      this.resetPasswordForm();
    }
  }

  toggleVisibility(field: string): void {
    if (field === 'old') this.showOldPassword.update(v => !v);
    if (field === 'new') this.showNewPassword.update(v => !v);
    if (field === 'confirm') this.showConfirmPassword.update(v => !v);
  }

  resetPasswordForm(): void {
    this.oldPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.passwordError.set(null);
    this.showOldPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
  }

  submitPasswordChange(): void {
    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('Las contraseñas nuevas no coinciden');
      return;
    }

    if (this.newPassword().length < 8) {
      this.passwordError.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.isChangingPassword.set(true);
    this.passwordError.set(null);

    this.profileService.changePassword(this.oldPassword(), this.newPassword()).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.togglePasswordModal();
        this.isSuccessModalOpen.set(true);
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        const msg = err.error?.message || 'Error al cambiar la contraseña. Verifica que la actual sea correcta.';
        this.passwordError.set(msg);
      }
    });
  }

  saveChanges(): void {
    this.isSaving.set(true);
    this.profileService.updateProfile(this.editData()).subscribe({
      next: (updated) => {
        // Persist to localStorage for navbar and other components
        const rawUser = localStorage.getItem('user');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          const updatedUser = {
            ...user,
            displayName: updated.displayName,
            profileTitle: updated.profileTitle,
            featuredAchievementKeys: updated.featuredAchievementKeys,
            avatarUrl: updated.avatarUrl,
            friendTag: updated.friendTag
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        this.profile = updated;
        this.profileSignal.set(updated);
        this.profileUpdated.emit(updated);
        
        // Notify the service for real-time sync across components
        this.profileService.notifyProfileUpdate(updated);
        
        this.isSaving.set(false);
        this.isEditing.set(false);
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error al guardar el perfil:', err);
        alert('Hubo un error al guardar los cambios. Por favor, inténtalo de nuevo.');
      }
    });
  }

  randomizeAvatar(): void {
    const newSeed = this.avatarSeeds[Math.floor(Math.random() * this.avatarSeeds.length)];
    this.currentSeed.set(newSeed);
    this.updateAvatarUrl();
  }

  selectManaColor(color: any): void {
    this.selectedManaColor.set(color);
    this.updateAvatarUrl();
  }

  private updateAvatarUrl(): void {
    const seed = this.currentSeed();
    const url = `/assets/avatars/${seed}.webp?m=${this.selectedManaColor().code}`;
    this.editData.update(d => ({ ...d, avatarUrl: url }));
  }

  initials(name: string | null | undefined): string {
    const source = name?.trim() || 'UV';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'No disponible';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No disponible';
    }

    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
    }).format(date);
  }

  // Métodos para acciones en perfiles de otros usuarios
  sendMessage(): void {
    // Por ahora mostrar mensaje, luego integrar con chat
    this.toastService.showInfo('Función de chat próximamente disponible');
  }

  addFriend(): void {
    const currentUser = this.userService.getStoredUser();
    if (!currentUser) {
      this.toastService.showError('Debes iniciar sesión para agregar amigos');
      return;
    }

    this.friendshipService.sendFriendRequest(this.profile.id).subscribe({
      next: (response) => {
        this.toastService.showSuccess(response.message || 'Solicitud de amistad enviada');
        // Actualizar el estado del perfil si es necesario
        this.profileUpdated.emit(this.profile);
      },
      error: (error) => {
        console.error('Error sending friend request:', error);
        this.toastService.showError(error.error?.message || 'Error al enviar solicitud de amistad');
      }
    });
  }

  blockUser(): void {
    const currentUser = this.userService.getStoredUser();
    if (!currentUser) {
      this.toastService.showError('Debes iniciar sesión para bloquear usuarios');
      return;
    }

    if (confirm(`¿Estás seguro de que quieres bloquear a ${this.profile.displayName || this.profile.username}? Esto eliminará la amistad si existe.`)) {
      this.blockService.blockUser(this.profile.id).subscribe({
        next: (response) => {
          this.toastService.showSuccess(response.message || 'Usuario bloqueado correctamente');
          this.isBlocked.set(true);
          this.loadBlockedState();
          this.profileUpdated.emit(this.profile);
        },
        error: (error) => {
          console.error('Error blocking user:', error);
          this.toastService.showError(error.error?.error || error.message || 'Error al bloquear usuario');
        }
      });
    }
  }

  unblockUser(): void {
    const currentUser = this.userService.getStoredUser();
    if (!currentUser) {
      this.toastService.showError('Debes iniciar sesión para desbloquear usuarios');
      return;
    }

    if (confirm(`¿Quieres desbloquear a ${this.profile.displayName || this.profile.username}?`)) {
      this.blockService.unblockUser(this.profile.id).subscribe({
        next: (response) => {
          this.toastService.showSuccess(response.message || 'Usuario desbloqueado correctamente');
          this.isBlocked.set(false);
          this.loadBlockedState();
          this.profileUpdated.emit(this.profile);
        },
        error: (error) => {
          console.error('Error unblocking user:', error);
          this.toastService.showError(error.error?.error || 'Error al desbloquear usuario');
        }
      });
    }
  }

  // Método para verificar si el usuario actual tiene bloqueado a este perfil
  isBlockedByCurrentUser(): boolean {
    return this.isBlocked();
  }

  private loadBlockedState(): void {
    const profile = this.profileSignal();
    const currentUser = this.userService.getStoredUser();

    if (!profile || !currentUser || this.isOwnProfile) {
      this.isBlocked.set(false);
      return;
    }

    this.blockService.isUserBlocked(profile.id).subscribe({
      next: (blocked) => this.isBlocked.set(blocked),
      error: (error) => {
        console.error('Error checking blocked status:', error);
        this.isBlocked.set(false);
      }
    });
  }
}
