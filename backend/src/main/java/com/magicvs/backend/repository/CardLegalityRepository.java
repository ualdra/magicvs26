package com.magicvs.backend.repository;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.CardLegality;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CardLegalityRepository extends JpaRepository<CardLegality, Long> {

    List<CardLegality> findByFormatNameIgnoreCase(String formatName);

    List<CardLegality> findByLegalityStatusIgnoreCase(String legalityStatus);

    void deleteByCard(Card card);
}