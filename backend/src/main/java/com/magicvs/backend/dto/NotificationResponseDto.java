package com.magicvs.backend.dto;

import com.magicvs.backend.model.Notification;
import com.magicvs.backend.model.NotificationType;

import java.time.LocalDateTime;
import java.util.Map;

public record NotificationResponseDto(
    Long id,
    NotificationType type,
    Map<String, Object> data,
    boolean unread,
    LocalDateTime readAt,
    LocalDateTime createdAt
) {
    public static NotificationResponseDto fromEntity(Notification notification) {
        return new NotificationResponseDto(
            notification.getId(),
            notification.getType(),
            notification.getData(),
            notification.isUnread(),
            notification.getReadAt(),
            notification.getCreatedAt()
        );
    }
}
