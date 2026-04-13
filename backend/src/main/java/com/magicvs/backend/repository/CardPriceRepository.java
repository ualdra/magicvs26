package com.magicvs.backend.repository;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.CardPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CardPriceRepository extends JpaRepository<CardPrice, Long> {
    Optional<CardPrice> findByCard(Card card);
}