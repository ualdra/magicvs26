package com.magicvs.backend.service;

import com.magicvs.backend.dto.ChatMessageDto;
import com.magicvs.backend.dto.NotificationResponseDto;
import com.magicvs.backend.model.ChatMessage;
import com.magicvs.backend.model.NotificationType;
import com.magicvs.backend.repository.ChatMessageRepository;
import com.magicvs.backend.repository.RegistroRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    private final BlockService blockService;

    @Transactional
    public ChatMessageDto sendMessage(Long senderId, Long receiverId, String content) {
        
        // --- 2. MURO DE SEGURIDAD ---
        // Si el receptor tiene bloqueado al emisor, lanzamos error y no guardamos nada
        if (blockService.isBlocked(receiverId, senderId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes enviar mensajes a este usuario.");
        }

        if (blockService.isBlocked(senderId, receiverId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tienes a este usuario bloqueado.");
        }
        // ----------------------------

        ChatMessage message = new ChatMessage();
        message.setSenderId(senderId);
        message.setReceiverId(receiverId);
        message.setContent(content);
        
        message = chatMessageRepository.save(message);
        ChatMessageDto dto = ChatMessageDto.fromEntity(message);

        var sender = registroRepository.findById(senderId).orElse(null);
        String senderName = sender != null
                ? (sender.getDisplayName() != null ? sender.getDisplayName() : sender.getUsername())
                : "Alguien";

        if (sender != null) {
            achievementService.increment(sender, "FIRST_MESSAGE");
            achievementService.increment(sender, "CHAT_100");
            achievementService.increment(sender, "CHAT_500");
        }

        // Push to receiver via SSE
        Map<String, Object> data = new HashMap<>();
        data.put("message", dto);
        data.put("title", senderName);
        data.put("message_text", content);
        
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
        // --- 3. RESTRICCIÓN EN HISTORIAL  ---
        return chatMessageRepository.findConversation(u1, u2).stream()
                .map(ChatMessageDto::fromEntity)
                .toList();
    }

    @Transactional
    public void markAsRead(Long receiverId, Long senderId) {
        chatMessageRepository.markAsRead(senderId, receiverId);
        
        Map<String, Object> data = new HashMap<>();
        data.put("readerId", receiverId);
        
        NotificationResponseDto notification = new NotificationResponseDto(
                System.currentTimeMillis(),
                NotificationType.MESSAGES_READ,
                data,
                false, 
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