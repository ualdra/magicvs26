package com.magicvs.backend.repository;

import com.magicvs.backend.model.FavoriteCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface FavoriteCardRepository extends JpaRepository<FavoriteCard, Long> {

    boolean existsByUserIdAndCardId(Long userId, Long cardId);

    Optional<FavoriteCard> findByUserIdAndCardId(Long userId, Long cardId);

    @Modifying
    @Query("DELETE FROM FavoriteCard f WHERE f.user.id = :userId AND f.card.id = :cardId")
    void deleteByUserIdAndCardId(@Param("userId") Long userId, @Param("cardId") Long cardId);

}
