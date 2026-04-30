package com.magicvs.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.magicvs.backend.model.*;
import com.magicvs.backend.repository.DeckRepository;
import com.magicvs.backend.repository.MatchRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BattleService {

    private final MatchRepository matchRepository;
    private final DeckRepository deckRepository;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Transactional
    public void initializeMatch(Long matchId, Long d1Id, Long d2Id) {
        Match match = matchRepository.findById(matchId).orElseThrow();
        
        match.setDeck1Id(d1Id);
        match.setDeck2Id(d2Id);
        
        GameState state = new GameState();
        state.setMatchId(matchId.toString());
        state.setActivePlayerId(match.getPlayer1().getId().toString());
        state.setPriorityPlayerId(match.getPlayer1().getId().toString());
        state.setPassedCount(0);
        state.setStack(new ArrayList<>());
        state.setCurrentPhase("UNTAP");
        state.setTurnCount(1);
        state.setAnimationStatus("IDLE");
        
        state.setPlayer1(initializePlayerState(match.getPlayer1(), d1Id));
        state.setPlayer2(initializePlayerState(match.getPlayer2(), d2Id));
        
        try {
            match.setLiveState(objectMapper.writeValueAsString(state));
            matchRepository.save(match);
            log.info("Initialized game state for match {}", matchId);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize game state for match {}", matchId, e);
        }
    }

    private PlayerGameState initializePlayerState(User user, Long deckId) {
        PlayerGameState pState = new PlayerGameState();
        pState.setId(user.getId().toString());
        pState.setUsername(user.getDisplayName() != null ? user.getDisplayName() : user.getUsername());
        pState.setAvatarUrl(user.getAvatarUrl());
        pState.setHp(20);
        pState.setMulliganCount(0);
        pState.setReady(false);
        pState.setManaPool(new ManaPool());

        Deck deck = deckRepository.findById(deckId).orElseThrow();
        List<CardState> library = new ArrayList<>();
        
        for (DeckCard dc : deck.getCards()) {
            for (int i = 0; i < dc.getQuantity(); i++) {
                library.add(mapToCardState(dc.getCard()));
            }
        }
        
        Collections.shuffle(library);
        
        // Draw initial 7 cards
        List<CardState> hand = new ArrayList<>();
        for (int i = 0; i < 7 && !library.isEmpty(); i++) {
            hand.add(library.remove(0));
        }

        pState.setLibrary(library);
        pState.setHand(hand);
        pState.setField(new ArrayList<>());
        pState.setGraveyard(new ArrayList<>());
        pState.setLibraryCount(library.size());
        pState.setHandCount(hand.size());
        pState.setGraveyardCount(0);

        return pState;
    }

    private CardState mapToCardState(Card card) {
        CardState cs = new CardState();
        cs.setId(UUID.randomUUID().toString());
        cs.setCardId(card.getId());
        cs.setName(card.getName());
        
        // Handle DFC Image: fallback to first face if top-level is null
        String imageUrl = card.getNormalImageUri();
        if (imageUrl == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            imageUrl = card.getFaces().get(0).getNormalImageUri();
        }
        cs.setImageUrl(imageUrl);
        
        // Type Line fallback for DFCs
        String typeLine = card.getTypeLine();
        if (typeLine == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            typeLine = card.getFaces().get(0).getTypeLine();
        }
        cs.setType(typeLine);
        cs.setTapped(false);
        cs.setAttacking(false);
        cs.setBlocking(false);
        cs.setEnteredFieldTurn(0); // Will be set by engine when played

        // Oracle Text fallback for DFCs
        String oracleText = card.getOracleText();
        if (oracleText == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            oracleText = card.getFaces().get(0).getOracleText();
        }
        cs.setOracleText(oracleText);

        // Handle DFC Mana Cost: fallback to first face if top-level is null
        String rawManaCost = card.getManaCost();
        if ((rawManaCost == null || rawManaCost.isEmpty()) && card.getFaces() != null && !card.getFaces().isEmpty()) {
            rawManaCost = card.getFaces().get(0).getManaCost();
        }
        
        List<String> symbols = new ArrayList<>();
        if (rawManaCost != null) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\{[^}]+\\}").matcher(rawManaCost);
            while (m.find()) {
                symbols.add(m.group());
            }
        }
        cs.setManaCost(symbols);

        // Power and Toughness
        cs.setPower(card.getPower());
        cs.setToughness(card.getToughness());
        if (cs.getPower() == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            cs.setPower(card.getFaces().get(0).getPower());
            cs.setToughness(card.getFaces().get(0).getToughness());
        }

        // Handle produced mana
        String producedJson = card.getProducedManaJson();
        if ((producedJson == null || producedJson.equals("[]")) && card.getFaces() != null && !card.getFaces().isEmpty()) {
            producedJson = card.getFaces().get(0).getColorsJson(); // Fallback to colors if produced is missing
        }
        
        List<String> produced = new ArrayList<>();
        try {
            com.fasterxml.jackson.databind.JsonNode prodNode = objectMapper.readTree(producedJson != null ? producedJson : "[]");
            if (prodNode.isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode n : prodNode) {
                    produced.add(n.asText());
                }
            }
        } catch (Exception e) {
            // Ignore parse errors
        }
        cs.setProducedMana(produced);
        
        return cs;
    }

    public void updateGameState(Long matchId, Object state) {
        Match match = matchRepository.findById(matchId).orElseThrow();
        try {
            match.setLiveState(objectMapper.writeValueAsString(state));
            matchRepository.save(match);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize game state update for match {}", matchId, e);
        }
    }

    public GameState getGameState(Long matchId) {
        Match match = matchRepository.findById(matchId).orElse(null);
        if (match == null || match.getLiveState() == null) {
            return null;
        }
        try {
            return objectMapper.readValue(match.getLiveState(), GameState.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize game state for match {}", matchId, e);
            return null;
        }
    }

    @Data
    public static class GameState {
        private String matchId;
        private int turnCount;
        private String activePlayerId;
        private String priorityPlayerId;
        private int passedCount;
        private List<StackItem> stack;
        private String currentPhase;
        private String animationStatus;
        private PlayerGameState player1;
        private PlayerGameState player2;
        private int landsPlayedThisTurn;
        private List<PendingBlockerOrder> pendingBlockerOrders;
        private Object pendingManaChoice;
        private Object pendingTarget;

        public static Class<GameState> getReturnType() {
            return GameState.class;
        }
    }

    @Data
    public static class StackItem {
        private String id;
        private String sourceCardId;
        private String controllerId;
        private String type; // SPELL, ABILITY, TRIGGER
        private String name;
        private CardState card;
        private String imageUrl;
        private String targetId;
        private String targetType;
        private Object effect;
    }

    @Data
    public static class PendingBlockerOrder {
        private String attackerId;
        private List<String> blockerIds;
    }

    @Data
    public static class PlayerGameState {
        private String id;
        private String username;
        private String avatarUrl;
        private int hp;
        private List<CardState> library;
        private List<CardState> hand;
        private List<CardState> field;
        private List<CardState> graveyard;
        private int libraryCount;
        private int handCount;
        private int graveyardCount;
        private int mulliganCount;
        @com.fasterxml.jackson.annotation.JsonProperty("isReady")
        private boolean isReady;
        private ManaPool manaPool;
    }

    @Data
    public static class ManaPool {
        private int white;
        private int blue;
        private int black;
        private int red;
        private int green;
        private int colorless;
    }

    @Data
    public static class CardState {
        private String id; // Unique instance ID for this match
        private Long cardId; // Reference to Card entity
        private String name;
        private String imageUrl;
        private String type;
        private String oracleText;
        @com.fasterxml.jackson.annotation.JsonProperty("manaCost")
        private List<String> manaCost;
        @com.fasterxml.jackson.annotation.JsonProperty("isTapped")
        private boolean isTapped;
        @com.fasterxml.jackson.annotation.JsonProperty("isAttacking")
        private boolean isAttacking;
        @com.fasterxml.jackson.annotation.JsonProperty("isBlocking")
        private boolean isBlocking;
        private String blockingTargetId;
        private int enteredFieldTurn;
        private String power;
        private String toughness;
        private int damageTaken;
        private List<String> orderedBlockers;
        private List<String> producedMana;
    }
}
