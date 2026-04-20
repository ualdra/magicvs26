package com.magicvs.backend.dto;

import org.springframework.data.domain.Page;

import java.util.List;

public record NotificationPageDto(
    List<NotificationResponseDto> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    long unreadCount
) {
    public static NotificationPageDto of(Page<NotificationResponseDto> page, long unreadCount) {
        return new NotificationPageDto(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            unreadCount
        );
    }
}
