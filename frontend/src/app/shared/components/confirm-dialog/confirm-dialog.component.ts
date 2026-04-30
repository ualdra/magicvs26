import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmService.confirmData(); as data) {
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm animate-fade-in" (click)="confirmService.close(false)"></div>
        
        <!-- Modal -->
        <div class="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/90 shadow-2xl shadow-purple-950/20 backdrop-blur-2xl animate-scale-up">
          <!-- Decor Header -->
          <div class="h-1.5 w-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-rose-500"></div>
          
          <div class="p-8">
            <div class="flex items-center gap-4 mb-6">
              <div class="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <span class="material-symbols-outlined text-2xl">help_outline</span>
              </div>
              <h2 class="text-xl font-headline font-black text-white uppercase tracking-tight">{{ data.title }}</h2>
            </div>
            
            <p class="text-zinc-400 font-body leading-relaxed mb-8">
              {{ data.message }}
            </p>
            
            <div class="flex flex-col sm:flex-row gap-3">
              <button 
                (click)="confirmService.close(true)"
                class="flex-1 px-6 py-3.5 rounded-xl bg-purple-600 text-white font-headline text-xs font-bold uppercase tracking-widest hover:bg-purple-500 transition-all active:scale-[0.98] shadow-lg shadow-purple-900/40">
                Aceptar
              </button>
              <button 
                (click)="confirmService.close(false)"
                class="flex-1 px-6 py-3.5 rounded-xl bg-zinc-800 border border-white/10 text-zinc-300 font-headline text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-all active:scale-[0.98]">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes scaleUp {
      from { 
        opacity: 0;
        transform: scale(0.95) translateY(10px);
      }
      to { 
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
    
    .animate-scale-up {
      animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    
    :host {
      display: contents;
    }
  `]
})
export class ConfirmDialogComponent {
  confirmService = inject(ConfirmService);
}
