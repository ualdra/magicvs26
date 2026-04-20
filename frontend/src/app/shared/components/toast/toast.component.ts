import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast-card glass-panel flex items-center gap-4 px-6 py-4 rounded-2xl border border-white/10 pointer-events-auto animate-slide-in"
             [class]="toast.type">
          <span class="material-symbols-outlined text-2xl" [class]="'icon-' + toast.type">
            {{ getIcon(toast.type) }}
          </span>
          <p class="text-sm font-headline uppercase tracking-widest text-white/90">{{ toast.message }}</p>
          <button (click)="toastService.remove(toast.id)" class="ml-2 text-white/40 hover:text-white transition-colors">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .glass-panel {
      background: rgba(23, 23, 23, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }

    .toast-card {
      min-width: 320px;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: currentColor;
      }
    }

    .success { color: #4ade80; }
    .error { color: #f87171; }
    .warning { color: #fbbf24; }
    .info { color: #60a5fa; }

    .icon-success { color: #4ade80; }
    .icon-error { color: #f87171; }
    .icon-warning { color: #fbbf24; }
    .icon-info { color: #60a5fa; }

    .animate-slide-in {
      animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(40px) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);

  getIcon(type: Toast['type']): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }
}
