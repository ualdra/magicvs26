package com.magicvs.backend.repository;

import com.magicvs.backend.model.DeckCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeckCardRepository extends JpaRepository<DeckCard, Long> {

    List<DeckCard> findByDeckId(Long deckId);

    void deleteByDeckId(Long deckId);

    void deleteByDeckIdAndCardId(Long deckId, Long cardId);
}
