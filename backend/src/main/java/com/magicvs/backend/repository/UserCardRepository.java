package com.magicvs.backend.repository;

import com.magicvs.backend.model.UserCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserCardRepository extends JpaRepository<UserCard, Long> {
    
    List<UserCard> findByUserId(Long userId);
    
    Optional<UserCard> findByUserIdAndCardId(Long userId, Long cardId);
}
