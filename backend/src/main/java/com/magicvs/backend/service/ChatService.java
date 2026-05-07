package com.magicvs.backend.service;

import com.magicvs.backend.dto.ChatMessageDto;
import com.magicvs.backend.dto.NotificationResponseDto;
import com.magicvs.backend.model.ChatMessage;
import com.magicvs.backend.model.NotificationType;
import com.magicvs.backend.repository.ChatMessageRepository;
import com.magicvs.backend.repository.RegistroRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final NotificationStreamService notificationStreamService;
    private final RegistroRepository registroRepository;
    private final AchievementService achievementService;

    @Transactional
    public ChatMessageDto sendMessage(Long senderId, Long receiverId, String content) {
        ChatMessage message = new ChatMessage();
        message.setSenderId(senderId);
        message.setReceiverId(receiverId);
        message.setContent(content);
        
        message = chatMessageRepository.save(message);
        ChatMessageDto dto = ChatMessageDto.fromEntity(message);

        // Fetch sender for notification and achievements
        var sender = registroRepository.findById(senderId).orElse(null);
        String senderName = sender != null
                ? (sender.getDisplayName() != null ? sender.getDisplayName() : sender.getUsername())
                : "Alguien";

        if (sender != null) {
            achievementService.increment(sender, "FIRST_MESSAGE");
            // Also increment cumulative chat achievements
            achievementService.increment(sender, "CHAT_100");
            achievementService.increment(sender, "CHAT_500");
        }

        // Push to receiver via SSE
        Map<String, Object> data = new HashMap<>();
        data.put("message", dto);
        data.put("title", senderName);
        data.put("message_text", content); // Using message_text to avoid conflict with the dto 'message'
        
        NotificationResponseDto notification = new NotificationResponseDto(
                System.currentTimeMillis(),
                NotificationType.NEW_MESSAGE,
                data,
                true,
                null,
                java.time.LocalDateTime.now()
        );

        notificationStreamService.pushNotification(receiverId, notification);
        
        return dto;
    }

    public List<ChatMessageDto> getHistory(Long u1, Long u2) {
        return chatMessageRepository.findConversation(u1, u2).stream()
                .map(ChatMessageDto::fromEntity)
                .toList();
    }

    @Transactional
    public void markAsRead(Long receiverId, Long senderId) {
        chatMessageRepository.markAsRead(senderId, receiverId);
        
        // Notify the original SENDER that their messages have been read
        Map<String, Object> data = new HashMap<>();
        data.put("readerId", receiverId);
        
        NotificationResponseDto notification = new NotificationResponseDto(
                System.currentTimeMillis(),
                NotificationType.MESSAGES_READ,
                data,
                false, // Informational, doesn't increment unread count
                null,
                java.time.LocalDateTime.now()
        );
        
        notificationStreamService.pushNotification(senderId, notification);
    }

    public Map<Long, Long> getUnreadCounts(Long userId) {
        List<Object[]> results = chatMessageRepository.countUnreadBySender(userId);
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] res : results) {
            counts.put((Long) res[0], (Long) res[1]);
        }
        return counts;
    }
}
