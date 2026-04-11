package com.magicvs.backend.repository;

import com.magicvs.backend.model.Card;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CardRepository extends JpaRepository<Card, Long> {

    Optional<Card> findByScryfallId(UUID scryfallId);

    List<Card> findByNameContainingIgnoreCase(String name);

    Optional<Card> findFirstByNameIgnoreCase(String name);

    Optional<Card> findFirstByNameIgnoreCaseAndLang(String name, String lang);

    boolean existsByScryfallId(UUID scryfallId);
}