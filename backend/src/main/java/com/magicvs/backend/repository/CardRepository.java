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
        String getFaceNormalImageUri();
        String getFaceSmallImageUri();
        String getBackFaceNormalImageUri();
        String getBackFaceSmallImageUri();
        String getColorsJson();
        String getRawJson();
        String getRarity();
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
               firstFace.normalImageUri AS faceNormalImageUri,
               firstFace.smallImageUri AS faceSmallImageUri,
               lastFace.normalImageUri AS backFaceNormalImageUri,
               lastFace.smallImageUri AS backFaceSmallImageUri,
               c.colorsJson AS colorsJson,
               c.rawJson AS rawJson,
               c.rarity AS rarity
        FROM Card c
        LEFT JOIN c.faces firstFace
            ON firstFace.faceOrder = (
                SELECT MIN(f1.faceOrder)
                FROM CardFace f1
                WHERE f1.card = c
            )
        LEFT JOIN c.faces lastFace
            ON lastFace.faceOrder = (
                SELECT MAX(f2.faceOrder)
                FROM CardFace f2
                WHERE f2.card = c
            )
         WHERE (
                LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%'))
                OR LOWER(c.rawJson) LIKE LOWER(CONCAT('%', :name, '%'))
               )
           AND (:noColorFilter = TRUE OR (
                (:needsW = FALSE OR UPPER(COALESCE(c.colorsJson, '[]')) LIKE '%"W"%' OR UPPER(COALESCE(c.colorIdentityJson, '[]')) LIKE '%"W"%')
                AND (:needsU = FALSE OR UPPER(COALESCE(c.colorsJson, '[]')) LIKE '%"U"%' OR UPPER(COALESCE(c.colorIdentityJson, '[]')) LIKE '%"U"%')
                AND (:needsB = FALSE OR UPPER(COALESCE(c.colorsJson, '[]')) LIKE '%"B"%' OR UPPER(COALESCE(c.colorIdentityJson, '[]')) LIKE '%"B"%')
                AND (:needsR = FALSE OR UPPER(COALESCE(c.colorsJson, '[]')) LIKE '%"R"%' OR UPPER(COALESCE(c.colorIdentityJson, '[]')) LIKE '%"R"%')
                AND (:needsG = FALSE OR UPPER(COALESCE(c.colorsJson, '[]')) LIKE '%"G"%' OR UPPER(COALESCE(c.colorIdentityJson, '[]')) LIKE '%"G"%')
                AND (:needsC = FALSE OR (
                    (c.colorsJson IS NULL OR c.colorsJson = '[]' OR c.colorsJson = '')
                    AND (c.colorIdentityJson IS NULL OR c.colorIdentityJson = '[]' OR c.colorIdentityJson = '')
                ))
               ))
           AND (
                :typeFilter = ''
                OR LOWER(COALESCE(c.typeLine, '')) LIKE LOWER(CONCAT('%', :typeFilter, '%'))
               )
           AND (
                :rarityFilter = ''
                OR LOWER(COALESCE(c.rarity, '')) = LOWER(:rarityFilter)
               )
           AND (
                :favoritesOnly = FALSE
                OR c.id IN (SELECT fc.card.id FROM FavoriteCard fc WHERE fc.user.id = :userId)
               )
        """)
    Page<CardSearchProjection> searchProjectedByNameAndFilters(
        @Param("name") String name,
        @Param("noColorFilter") boolean noColorFilter,
        @Param("needsW") boolean needsW,
        @Param("needsU") boolean needsU,
        @Param("needsB") boolean needsB,
        @Param("needsR") boolean needsR,
        @Param("needsG") boolean needsG,
        @Param("needsC") boolean needsC,
        @Param("typeFilter") String typeFilter,
        @Param("rarityFilter") String rarityFilter,
        @Param("favoritesOnly") boolean favoritesOnly,
        @Param("userId") Long userId,
        Pageable pageable
    );

    Optional<Card> findFirstByNameIgnoreCase(String name);

    @Query("SELECT c FROM Card c WHERE LOWER(c.name) = LOWER(:name) OR LOWER(c.rawJson) LIKE LOWER(CONCAT('%\"printed_name\":\"', :name, '\"%')) OR LOWER(c.rawJson) LIKE LOWER(CONCAT('%\"printed_name\": \"', :name, '\"%'))")
    List<Card> findByNameOrPrintedName(@Param("name") String name);

    Optional<Card> findFirstByNameIgnoreCaseAndLang(String name, String lang);

    boolean existsByScryfallId(UUID scryfallId);
}