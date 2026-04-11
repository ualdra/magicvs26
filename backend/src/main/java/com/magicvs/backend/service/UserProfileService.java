package com.magicvs.backend.service;

import com.magicvs.backend.dto.ProfileResponseDto;
import com.magicvs.backend.dto.UserDeckSummaryDto;
import com.magicvs.backend.model.User;
import com.magicvs.backend.model.Deck;
import com.magicvs.backend.model.DeckCard;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.repository.DeckRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.LinkedHashSet;

@Service
@Transactional(readOnly = true)
public class UserProfileService {

    private final RegistroRepository registroRepository;
    private final DeckRepository deckRepository;
    private final AuthService authService;

    public UserProfileService(RegistroRepository registroRepository, DeckRepository deckRepository, AuthService authService) {
        this.registroRepository = registroRepository;
        this.deckRepository = deckRepository;
        this.authService = authService;
    }

    public ProfileResponseDto getProfileByUserId(Long userId) {
        User user = registroRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        long decksCount = deckRepository.countByUserId(userId);
        return toProfileResponse(user, decksCount);
    }

    public ProfileResponseDto getProfileOfAuthenticatedUser(String authorization) {
        Long userId = extractUserIdFromAuthorization(authorization);
        return getProfileByUserId(userId);
    }

    public List<UserDeckSummaryDto> getDecksByUserId(Long userId) {
        if (!registroRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado");
        }

        return deckRepository.findByUserIdOrderByUpdatedAtDesc(userId)
                .stream()
                .map(this::toDeckSummary)
                .toList();
    }

    public List<UserDeckSummaryDto> getDecksOfAuthenticatedUser(String authorization) {
        Long userId = extractUserIdFromAuthorization(authorization);
        return getDecksByUserId(userId);
    }

    private Long extractUserIdFromAuthorization(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing token");
        }

        String token = authorization.substring("Bearer ".length());
        return authService.getUserId(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));
    }

    private ProfileResponseDto toProfileResponse(User user, long decksCount) {
        return new ProfileResponseDto(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getCountry(),
                user.getBio(),
                user.getEloRating(),
                user.getGamesPlayed(),
                user.getGamesWon(),
                user.getGamesLost(),
                user.getFriendTag(),
                user.getFriendsCount(),
                decksCount
        );
    }

    private UserDeckSummaryDto toDeckSummary(Deck deck) {
        return new UserDeckSummaryDto(
                deck.getId(),
                deck.getName(),
                deck.getDescription(),
            deck.getFormat() != null ? deck.getFormat().name() : null,
                deck.getTotalCards(),
                deck.getPublic(),
                deck.getCreatedAt(),
                deck.getUpdatedAt(),
                extractColors(deck)
        );
    }

    private List<String> extractColors(Deck deck) {
        Set<String> colors = new LinkedHashSet<>();

        for (DeckCard deckCard : deck.getCards()) {
            String manaCost = deckCard.getCard().getManaCost();
            if (manaCost == null || manaCost.isBlank()) {
                continue;
            }

            String upper = manaCost.toUpperCase(Locale.ROOT);
            if (upper.contains("{W}")) colors.add("W");
            if (upper.contains("{U}")) colors.add("U");
            if (upper.contains("{B}")) colors.add("B");
            if (upper.contains("{R}")) colors.add("R");
            if (upper.contains("{G}")) colors.add("G");
        }

        return new ArrayList<>(colors);
    }
}
