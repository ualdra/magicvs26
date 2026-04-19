package com.magicvs.backend.service;

import com.magicvs.backend.dto.ChangePasswordDto;
import com.magicvs.backend.dto.ProfileResponseDto;
import com.magicvs.backend.dto.UpdateProfileDto;
import com.magicvs.backend.dto.UserDeckSummaryDto;
import com.magicvs.backend.model.Deck;
import com.magicvs.backend.model.DeckCard;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.repository.DeckRepository;
import com.magicvs.backend.util.ValidationUtils;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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

    @Transactional
    public ProfileResponseDto updateProfile(String authorization, UpdateProfileDto dto) {
        Long userId = extractUserIdFromAuthorization(authorization);
        User user = registroRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        if (dto.getDisplayName() != null) user.setDisplayName(dto.getDisplayName());
        if (dto.getAvatarUrl() != null) user.setAvatarUrl(dto.getAvatarUrl());
        if (dto.getCountry() != null) user.setCountry(dto.getCountry());
        if (dto.getBio() != null) user.setBio(dto.getBio());

        user.setUpdatedAt(java.time.LocalDateTime.now());
        User saved = registroRepository.save(user);

        return toProfileResponse(saved, deckRepository.countByUserId(userId));
    }

    @Transactional
    public void deleteAccount(String authorization) {
        Long userId = extractUserIdFromAuthorization(authorization);
        
        // 1. Delete associated data (Decks)
        deckRepository.deleteByUserId(userId);
        
        // 2. Delete User
        registroRepository.deleteById(userId);
    }

    @Transactional
    public void changePassword(String authorization, ChangePasswordDto dto) {
        Long userId = extractUserIdFromAuthorization(authorization);
        User user = registroRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        // 1. Verify old password
        if (!encoder.matches(dto.getOldPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña actual es incorrecta");
        }

        // 2. Validate new password strength
        if (!ValidationUtils.isValidPassword(dto.getNewPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nueva contraseña no cumple los requisitos de seguridad");
        }

        // 3. Update and Save
        user.setPasswordHash(encoder.encode(dto.getNewPassword()));
        user.setUpdatedAt(java.time.LocalDateTime.now());
        registroRepository.save(user);
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
                decksCount,
                user.getEmail(),
                user.getCreatedAt(),
                user.getIsOnline(),
                user.getLastSeenAt()
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
