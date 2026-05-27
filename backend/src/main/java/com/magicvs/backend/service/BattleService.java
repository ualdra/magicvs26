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
    private final TournamentService tournamentService;

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
        if (state.getActionLog().size() > 50) {
            state.getActionLog().remove(0);
        }
    }

    @Transactional
    public MatchResultDTO finishMatch(Long matchId, Long winnerId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new RuntimeException("Match not found"));
        
        if (match.getStatus() == MatchStatus.FINISHED) {
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

        // Persistir ELO en la entidad Match
        match.setEloBeforeP1(oldEloP1);
        match.setEloAfterP1(newEloWinner);
        match.setEloBeforeP2(oldEloP2);
        match.setEloAfterP2(newEloLoser);
        match.setEloChange(Math.abs(newEloWinner - oldEloP1));

        // Guardar ganador y arquetipos de mazo en la partida
        match.setWinnerId(winnerId);
        if (match.getDeckArchetype1() == null && match.getDeck1Id() != null) {
            deckRepository.findById(match.getDeck1Id()).ifPresent(deck -> {
                match.setDeckArchetype1(deck.getName());
            });
        }
        if (match.getDeckArchetype2() == null && match.getDeck2Id() != null) {
            deckRepository.findById(match.getDeck2Id()).ifPresent(deck -> {
                match.setDeckArchetype2(deck.getName());
            });
        }

        // Marcar match como finalizado
        match.setWinnerId(winnerId);
        match.setStatus(MatchStatus.FINISHED);
        match.setEloChange(newEloWinner - (winner.getId().equals(p1.getId()) ? oldEloP1 : oldEloP2));
        match.setFinishedAt(java.time.LocalDateTime.now());
        matchRepository.save(match);

        tournamentService.completeArenaMatchResult(matchId, winnerId);

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
        pState.setExile(new ArrayList<>());
        pState.setLibraryCount(library.size());
        pState.setHandCount(hand.size());
        pState.setGraveyardCount(0);
        pState.setExileCount(0);

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
        
        // Inicializar propiedades avanzadas por defecto
        cs.setIsToken(false);
        cs.setIsDoubleFaced(card.getLayout() != null && card.getLayout().equals("transform"));
        cs.setCurrentFaceIndex(0);
        cs.setCounters(new java.util.HashMap<>());
        cs.setAttachedToCardId(null);
        cs.setAttachedCardIds(new ArrayList<>());
        cs.setTempPowerModifier(0);
        cs.setTempToughnessModifier(0);
        cs.setCrewed(false);
        cs.setHasSummoningSickness(true);
        cs.setExileOnResolution(false);

        // Adventure detection
        boolean isAdventure = card.getLayout() != null && card.getLayout().equals("adventure");
        cs.setIsAdventure(isAdventure);
        if (isAdventure && card.getFaces() != null && card.getFaces().size() > 1) {
            CardFace adventureFace = card.getFaces().get(1);
            cs.setAdventureName(adventureFace.getName());

            List<String> advSymbols = new ArrayList<>();
            String advMana = adventureFace.getManaCost();
            if (advMana != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\{[^}]+\\}").matcher(advMana);
                while (m.find()) {
                    advSymbols.add(m.group());
                }
            }
            cs.setAdventureManaCost(advSymbols);
            cs.setAdventureType(adventureFace.getTypeLine());
            cs.setAdventureOracleText(adventureFace.getOracleText());
        }
        
        return cs;
    }

    @Transactional
    public void updateGameState(Long matchId, Object state) {
        Match match = matchRepository.findById(matchId).orElseThrow();
        if (match.getStatus() == MatchStatus.FINISHED) {
            log.warn("Attempted to update state for finished match {}", matchId);
            return;
        }
        try {
            match.setLiveState(objectMapper.writeValueAsString(state));
            matchRepository.save(match);
            resolveWinnerFromState(state).ifPresent(winnerId -> {
                if (match.getStatus() != MatchStatus.FINISHED) {
                    finishMatch(matchId, winnerId);
                }
            });
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize game state update for match {}", matchId, e);
        }
    }

    private Optional<Long> resolveWinnerFromState(Object state) {
        try {
            com.fasterxml.jackson.databind.JsonNode winnerNode = objectMapper.valueToTree(state).get("winnerId");
            if (winnerNode == null || winnerNode.isNull()) {
                return Optional.empty();
            }
            if (winnerNode.isNumber()) {
                return Optional.of(winnerNode.asLong());
            }
            if (winnerNode.isTextual()) {
                String rawWinner = winnerNode.asText();
                if (rawWinner == null || rawWinner.isBlank() || "DRAW".equalsIgnoreCase(rawWinner)) {
                    return Optional.empty();
                }
                return Optional.of(Long.parseLong(rawWinner));
            }
        } catch (IllegalArgumentException ex) {
            log.warn("Ignoring unsupported winnerId in game state", ex);
        }
        return Optional.empty();
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

        Match match = matchRepository.findById(matchId).orElse(null);
        if (match == null) return null;
        boolean validPlayer = (match.getPlayer1() != null && match.getPlayer1().getId().toString().equals(action.getPlayerId()))
                           || (match.getPlayer2() != null && match.getPlayer2().getId().toString().equals(action.getPlayerId()));
        if (!validPlayer) {
            log.warn("Rejected action {} from player {} not in match {}", action.getType(), action.getPlayerId(), matchId);
            return null;
        }

        log.info("Processing action: {} from user {}", action.getType(), action.getPlayerId());
        
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
            case "CONCEDE":
                handleConcede(matchId, state, action.getPlayerId());
                break;
            default:
                break;
        }

        updateGameState(matchId, state);
        return state;
    }

    private void handleConcede(Long matchId, GameState state, String playerId) {
        String winnerId = playerId.equals(state.getPlayer1().getId()) ? state.getPlayer2().getId() : state.getPlayer1().getId();
        state.setWinnerId(winnerId);
        
        PlayerGameState concedingPlayer = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        addToLog(state, concedingPlayer.getUsername() + " se ha rendido.");
        addToLog(state, "--- Partida Finalizada ---");

        try {
            MatchResultDTO result = finishMatch(matchId, Long.parseLong(winnerId));
            if (result == null) {
                log.warn("Match {} already finished, concede ignored", matchId);
                return;
            }
        } catch (Exception e) {
            log.error("Failed to finish match with ELO calculation", e);
            state.setWinnerId(null);
            addToLog(state, "Error al finalizar la partida. Reintente.");
            return;
        }
    }

    private void handleTapCard(GameState state, String playerId, String cardId, String manaProduced) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        CardState card = p.getField().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        if (card != null) {
            card.setTapped(!card.isTapped());
            String msg = p.getUsername() + (card.isTapped() ? " gira " : " endereza ") + card.getName();
            if (manaProduced != null && !manaProduced.isEmpty()) msg += " y añade " + manaProduced;
            addToLog(state, msg);
        }
    }

    private void handleDeclareAttacker(GameState state, String playerId, String cardId, String targetId) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        CardState card = p.getField().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        if (card != null) {
            card.setAttacking(!card.isAttacking());
            card.setAttackingTargetId(targetId);
            addToLog(state, p.getUsername() + (card.isAttacking() ? " ataca con " : " detiene ataque de ") + card.getName());
        }
    }

    private void handleDeclareBlocker(GameState state, String playerId, String cardId, String targetId) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        CardState card = p.getField().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        if (card != null) {
            card.setBlocking(!card.isBlocking());
            card.setBlockingTargetId(targetId);
            addToLog(state, p.getUsername() + " bloquea con " + card.getName());
        }
    }

    private void handleLifeChange(GameState state, String playerId, Integer amount, String targetPlayerId) {
        PlayerGameState target = state.getPlayer1().getId().equals(targetPlayerId) ? state.getPlayer1() : state.getPlayer2();
        if (amount != null) {
            target.setHp(Math.max(0, target.getHp() + amount));
            addToLog(state, target.getUsername() + (amount < 0 ? " pierde " : " gana ") + Math.abs(amount) + " de vida. HP: " + target.getHp());
        }
    }

    private void handlePlayCard(GameState state, String playerId, String cardId) {
        PlayerGameState p = state.getPlayer1().getId().equals(playerId) ? state.getPlayer1() : state.getPlayer2();
        CardState card = p.getHand().stream().filter(c -> c.getId().equals(cardId)).findFirst().orElse(null);
        if (card != null) {
            p.getHand().remove(card);
            p.getField().add(card);
            addToLog(state, p.getUsername() + " lanza " + card.getName() + " desde la mano al campo.");
        }
    }

    private void handlePassPriority(GameState state, String playerId) {
        state.setPassedCount(state.getPassedCount() + 1);
        addToLog(state, "Jugador " + playerId + " pasa prioridad (passedCount=" + state.getPassedCount() + ").");
    }

    private void nextPhase(GameState state) {
        String[] phases = {"UNTAP", "UPKEEP", "DRAW", "MAIN 1", "COMBAT", "MAIN 2", "END"};
        int currentIndex = -1;
        for (int i = 0; i < phases.length; i++) {
            if (phases[i].equals(state.getCurrentPhase())) { currentIndex = i; break; }
        }
        int nextIndex = currentIndex + 1;
        if (nextIndex >= phases.length) {
            String nextPlayer = state.getActivePlayerId().equals(state.getPlayer1().getId()) ? state.getPlayer2().getId() : state.getPlayer1().getId();
            state.setActivePlayerId(nextPlayer);
            state.setTurnCount(state.getTurnCount() + 1);
            state.setCurrentPhase("UNTAP");
            PlayerGameState active = nextPlayer.equals(state.getPlayer1().getId()) ? state.getPlayer1() : state.getPlayer2();
            addToLog(state, "--- Turno " + state.getTurnCount() + " (" + active.getUsername() + ") ---");
            addToLog(state, "Fase: UNTAP");
        } else {
            state.setCurrentPhase(phases[nextIndex]);
            addToLog(state, "Fase: " + phases[nextIndex]);
        }
    }

    public GameState getSpectatorState(Long userId, Long matchId, Long friendId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new RuntimeException("Match not found"));
        GameState state = getGameState(matchId);
        if (state == null) return null;
        String friendIdStr = friendId.toString();
        if (state.getPlayer1() != null && !state.getPlayer1().getId().equals(friendIdStr)) {
            for (CardState card : state.getPlayer1().getHand()) hideCard(card);
        }
        if (state.getPlayer2() != null && !state.getPlayer2().getId().equals(friendIdStr)) {
            for (CardState card : state.getPlayer2().getHand()) hideCard(card);
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
        private List<String> actionLog;
        private String winnerId;

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
        private List<CardState> exile;
        private int libraryCount;
        private int handCount;
        private int graveyardCount;
        private int exileCount;
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
        @com.fasterxml.jackson.annotation.JsonProperty("attackingTargetId")
        private String attackingTargetId;
        @com.fasterxml.jackson.annotation.JsonProperty("isBlocking")
        private boolean isBlocking;
        private String blockingTargetId;
        private int enteredFieldTurn;
        private String power;
        private String toughness;
        private int damageTaken;
        private List<String> orderedBlockers;
        private List<String> producedMana;

        // Propiedades avanzadas
        private Boolean isToken;
        private Boolean isDoubleFaced;
        private Integer currentFaceIndex;
        private java.util.Map<String, Integer> counters;
        private String attachedToCardId;
        private List<String> attachedCardIds;
        private Integer tempPowerModifier;
        private Integer tempToughnessModifier;
        private Boolean crewed;
        private Boolean hasSummoningSickness;
        private Boolean exileOnResolution;

        // Adventure
        private Boolean isAdventure;
        private String adventureName;
        private List<String> adventureManaCost;
        private String adventureType;
        private String adventureOracleText;
    }
}
