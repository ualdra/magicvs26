package com.magicvs.backend.repository;

import com.magicvs.backend.model.Deck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeckRepository extends JpaRepository<Deck, Long> {

    List<Deck> findByUserIdOrderByUpdatedAtDesc(Long userId);

    boolean existsByIdAndUserId(Long deckId, Long userId);

    long countByUserId(Long userId);
}
