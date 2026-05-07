package com.magicvs.backend.controller;

import com.magicvs.backend.dto.NewsDto;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.service.AchievementService;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;
    private final AuthService authService;
    private final RegistroRepository registroRepository;
    private final AchievementService achievementService;

    @GetMapping
    public List<NewsDto> getNews(@RequestHeader(name = "Authorization", required = false) String authorization) {
        // If request contains a Bearer token, try to resolve user and increment news visit achievements
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring("Bearer ".length());
            var userIdOpt = authService.getUserId(token);
            if (userIdOpt.isPresent()) {
                Long userId = userIdOpt.get();
                User user = registroRepository.findById(userId).orElse(null);
                if (user != null) {
                    // Increment first-visit and cumulative news counters
                    achievementService.increment(user, "NEWS_FIRST");
                    achievementService.increment(user, "NEWS_10");
                    achievementService.increment(user, "NEWS_50");
                    achievementService.increment(user, "NEWS_200");
                    achievementService.increment(user, "NEWS_1000");
                }
            }
        }

        return newsService.getAllNews();
    }

    @GetMapping("/last-updated")
    public Map<String, LocalDateTime> getLastUpdated() {
        return Map.of("date", newsService.getLastUpdateDate());
    }

    @PostMapping("/scrape")
    public void manualScrape() {
        newsService.fetchAndSaveNews();
    }
}
