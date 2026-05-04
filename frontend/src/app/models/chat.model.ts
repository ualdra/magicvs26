export interface ChatMessage {
    id: number;
    senderId: number;
    receiverId: number;
    content: string;
    createdAt: string;
    read: boolean;
}

export interface ChatConversation {
    otherUserId: number;
    otherUserName: string;
    otherUserAvatar?: string;
    messages: ChatMessage[];
    unreadCount: number;
    isOnline?: boolean;
}
