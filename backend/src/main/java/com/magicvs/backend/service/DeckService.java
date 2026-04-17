package com.magicvs.backend.service;

import com.magicvs.backend.dto.CreateDeckDTO;
import com.magicvs.backend.dto.DeckResponseDTO;
import com.magicvs.backend.dto.DeckSummaryDTO;
import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.Deck;
import com.magicvs.backend.model.DeckFormat;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.CardRepository;
import com.magicvs.backend.repository.DeckCardRepository;
import com.magicvs.backend.repository.DeckRepository;
import com.magicvs.backend.repository.RegistroRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DeckService {

    private final DeckRepository deckRepository;
    private final DeckCardRepository deckCardRepository;
    private final CardRepository cardRepository;
    private final RegistroRepository userRepository;
    private final int minDeckCards;

    public DeckService(DeckRepository deckRepository, 
                       DeckCardRepository deckCardRepository,
                       CardRepository cardRepository,
                       RegistroRepository userRepository,
                       @Value("${deck.validation.min-cards:60}") int minDeckCards) {
        this.deckRepository = deckRepository;
        this.deckCardRepository = deckCardRepository;
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
        this.minDeckCards = minDeckCards;
    }

    /**
     * Valida restricciones básicas del mazo antes de guardar
     */
    public void validateDeck(CreateDeckDTO deckDTO) throws IllegalArgumentException {
        if (deckDTO.getCards() == null || deckDTO.getCards().isEmpty()) {
            throw new IllegalArgumentException("El mazo no puede estar vacío");
        }

        Map<Long, Integer> cardQuantities = normalizeCardQuantities(deckDTO.getCards());

        int totalCards = cardQuantities.values().stream()
            .mapToInt(Integer::intValue)
            .sum();

        if (totalCards != minDeckCards) {
            throw new IllegalArgumentException("El mazo debe tener exactamente " + minDeckCards + " cartas. Actual: " + totalCards);
        }

        for (Map.Entry<Long, Integer> entry : cardQuantities.entrySet()) {
            Card card = cardRepository.findById(entry.getKey())
                .orElseThrow(() -> new IllegalArgumentException("Carta no encontrada: " + entry.getKey()));

            if (!isBasicLand(card) && entry.getValue() > 4) {
                throw new IllegalArgumentException(
                    "No puedes tener más de 4 copias de '" + card.getName() + "'. Actual: " + entry.getValue());
            }

            if (entry.getValue() < 1) {
                throw new IllegalArgumentException(
                    "La cantidad de cartas debe ser al menos 1 para '" + card.getName() + "'");
            }
        }
    }

    /**
     * Crea un nuevo mazo
     */
    @Transactional
    public DeckResponseDTO createDeck(Long userId, CreateDeckDTO deckDTO) {
        validateDeck(deckDTO);

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        Deck deck = new Deck();
        deck.setUser(user);
        deck.setName(deckDTO.getName());
        deck.setDescription(deckDTO.getDescription());
        deck.setFormat(DeckFormat.STANDARD);
        
        deck.setPublic(deckDTO.getIsPublic() != null ? deckDTO.getIsPublic() : false);

        syncDeckCards(deck, deckDTO.getCards());
        Deck savedDeck = deckRepository.save(deck);

        return DeckResponseDTO.fromEntity(savedDeck);
    }

    /**
     * Actualiza un mazo existente
     */
    @Transactional
    public DeckResponseDTO updateDeck(Long deckId, Long userId, CreateDeckDTO deckDTO) {
        Deck deck = deckRepository.findById(deckId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mazo no encontrado"));

        ensureOwner(deck, userId);
        validateDeck(deckDTO);

        deck.setName(deckDTO.getName());
        deck.setDescription(deckDTO.getDescription());
        deck.setFormat(DeckFormat.STANDARD);
        deck.setPublic(deckDTO.getIsPublic() != null ? deckDTO.getIsPublic() : false);

        syncDeckCards(deck, deckDTO.getCards());
        // deck is already managed in this transaction; flushing avoids merge side effects.
        deckRepository.flush();

        return DeckResponseDTO.fromEntity(deck);
    }

    /**
     * Obtiene un mazo por ID
     */
    @Transactional(readOnly = true)
    public DeckResponseDTO getDeckById(Long deckId, Long userId) {
        Deck deck = deckRepository.findById(deckId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mazo no encontrado"));

        ensureOwner(deck, userId);
        return DeckResponseDTO.fromEntity(deck);
    }

    /**
     * Obtiene los mazos de un usuario
     */
    @Transactional(readOnly = true)
    public List<DeckSummaryDTO> getUserDecks(Long userId) {
        return deckRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream()
            .map(this::toDeckSummary)
            .collect(Collectors.toList());
    }

    /**
     * Elimina un mazo (solo el propietario)
     */
    @Transactional
    public void deleteDeck(Long deckId, Long userId) {
        Deck deck = deckRepository.findById(deckId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mazo no encontrado"));

        ensureOwner(deck, userId);

        deckRepository.delete(deck);
    }

    private void syncDeckCards(Deck deck, List<CreateDeckDTO.DeckCardDTO> deckCards) {
        if (deck.getId() != null) {
            // Force delete existing persisted rows before inserts to avoid unique key collisions.
            deckCardRepository.deleteByDeckId(deck.getId());
            deckCardRepository.flush();
        }

        deck.getCards().clear();

        Map<Long, Integer> normalizedCards = normalizeCardQuantities(deckCards);
        for (Map.Entry<Long, Integer> entry : normalizedCards.entrySet()) {
            Card card = cardRepository.findById(entry.getKey())
                .orElseThrow(() -> new IllegalArgumentException("Carta no encontrada: " + entry.getKey()));
            deck.addCard(card, entry.getValue());
        }

        deck.recalculateTotalCards();
    }

    private Map<Long, Integer> normalizeCardQuantities(List<CreateDeckDTO.DeckCardDTO> deckCards) {
        return deckCards.stream()
            .collect(Collectors.groupingBy(
                CreateDeckDTO.DeckCardDTO::getCardId,
                LinkedHashMap::new,
                Collectors.summingInt(card -> card.getQuantity() != null ? card.getQuantity() : 0)
            ));
    }

    private void ensureOwner(Deck deck, Long userId) {
        if (!deck.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso para editar este mazo");
        }
    }

    private boolean isBasicLand(Card card) {
        String typeLine = card.getTypeLine();
        return typeLine != null && typeLine.toLowerCase().contains("basic land");
    }

    private DeckSummaryDTO toDeckSummary(Deck deck) {
        return new DeckSummaryDTO(
            deck.getId(),
            deck.getName(),
            deck.getFormat() != null ? deck.getFormat().name() : DeckFormat.STANDARD.name(),
            deck.getTotalCards(),
            deck.getUpdatedAt(),
            deck.getPublic()
        );
    }
}
