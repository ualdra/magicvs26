package com.magicvs.backend.controller;

import com.magicvs.backend.dto.ChangePasswordDto;
import com.magicvs.backend.dto.ProfileResponseDto;
import com.magicvs.backend.dto.UpdateProfileDto;
import com.magicvs.backend.dto.UserDeckSummaryDto;
import com.magicvs.backend.service.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/profile")
public class UserProfileController {

	private final UserProfileService userProfileService;

	public UserProfileController(UserProfileService userProfileService) {
		this.userProfileService = userProfileService;
	}

	@GetMapping("/{userId}")
	public ResponseEntity<ProfileResponseDto> getUserProfile(@PathVariable Long userId) {
		return ResponseEntity.ok(userProfileService.getProfileByUserId(userId));
	}

	@GetMapping("/me")
	public ResponseEntity<ProfileResponseDto> getMyProfile(
			@RequestHeader(name = "Authorization", required = false) String authorization
	) {
		return ResponseEntity.ok(userProfileService.getProfileOfAuthenticatedUser(authorization));
	}

    @PatchMapping("/me")
    public ResponseEntity<ProfileResponseDto> updateMyProfile(
            @RequestHeader(name = "Authorization") String authorization,
            @RequestBody UpdateProfileDto dto
    ) {
        return ResponseEntity.ok(userProfileService.updateProfile(authorization, dto));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMyAccount(
            @RequestHeader(name = "Authorization") String authorization
    ) {
        userProfileService.deleteAccount(authorization);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/me/password")
    public ResponseEntity<Void> changeMyPassword(
            @RequestHeader(name = "Authorization") String authorization,
            @RequestBody ChangePasswordDto dto
    ) {
        userProfileService.changePassword(authorization, dto);
        return ResponseEntity.noContent().build();
    }

	@GetMapping("/{userId}/decks")
	public ResponseEntity<List<UserDeckSummaryDto>> getUserDecks(@PathVariable Long userId) {
		return ResponseEntity.ok(userProfileService.getDecksByUserId(userId));
	}

	@GetMapping("/me/decks")
	public ResponseEntity<List<UserDeckSummaryDto>> getMyDecks(
			@RequestHeader(name = "Authorization", required = false) String authorization
	) {
		return ResponseEntity.ok(userProfileService.getDecksOfAuthenticatedUser(authorization));
	}
}
