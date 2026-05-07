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
        state.setActionLog(new ArrayList<>());
        
        state.setPlayer1(initializePlayerState(match.getPlayer1(), d1Id));
        state.setPlayer2(initializePlayerState(match.getPlayer2(), d2Id));
        
        addToLog(state, "--- ¡Comienza la batalla! ---");
        addToLog(state, "Turno 1: " + state.getPlayer1().getUsername());
        
        try {
            match.setLiveState(objectMapper.writeValueAsString(state));
            matchRepository.save(match);
            log.info("Initialized game state for match {}", matchId);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize game state for match {}", matchId, e);
        }
    }

    private void addToLog(GameState state, String message) {
        if (state.getActionLog() == null) {
            state.setActionLog(new ArrayList<>());
        }
        state.getActionLog().add(message);
        // Opcional: limitar el historial a los últimos 50 mensajes para rendimiento
        if (state.getActionLog().size() > 50) {
            state.getActionLog().remove(0);
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

    @Transactional
    public GameState processAction(Long matchId, com.magicvs.backend.dto.BattleAction action) {
        GameState state = getGameState(matchId);
        if (state == null) return null;

        log.info("Processing action for log: {} from user {}", action.getType(), action.getPlayerId());
        
        switch (action.getType().toUpperCase()) {
            case "PLAY_CARD":
                handlePlayCard(state, action.getPlayerId(), (String) action.getPayload().get("cardId"));
                break;
            case "TAP_CARD":
                handleTapCard(state, action.getPlayerId(), (String) action.getPayload().get("cardId"), (String) action.getPayload().get("manaProduced"));
                break;
            case "DECLARE_ATTACKER":
                handleDeclareAttacker(state, action.getPlayerId(), (String) action.getPayload().get("cardId"), (String) action.getPayload().get("targetId"));
                break;
            case "DECLARE_BLOCKER":
                handleDeclareBlocker(state, action.getPlayerId(), (String) action.getPayload().get("cardId"), (String) action.getPayload().get("targetId"));
                break;
            case "LIFE_CHANGE":
                handleLifeChange(state, action.getPlayerId(), (Integer) action.getPayload().get("amount"), (String) action.getPayload().get("targetPlayerId"));
                break;
            case "NEXT_PHASE":
                nextPhase(state);
                break;
            case "PASS_PRIORITY":
                handlePassPriority(state, action.getPlayerId());
                break;
            default:
                break;
        }

        updateGameState(matchId, state);
        return state;
    }

    private void handleTapCard(GameState state, String playerId, String cardId, String manaProduced) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        CardState card = p.getField().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        
        if (card != null) {
            String msg = p.getUsername() + " gira " + card.getName();
            if (manaProduced != null && !manaProduced.isEmpty()) {
                msg += " y añade " + manaProduced;
            }
            addToLog(state, msg);
        }
    }

    private void handleDeclareAttacker(GameState state, String playerId, String cardId, String targetId) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        CardState card = p.getField().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        
        if (card != null) {
            addToLog(state, p.getUsername() + " ataca con " + card.getName() + " a " + (targetId != null ? targetId : "oponente"));
        }
    }

    private void handleDeclareBlocker(GameState state, String playerId, String cardId, String targetId) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        CardState card = p.getField().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        
        if (card != null) {
            addToLog(state, p.getUsername() + " bloquea con " + card.getName() + " a " + targetId);
        }
    }

    private void handleLifeChange(GameState state, String playerId, Integer amount, String targetPlayerId) {
        PlayerGameState target = state.getPlayer1().getId().equals(targetPlayerId) ? state.getPlayer1() : state.getPlayer2();
        if (amount != null) {
            String verb = amount < 0 ? " pierde " : " gana ";
            addToLog(state, target.getUsername() + verb + Math.abs(amount) + " de vida.");
        }
    }

    private void handlePlayCard(GameState state, String playerId, String cardId) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        // Buscamos la carta en la mano para el log
        CardState card = p.getHand().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        
        if (card != null) {
            addToLog(state, p.getUsername() + " lanza " + card.getName());
        }
    }

    private void handlePassPriority(GameState state, String playerId) {
        addToLog(state, "Jugador " + playerId + " pasa prioridad.");
    }

    private void nextPhase(GameState state) {
        String[] phases = {"MULLIGAN", "UNTAP", "UPKEEP", "DRAW", "MAIN 1", "COMBAT", "MAIN 2", "END"};
        String current = state.getCurrentPhase();
        int currentIndex = -1;
        for (int i = 0; i < phases.length; i++) {
            if (phases[i].equals(current)) {
                currentIndex = i;
                break;
            }
        }

        int nextIndex = currentIndex + 1;
        if (nextIndex >= phases.length) {
            rotateTurn(state);
        } else {
            String nextPhase = phases[nextIndex];
            state.setCurrentPhase(nextPhase);
            addToLog(state, "Fase: " + nextPhase);
        }
    }

    private void rotateTurn(GameState state) {
        String nextPlayer = state.getActivePlayerId().equals(state.getPlayer1().getId()) 
                ? state.getPlayer2().getId() 
                : state.getPlayer1().getId();
        state.setActivePlayerId(nextPlayer);
        state.setTurnCount(state.getTurnCount() + 1);
        state.setCurrentPhase("UNTAP");
        
        PlayerGameState active = nextPlayer.equals(state.getPlayer1().getId()) ? state.getPlayer1() : state.getPlayer2();
        addToLog(state, "--- Turno " + state.getTurnCount() + " (" + active.getUsername() + ") ---");
        addToLog(state, "Fase: UNTAP");
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
        private List<String> actionLog;

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
