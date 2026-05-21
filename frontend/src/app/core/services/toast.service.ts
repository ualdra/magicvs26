import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSignal = signal<Toast[]>([]);
  toasts = this.toastsSignal.asReadonly();
  private nextId = 0;

  show(message: string, type: Toast['type'] = 'info', duration: number = 4000): void {
    const id = this.nextId++;
    const toast: Toast = { id, message, type };
    
    this.toastsSignal.update(toasts => [...toasts, toast]);

    setTimeout(() => {
      this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
    }, duration);
  }

  showInfo(message: string, duration: number = 4000): void {
    this.show(message, 'info', duration);
  }

  showSuccess(message: string, duration: number = 4000): void {
    this.show(message, 'success', duration);
  }

  showError(message: string, duration: number = 4000): void {
    this.show(message, 'error', duration);
  }

  showWarning(message: string, duration: number = 4000): void {
    this.show(message, 'warning', duration);
  }

  remove(id: number): void {
    this.toastsSignal.update(toasts => toasts.filter(t => t.id !== id));
  }
}
