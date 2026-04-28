import { CommonModule } from '@angular/common';
import { Component, Input, signal, Output, EventEmitter, inject, computed, HostListener, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProfileResponse, ProfileService } from './profile.service';
import { Country, CountryService } from '../../core/services/country.service';

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

  @Input({ required: true }) profile!: ProfileResponse;
  @Input() email: string | null = null;
  @Input() registrationDate: string | null = null;
  @Input() isOwnProfile = false;

  @Output() profileUpdated = new EventEmitter<ProfileResponse>();

  // Use a signal to wrap the profile input for reactivity in computed signals
  profileSignal = signal<ProfileResponse | null>(null);

  isEditing = signal(false);
  isSaving = signal(false);

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

  countries = signal<Country[]>([]);

  ngOnInit(): void {
    this.countryService.getCountries().subscribe(list => {
      this.countries.set(list);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile']) {
      this.profileSignal.set(this.profile);
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
  }

  selectCountry(country: Country): void {
    this.editData.update(d => ({ ...d, country: country.name }));
    this.countrySearch.set(country.name);
    this.isCountryDropdownOpen.set(false);
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

  toggleEdit(): void {
    if (this.isEditing()) {
      this.cancelEdit();
    } else {
      const p = this.profileSignal();
      if (!p) return;

      this.editData.set({
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        country: p.country,
        bio: p.bio
      });
      this.countrySearch.set(p.country || '');
      
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
}
