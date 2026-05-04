import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChatMessage } from '../../models/chat.model';
import { NotificationService } from './notification.service';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly apiUrl = 'http://localhost:8080/api/chat';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // State
  private readonly messagesSignal = signal<Record<number, ChatMessage[]>>({});
  private readonly unreadCountsSignal = signal<Record<number, number>>({});
  private processedNotificationIds = new Set<number>();
  
  // Active conversation
  readonly activeChatUserId = signal<number | null>(null);

  constructor() {
    // Listen for real-time messages
    this.notificationService.notifications$.subscribe(notifications => {
      // 1. New Messages
      const newMessages = notifications.filter(n => n.type === 'NEW_MESSAGE' && n.unread && !this.processedNotificationIds.has(n.id));
      newMessages.forEach(n => {
        this.processedNotificationIds.add(n.id);
        const msg = (n.data as any)?.['message'] as ChatMessage;
        if (msg) {
          this.addMessageToState(msg);
          // If we are currently chatting with this user, mark as read immediately
          if (this.activeChatUserId() === msg.senderId) {
            this.markAsRead(msg.senderId).subscribe();
          }
          // Mark notification as "handled" by chat system
          this.notificationService.deleteNotification(n.id);
        }
      });

      // 2. Messages Read (when the other user reads our messages)
      const readConfirmations = notifications.filter(n => n.type === 'MESSAGES_READ' && !this.processedNotificationIds.has(n.id));
      readConfirmations.forEach(n => {
        this.processedNotificationIds.add(n.id);
        const readerId = (n.data as any)?.['readerId'];
        if (readerId) {
          this.messagesSignal.update(prev => {
            const msgs = prev[readerId] || [];
            const updated = msgs.map(m => ({ ...m, read: true }));
            return { ...prev, [readerId]: updated };
          });
          this.notificationService.deleteNotification(n.id);
        }
      });
    });
  }

  getHistory(otherUserId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/history/${otherUserId}`, { headers: this.getHeaders() }).pipe(
      tap(msgs => {
        this.messagesSignal.update(prev => ({ ...prev, [otherUserId]: msgs }));
      })
    );
  }

  sendMessage(receiverId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/send`, { receiverId, content }, { headers: this.getHeaders() }).pipe(
      tap(msg => {
        this.addMessageToState(msg);
      })
    );
  }

  markAsRead(senderId: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/read/${senderId}`, {}, { headers: this.getHeaders() }).pipe(
      tap(() => {
        // Update unread counts
        this.unreadCountsSignal.update(prev => {
          const next = { ...prev };
          delete next[senderId];
          return next;
        });
        
        // Update local messages state for this user (set read = true)
        this.messagesSignal.update(prev => {
          const userMsgs = prev[senderId] || [];
          const updated = userMsgs.map(m => ({ ...m, read: true }));
          return { ...prev, [senderId]: updated };
        });
      })
    );
  }

  loadUnreadCounts(): void {
    this.http.get<Record<number, number>>(`${this.apiUrl}/unread`, { headers: this.getHeaders() }).subscribe(counts => {
      this.unreadCountsSignal.set(counts);
    });
  }

  getMessagesForUser(userId: number) {
    return computed(() => this.messagesSignal()[userId] || []);
  }

  getUnreadCountForUser(userId: number) {
    return computed(() => this.unreadCountsSignal()[userId] || 0);
  }

  getTotalUnreadCount() {
    return computed(() => Object.values(this.unreadCountsSignal()).reduce((a, b) => a + b, 0));
  }

  private addMessageToState(msg: ChatMessage): void {
    const otherId = msg.senderId === this.getCurrentUserId() ? msg.receiverId : msg.senderId;
    
    this.messagesSignal.update(prev => {
      const userMsgs = prev[otherId] || [];
      // Avoid duplicates
      if (userMsgs.some(m => m.id === msg.id)) return prev;
      return { ...prev, [otherId]: [...userMsgs, msg] };
    });

    if (msg.senderId !== this.getCurrentUserId() && this.activeChatUserId() !== msg.senderId) {
      this.unreadCountsSignal.update(prev => ({
        ...prev,
        [msg.senderId]: (prev[msg.senderId] || 0) + 1
      }));
    }
  }

  private getCurrentUserId(): number {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id;
  }
}
