package com.magicvs.backend.repository;

import com.magicvs.backend.model.Deck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DeckRepository extends JpaRepository<Deck, Long> {

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.cards c LEFT JOIN FETCH c.card WHERE d.user.id = :userId ORDER BY d.updatedAt DESC")
    List<Deck> findByUserIdOrderByUpdatedAtDesc(@Param("userId") Long userId);

    @Query("SELECT d FROM Deck d LEFT JOIN FETCH d.cards c LEFT JOIN FETCH c.card WHERE d.id = :deckId")
    java.util.Optional<Deck> findByIdWithCards(@Param("deckId") Long deckId);

    boolean existsByIdAndUserId(Long deckId, Long userId);

    long countByUserId(Long userId);

    void deleteByUserId(Long userId);
}
