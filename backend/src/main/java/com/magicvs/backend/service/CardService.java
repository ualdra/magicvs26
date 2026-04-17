package com.magicvs.backend.service;

import com.magicvs.backend.dto.CardDetailDTO;
import com.magicvs.backend.dto.CardSummaryDTO;
import com.magicvs.backend.model.Card;
import com.magicvs.backend.repository.CardRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Service
public class CardService {

    @Autowired
    private CardRepository cardRepository;

    public Page<CardSummaryDTO> getCardsList(Pageable pageable) {
        return cardRepository.findAll(pageable)
                .map(card -> new CardSummaryDTO(
                        card.getId(),
                        card.getName(),
                        card.getTypeLine(),
                        card.getNormalImageUri(),
                        card.getRarity()
                ));
    }

    public Optional<CardDetailDTO> getCardDetail(Long id) {
        return cardRepository.findById(id).map(card -> new CardDetailDTO(
                card.getId(),
                card.getName(),
                card.getManaCost(),
                card.getTypeLine(),
                card.getOracleText(),
                card.getPower(),
                card.getToughness(),
                card.getRarity(),
                card.getFlavorText(),
                card.getArtist(),
                card.getLargeImageUri(),
                parseColors(card.getColorsJson())
        ));
    }

    private List<String> parseColors(String colorsJson) {
        if (colorsJson == null || colorsJson.isBlank()) return List.of();
        return Arrays.asList(colorsJson.replaceAll("[\\[\\]\" ]", "").split(","));
    }
}