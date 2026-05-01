package com.magicvs.backend.repository;

import com.magicvs.backend.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    @Query("SELECT m FROM ChatMessage m WHERE " +
           "(m.senderId = :u1 AND m.receiverId = :u2) OR " +
           "(m.senderId = :u2 AND m.receiverId = :u1) " +
           "ORDER BY m.createdAt ASC")
    List<ChatMessage> findConversation(@Param("u1") Long u1, @Param("u2") Long u2);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.receiverId = :userId AND m.read = false")
    long countUnreadMessages(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.read = true WHERE m.senderId = :senderId AND m.receiverId = :receiverId")
    void markAsRead(@Param("senderId") Long senderId, @Param("receiverId") Long receiverId);

    @Query("SELECT m.senderId, COUNT(m) FROM ChatMessage m WHERE m.receiverId = :userId AND m.read = false GROUP BY m.senderId")
    List<Object[]> countUnreadBySender(@Param("userId") Long userId);
}
