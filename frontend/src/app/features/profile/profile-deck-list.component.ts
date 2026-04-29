import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProfileDeckSummary, ProfileService } from './profile.service';

@Component({
  selector: 'app-profile-deck-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './profile-deck-list.component.html',
  styleUrl: './profile-deck-list.component.scss',
})
export class ProfileDeckListComponent {
  @Input() decks: ProfileDeckSummary[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() isOwnProfile = false;

  private readonly profileService = inject(ProfileService);

  expandedDeckId: number | null = null;
  
  showImportForm = false;
  importName = '';
  importText = '';
  importing = false;

  toggleImportForm(): void {
    this.showImportForm = !this.showImportForm;
    if (!this.showImportForm) {
      this.importName = '';
      this.importText = '';
    }
  }

  submitImport(): void {
    if (!this.importText.trim()) return;
    this.importing = true;
    this.profileService.importDeck(this.importName, this.importText).subscribe({
      next: (res) => {
        this.importing = false;
        this.toggleImportForm();
        if (res.missingCards && res.missingCards.length > 0) {
          const missingText = res.missingCards.join(', ');
          alert(`Mazo importado con éxito, pero faltaron estas cartas (se omitieron): ${missingText}`);
        }
        window.location.reload();
      },
      error: (err) => {
        this.importing = false;
        alert(err.error?.message || 'Error importando mazo');
        console.error(err);
      }
    });
  }

  toggleDeck(deckId: number): void {
    this.expandedDeckId = this.expandedDeckId === deckId ? null : deckId;
  }

  exportDeck(deck: ProfileDeckSummary): void {
    this.profileService.exportDeck(deck.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${deck.name.replace(/\s+/g, '_')}_export.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error exporting deck:', err);
        // Optionally show a toast here
      }
    });
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
      timeStyle: 'short',
    }).format(date);
  }

  deckColors(deck: ProfileDeckSummary): string[] {
    return deck.colors ?? [];
  }
}
