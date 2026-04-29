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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.magicvs.backend.dto.ImportDeckRequestDTO;
import com.magicvs.backend.dto.ImportDeckResponseDTO;

@Service
public class DeckService {

    private final DeckRepository deckRepository;
    private final DeckCardRepository deckCardRepository;
    private final CardRepository cardRepository;
    private final RegistroRepository userRepository;
    private final int minDeckCards;
    private final AuthService authService;
    public DeckService(DeckRepository deckRepository, 
                       DeckCardRepository deckCardRepository,
                       CardRepository cardRepository,
                       RegistroRepository userRepository,
                       AuthService authService,
                       @Value("${deck.validation.min-cards:60}") int minDeckCards) {
        this.deckRepository = deckRepository;
        this.deckCardRepository = deckCardRepository;
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
        this.minDeckCards = minDeckCards;
        this.authService = authService;
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

        // Check for max 4 copies


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
    return createDeck(userId, deckDTO, false);
}

@Transactional
public DeckResponseDTO createDeck(Long userId, CreateDeckDTO deckDTO, boolean skipValidation) {
    if (!skipValidation) {
        validateDeck(deckDTO);
    }

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

@Transactional
public DeckResponseDTO createDeck(String authorization, CreateDeckDTO deckDTO) {
    String token = authorization.substring(7);
    Long userId = authService.getUserId(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));
    
    return createDeck(userId, deckDTO);
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
        Deck deck = deckRepository.findByIdWithCards(deckId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mazo no encontrado"));

        boolean isOwner = userId != null && deck.getUser().getId().equals(userId);
        if (!deck.getPublic() && !isOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso para ver este mazo privado");
        }
        
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
        /**
     * Copia un mazo
     */
    @Transactional
public DeckResponseDTO copyDeck(Long deckId, Long currentUserId) {
    Deck originalDeck = deckRepository.findById(deckId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mazo original no encontrado"));

    if (originalDeck.getPublic() == null || !originalDeck.getPublic()) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se puede copiar un mazo privado");
    }

    User currentUser = userRepository.findById(currentUserId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

    Deck newDeck = new Deck();
    newDeck.setUser(currentUser);
    newDeck.setName(originalDeck.getName() + " (Copia)");
    newDeck.setDescription(originalDeck.getDescription());
    newDeck.setFormat(originalDeck.getFormat());
    newDeck.setPublic(false);

    originalDeck.getCards().forEach(originalCard -> {
        newDeck.addCard(originalCard.getCard(), originalCard.getQuantity());
    });

    newDeck.recalculateTotalCards();
    Deck savedDeck = deckRepository.save(newDeck);

    return DeckResponseDTO.fromEntity(savedDeck);
}
@Transactional
public DeckResponseDTO copyDeck(Long deckId, String authorization) {
    String token = authorization.substring(7);
    Long userId = authService.getUserId(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));
    
    return copyDeck(deckId, userId);
}

    @Transactional(readOnly = true)
    public String exportDeck(Long deckId, Long userId) {
        Deck deck = deckRepository.findByIdWithCards(deckId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mazo no encontrado"));

        ensureOwner(deck, userId);

        StringBuilder sb = new StringBuilder();
        for (com.magicvs.backend.model.DeckCard dc : deck.getCards()) {
            sb.append(dc.getQuantity()).append(" ").append(dc.getCard().getName()).append("\r\n");
        }
        return sb.toString();
    }

    @Transactional
    public ImportDeckResponseDTO importDeck(Long userId, ImportDeckRequestDTO request) {
        if (request.getDeckText() == null || request.getDeckText().trim().isEmpty()) {
            throw new IllegalArgumentException("El texto del mazo está vacío");
        }

        List<CreateDeckDTO.DeckCardDTO> cards = new ArrayList<>();
        List<String> missingCards = new ArrayList<>();
        String[] lines = request.getDeckText().split("\\r?\\n");
        Pattern pattern = Pattern.compile("^\\s*(\\d+)\\s+(.+?)(?:\\s+\\(|$)");

        for (String line : lines) {
            String trimmedLine = line.trim();
            if (trimmedLine.isEmpty() || trimmedLine.equalsIgnoreCase("Deck") || trimmedLine.equalsIgnoreCase("Commander")) {
                continue;
            }
            if (trimmedLine.equalsIgnoreCase("Sideboard")) {
                break;
            }

            Matcher matcher = pattern.matcher(trimmedLine);
            if (matcher.find()) {
                int quantity = Integer.parseInt(matcher.group(1));
                String cardName = matcher.group(2).trim();

                Card card = cardRepository.findByNameOrPrintedName(cardName).stream().findFirst()
                    .orElseGet(() -> cardRepository.findByNameContainingIgnoreCase(cardName + " //").stream().findFirst().orElse(null));

                if (card == null) {
                    // Try to match just the first part if the DB has exactly the cardName but the import text has "Front // Back"
                    if (cardName.contains("//")) {
                        String frontName = cardName.split("//")[0].trim();
                        card = cardRepository.findByNameOrPrintedName(frontName).stream().findFirst()
                            .orElseGet(() -> cardRepository.findByNameContainingIgnoreCase(frontName + " //").stream().findFirst().orElse(null));
                    }
                }

                if (card != null) {
                    cards.add(new CreateDeckDTO.DeckCardDTO(card.getId(), quantity));
                } else {
                    missingCards.add(cardName);
                }
            }
        }

        if (cards.isEmpty()) {
            throw new IllegalArgumentException("No se pudieron encontrar cartas válidas en el texto proporcionado");
        }

        CreateDeckDTO createDeckDTO = new CreateDeckDTO();
        createDeckDTO.setName(request.getName() != null && !request.getName().trim().isEmpty() ? request.getName() : "Mazo Importado");
        createDeckDTO.setDescription("Mazo importado.");
        createDeckDTO.setIsPublic(false);
        createDeckDTO.setCards(cards);

        DeckResponseDTO deck = createDeck(userId, createDeckDTO, true);
        return new ImportDeckResponseDTO(deck, missingCards);
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
            deck.getPublic(),
            getBestArtCrop(deck)
        );
    }

    private String getBestArtCrop(Deck deck) {
        if (deck.getCards() == null || deck.getCards().isEmpty()) {
            return null;
        }

        com.magicvs.backend.model.DeckCard bestCard = null;
        int bestLevel = -1;

        for (com.magicvs.backend.model.DeckCard dc : deck.getCards()) {
            String rarity = (dc.getCard().getRarity() != null) ? dc.getCard().getRarity().toLowerCase() : "common";
            int level = switch (rarity) {
                case "mythic" -> 4;
                case "rare" -> 3;
                case "uncommon" -> 2;
                case "common" -> 1;
                default -> 0;
            };

            if (level > bestLevel) {
                bestLevel = level;
                bestCard = dc;
            }
        }

        return (bestCard != null) ? bestCard.getCard().getArtCropUri() : null;
    }
}
