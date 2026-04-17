package com.magicvs.backend.repository;

import com.magicvs.backend.model.Card;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CardRepository extends JpaRepository<Card, Long> {

    interface CardSearchProjection {
        Long getId();
        String getName();
        String getManaCost();
        String getTypeLine();
        String getNormalImageUri();
        String getSmallImageUri();
        String getColorsJson();
        String getRawJson();
    }

    Optional<Card> findByScryfallId(UUID scryfallId);

    List<Card> findByNameContainingIgnoreCase(String name);

    Page<Card> findByNameContainingIgnoreCase(String name, Pageable pageable);

    @Query("""
        SELECT c.id AS id,
               c.name AS name,
               c.manaCost AS manaCost,
               c.typeLine AS typeLine,
               c.normalImageUri AS normalImageUri,
               c.smallImageUri AS smallImageUri,
             c.colorsJson AS colorsJson,
             c.rawJson AS rawJson
        FROM Card c
         WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%'))
            OR LOWER(c.rawJson) LIKE LOWER(CONCAT('%', :name, '%'))
        """)
    Page<CardSearchProjection> searchProjectedByName(@Param("name") String name, Pageable pageable);

    Optional<Card> findFirstByNameIgnoreCase(String name);

    Optional<Card> findFirstByNameIgnoreCaseAndLang(String name, String lang);

    boolean existsByScryfallId(UUID scryfallId);
}