import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative overflow-hidden rounded-full border-4 border-surface-container bg-surface-container"
         [class.w-40]="size === 'lg'" [class.h-40]="size === 'lg'"
         [class.w-16]="size === 'md'" [class.h-16]="size === 'md'"
         [class.w-10]="size === 'sm'" [class.h-10]="size === 'sm'">
      @if (avatarUrl) {
        <img [src]="avatarUrl" [alt]="username" class="h-full w-full object-cover rounded-full">
      } @else {
        <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary via-primary-container to-tertiary text-white font-bold"
             [style.font-size.rem]="size === 'lg' ? 4 : (size === 'md' ? 1.5 : 0.8)">
          {{ getInitials() }}
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class AvatarComponent {
  @Input({ required: true }) username!: string;
  @Input() avatarUrl: string | null | undefined = null;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  getInitials(): string {
    const source = this.username?.trim() || 'U';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}
