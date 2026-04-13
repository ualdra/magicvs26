package com.magicvs.backend.repository;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.CardFace;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardFaceRepository extends JpaRepository<CardFace, Long> {
    void deleteByCard(Card card);
}