package com.magicvs.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.magicvs.backend.dto.MatchResultDTO;
import com.magicvs.backend.model.*;
import com.magicvs.backend.repository.DeckRepository;
import com.magicvs.backend.repository.MatchRepository;
import com.magicvs.backend.repository.RegistroRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BattleService {

    private final MatchRepository matchRepository;
    private final DeckRepository deckRepository;
    private final RegistroRepository registroRepository;
    private final EloService eloService;

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

    @Transactional
    public MatchResultDTO finishMatch(Long matchId, Long winnerId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new RuntimeException("Match not found"));
        
        if ("FINISHED".equals(match.getStatus())) {
            log.warn("Match {} already finished", matchId);
            return null; 
        }

        User p1 = match.getPlayer1();
        User p2 = match.getPlayer2();

        // Guardar ELOs previos para el DTO informativo
        int oldEloP1 = p1.getElo();
        int oldEloP2 = p2.getElo();

        // Determinar ganador y perdedor
        User winner = p1.getId().equals(winnerId) ? p1 : p2;
        User loser = p1.getId().equals(winnerId) ? p2 : p1;

        // Calcular nuevos ELOs
        int newEloWinner = eloService.calculateNewElo(winner, loser, true);
        int newEloLoser = eloService.calculateNewElo(loser, winner, false);

        // Actualizar entidades
        winner.setElo(newEloWinner);
        winner.setGamesPlayed(winner.getGamesPlayed() + 1);
        loser.setElo(newEloLoser);
        loser.setGamesPlayed(loser.getGamesPlayed() + 1);

        // Persistir cambios 
        registroRepository.save(winner);
        registroRepository.save(loser);

        // Marcar match como finalizado
        match.setStatus(MatchStatus.FINISHED);
        match.setEloChange(newEloWinner - (winner.getId().equals(p1.getId()) ? oldEloP1 : oldEloP2));
        matchRepository.save(match);

        // Construir resultado para el Frontend
        MatchResultDTO result = new MatchResultDTO();
        result.setPlayer1Id(p1.getId());
        result.setPlayer2Id(p2.getId());
        result.setWinnerId(winnerId);
        result.setEloBeforeP1(oldEloP1);
        result.setEloAfterP1(p1.getElo());
        result.setEloBeforeP2(oldEloP2);
        result.setEloAfterP2(p2.getElo());

        log.info("Match {} finished. Winner: {} (ELO: {} -> {})", 
                matchId, winner.getUsername(), oldEloP1, newEloWinner);
        
        return result;
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
        
        String imageUrl = card.getNormalImageUri();
        if (imageUrl == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            imageUrl = card.getFaces().get(0).getNormalImageUri();
        }
        cs.setImageUrl(imageUrl);
        
        String typeLine = card.getTypeLine();
        if (typeLine == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            typeLine = card.getFaces().get(0).getTypeLine();
        }
        cs.setType(typeLine);
        cs.setTapped(false);
        cs.setAttacking(false);
        cs.setBlocking(false);
        cs.setEnteredFieldTurn(0);

        String oracleText = card.getOracleText();
        if (oracleText == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            oracleText = card.getFaces().get(0).getOracleText();
        }
        cs.setOracleText(oracleText);

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

        cs.setPower(card.getPower());
        cs.setToughness(card.getToughness());
        if (cs.getPower() == null && card.getFaces() != null && !card.getFaces().isEmpty()) {
            cs.setPower(card.getFaces().get(0).getPower());
            cs.setToughness(card.getFaces().get(0).getToughness());
        }

        String producedJson = card.getProducedManaJson();
        if ((producedJson == null || producedJson.equals("[]")) && card.getFaces() != null && !card.getFaces().isEmpty()) {
            producedJson = card.getFaces().get(0).getColorsJson();
        }
        
        List<String> produced = new ArrayList<>();
        try {
            com.fasterxml.jackson.databind.JsonNode prodNode = objectMapper.readTree(producedJson != null ? producedJson : "[]");
            if (prodNode.isArray()) {
                for (com.fasterxml.jackson.databind.JsonNode n : prodNode) {
                    produced.add(n.asText());
                }
            }
        } catch (Exception e) {}
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

    public GameState getSpectatorState(Long userId, Long matchId, Long friendId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new RuntimeException("Match not found"));
        
        GameState state = getGameState(matchId);
        if (state == null) return null;
        
        // Determinar quién es el amigo en el estado (player1 o player2)
        String friendIdStr = friendId.toString();
        
        if (state.getPlayer1() != null && !state.getPlayer1().getId().equals(friendIdStr)) {
            // Player1 NO es el amigo, ocultar su mano
            for (CardState card : state.getPlayer1().getHand()) {
                hideCard(card);
            }
        }
        
        if (state.getPlayer2() != null && !state.getPlayer2().getId().equals(friendIdStr)) {
            // Player2 NO es el amigo, ocultar su mano
            for (CardState card : state.getPlayer2().getHand()) {
                hideCard(card);
            }
        }
        
        return state;
    }

    private void hideCard(CardState card) {
        card.setCardId(null);
        card.setName("Unknown Card");
        card.setImageUrl("https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/f/f8/Magic_card_back.jpg");
        card.setType("Unknown");
        card.setOracleText("");
        card.setManaCost(new ArrayList<>());
        card.setPower("");
        card.setToughness("");
        card.setProducedMana(new ArrayList<>());
    }

    // --- CLASES DTO / INNER CLASSES ---

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
        private String type; 
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
        private String id;
        private Long cardId;
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