package com.magicvs.backend.service;

import com.magicvs.backend.dto.CreateDeckDTO;
import com.magicvs.backend.dto.DeckResponseDTO;
import com.magicvs.backend.dto.DeckSummaryDTO;
import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.Deck;
import com.magicvs.backend.model.DeckCard;
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
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DeckService {

    private final DeckRepository deckRepository;
    private final CardRepository cardRepository;
    private final RegistroRepository userRepository;
    private final int minDeckCards;

    public DeckService(DeckRepository deckRepository, 
                       CardRepository cardRepository,
                       RegistroRepository userRepository,
                       @Value("${deck.validation.min-cards:60}") int minDeckCards) {
        this.deckRepository = deckRepository;
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

        // Validar cantidad de cartas
        int totalCards = deckDTO.getCards().stream()
            .mapToInt(CreateDeckDTO.DeckCardDTO::getQuantity)
            .sum();
        if (totalCards < minDeckCards) {
            throw new IllegalArgumentException("El mazo debe tener mínimo " + minDeckCards + " cartas. Actual: " + totalCards);
        }

        if (totalCards > 250) {
            throw new IllegalArgumentException("El mazo no puede exceder 250 cartas. Actual: " + totalCards);
        }

        // Validar cantidad máxima por carta (4 copias)
        Map<Long, Integer> cardQuantities = deckDTO.getCards().stream()
            .collect(Collectors.groupingBy(
                CreateDeckDTO.DeckCardDTO::getCardId,
                Collectors.summingInt(CreateDeckDTO.DeckCardDTO::getQuantity)
            ));

        for (Map.Entry<Long, Integer> entry : cardQuantities.entrySet()) {
            Card card = cardRepository.findById(entry.getKey())
                .orElseThrow(() -> new IllegalArgumentException("Carta no encontrada: " + entry.getKey()));

            if (entry.getValue() > 4) {
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
        
        try {
            deck.setFormat(DeckFormat.valueOf(deckDTO.getFormat().toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Formato de mazo inválido: " + deckDTO.getFormat());
        }
        
        deck.setPublic(deckDTO.getIsPublic() != null ? deckDTO.getIsPublic() : false);

        // Agregar cartas
        for (CreateDeckDTO.DeckCardDTO cardDTO : deckDTO.getCards()) {
            Card card = cardRepository.findById(cardDTO.getCardId())
                .orElseThrow(() -> new IllegalArgumentException("Carta no encontrada: " + cardDTO.getCardId()));
            deck.addCard(card, cardDTO.getQuantity());
        }

        deck.recalculateTotalCards();
        Deck savedDeck = deckRepository.save(deck);

        return DeckResponseDTO.fromEntity(savedDeck);
    }

    /**
     * Obtiene un mazo por ID
     */
    @Transactional(readOnly = true)
    public DeckResponseDTO getDeckById(Long deckId) {
        Deck deck = deckRepository.findById(deckId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mazo no encontrado"));
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

        if (!deck.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso para eliminar este mazo");
        }

        deckRepository.delete(deck);
    }

    private DeckSummaryDTO toDeckSummary(Deck deck) {
        return new DeckSummaryDTO(
            deck.getId(),
            deck.getName(),
            deck.getFormat().name(),
            deck.getTotalCards(),
            deck.getUpdatedAt(),
            deck.getPublic()
        );
    }
}
