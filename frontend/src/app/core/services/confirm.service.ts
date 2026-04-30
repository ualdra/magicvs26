import { Injectable, signal } from '@angular/core';

export interface ConfirmData {
  title: string;
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  private confirmDataSignal = signal<ConfirmData | null>(null);
  confirmData = this.confirmDataSignal.asReadonly();

  confirm(message: string, title: string = '¿Estás seguro?'): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmDataSignal.set({
        title,
        message,
        resolve: (value: boolean) => {
          this.confirmDataSignal.set(null);
          resolve(value);
        }
      });
    });
  }

  close(value: boolean): void {
    const data = this.confirmDataSignal();
    if (data) {
      data.resolve(value);
    }
  }
}
