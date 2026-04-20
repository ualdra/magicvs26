package com.magicvs.backend.service;

import com.magicvs.backend.dto.NotificationPageDto;
import com.magicvs.backend.dto.NotificationResponseDto;
import com.magicvs.backend.model.Notification;
import com.magicvs.backend.model.NotificationType;
import com.magicvs.backend.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationStreamService notificationStreamService;

    public NotificationService(NotificationRepository notificationRepository, NotificationStreamService notificationStreamService) {
        this.notificationRepository = notificationRepository;
        this.notificationStreamService = notificationStreamService;
    }

    public NotificationPageDto getNotifications(Long userId, int page, int size) {
        Page<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
        Page<NotificationResponseDto> dtoPage = new PageImpl<>(
            notifications.getContent().stream().map(NotificationResponseDto::fromEntity).toList(),
            notifications.getPageable(),
            notifications.getTotalElements()
        );
        long unreadCount = notificationRepository.countByUserIdAndReadAtIsNull(userId);
        return NotificationPageDto.of(dtoPage, unreadCount);
    }

    @Transactional
    public NotificationResponseDto markAsRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notificación no encontrada"));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notification = notificationRepository.save(notification);
        }

        return NotificationResponseDto.fromEntity(notification);
    }

    @Transactional
    public int markAllAsRead(Long userId) {
        return notificationRepository.markAllAsRead(userId, LocalDateTime.now());
    }

    @Transactional
    public void deleteNotification(Long userId, Long notificationId) {
        long deleted = notificationRepository.deleteByIdAndUserId(notificationId, userId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notificación no encontrada");
        }
    }

    @Transactional
    public long deleteAllNotifications(Long userId) {
        return notificationRepository.deleteByUserId(userId);
    }

    @Transactional
    public NotificationResponseDto createNotification(Long userId, NotificationType type, Map<String, Object> data) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setData(data);

        Notification saved = notificationRepository.save(notification);
        NotificationResponseDto dto = NotificationResponseDto.fromEntity(saved);
        notificationStreamService.pushNotification(userId, dto);
        return dto;
    }
}
