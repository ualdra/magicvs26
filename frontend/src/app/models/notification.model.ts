export type NotificationType = 'FRIEND_REQUEST' | 'NEW_MESSAGE' | 'BATTLE_INVITE' | 'SYSTEM';

export interface AppNotification {
  id: number;
  type: NotificationType;
  data: {
    title?: string;
    message?: string;
    link?: string;
    senderName?: string;
    [key: string]: unknown;
  };
  unread: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPageResponse {
  content: AppNotification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  unreadCount: number;
}

export interface ToastNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
}
