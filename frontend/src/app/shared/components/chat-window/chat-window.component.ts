import { Component, inject, signal, effect, ElementRef, ViewChild, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/services/chat.service';
import { FriendshipService } from '../../../core/services/friendship.service';
import { ChatMessage } from '../../../models/chat.model';
import { PublicUser } from '../../../models/user.model';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss'
})
export class ChatWindowComponent {
  private readonly chatService = inject(ChatService);
  private readonly friendshipService = inject(FriendshipService);

  friends = signal<PublicUser[]>([]);
  activeUser = signal<PublicUser | null>(null);
  
  messages = computed(() => {
    const user = this.activeUser();
    if (!user) return [];
    return this.chatService.getMessagesForUser(user.id)();
  });

  newMessage = '';
  isOpen = signal(false);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor() {
    this.loadFriends();
    
    // Auto-scroll on new messages
    effect(() => {
      const msgs = this.messages();
      if (msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });

    // Listen for global chat open requests
    effect(() => {
      const activeId = this.chatService.activeChatUserId();
      if (activeId) {
        this.openChatWithUserById(activeId);
      }
    });
  }

  loadFriends() {
    this.friendshipService.getFriends().subscribe(friends => {
      this.friends.set(friends);
    });
  }

  toggleWindow() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.loadFriends();
    }
  }

  selectFriend(friend: PublicUser) {
    this.activeUser.set(friend);
    this.chatService.activeChatUserId.set(friend.id);
    this.chatService.getHistory(friend.id).subscribe(() => {
      this.chatService.markAsRead(friend.id).subscribe();
    });
  }

  deselectFriend() {
    this.activeUser.set(null);
    this.chatService.activeChatUserId.set(null);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.close();
  }

  private openChatWithUserById(userId: number) {
    this.isOpen.set(true);
    const friend = this.friends().find(f => f.id === userId);
    if (friend) {
      this.selectFriend(friend);
    } else {
      // If not in friend list, we might need to fetch user info
      // For now assume they are friends
    }
  }

  sendMessage() {
    console.log('Sending message to:', this.activeUser()?.id, 'Content:', this.newMessage);
    if (!this.newMessage.trim() || !this.activeUser()) return;

    const friendId = this.activeUser()!.id;
    this.chatService.sendMessage(friendId, this.newMessage).subscribe({
      next: (res) => {
        console.log('Message sent successfully:', res);
        this.newMessage = '';
      },
      error: (err) => {
        console.error('Error sending message:', err);
      }
    });
  }

  getUnreadCount(userId: number) {
    return this.chatService.getUnreadCountForUser(userId)();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  close() {
    this.isOpen.set(false);
    this.deselectFriend();
  }
}
