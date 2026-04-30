package com.magicvs.backend.repository;

import com.magicvs.backend.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndReadAtIsNull(Long userId);

    long deleteByIdAndUserId(Long id, Long userId);

    long deleteByUserId(Long userId);

    @Modifying
    @Query("""
        update Notification n
        set n.readAt = :readAt
        where n.userId = :userId and n.readAt is null
    """)
    int markAllAsRead(@Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);
}
