package com.magicvs.backend.service;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.IngestionJobType;
import com.magicvs.backend.model.News;
import com.magicvs.backend.repository.NewsRepository;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
@Profile("worker")
public class IngestionJobDispatcher {

    private final ScryfallService scryfallService;
    private final NewsScrapingService newsScrapingService;
    private final NewsRepository newsRepository;
    private final MetaScrapingService metaScrapingService;
    private final ImageDownloadService imageDownloadService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public IngestionJobDispatcher(
            ScryfallService scryfallService,
            NewsScrapingService newsScrapingService,
            NewsRepository newsRepository,
            MetaScrapingService metaScrapingService,
            ImageDownloadService imageDownloadService) {
        this.scryfallService = scryfallService;
        this.newsScrapingService = newsScrapingService;
        this.newsRepository = newsRepository;
        this.metaScrapingService = metaScrapingService;
        this.imageDownloadService = imageDownloadService;
    }

    public void dispatch(IngestionJobType type, String payloadJson) {
        JsonNode payload = parse(payloadJson);
        switch (type) {
            case CARD_IMPORT_STANDARD -> importStandardCards();
            case CARD_IMPORT_BY_NAME -> importCardByName(payload);
            case CARD_IMPORT_BY_SET -> importCardsBySet(payload);
            case CARD_IMAGE_SYNC -> imageDownloadService.downloadMissingImages();
            case NEWS_SYNC -> syncNews();
            case META_SYNC -> metaScrapingService.syncMetagame(text(payload, "days", "30"));
        }
    }

    private void importStandardCards() {
        scryfallService.importStandardCards();
        imageDownloadService.downloadMissingImages();
    }

    private void importCardByName(JsonNode payload) {
        String name = requiredText(payload, "name");
        boolean onlyStandard = bool(payload, "onlyStandard", true);
        Card card = scryfallService.importCardByName(name, onlyStandard);
        if (card == null) {
            throw new IllegalArgumentException("No se pudo encontrar o importar la carta: " + name);
        }
        imageDownloadService.downloadMissingImages();
    }

    private void importCardsBySet(JsonNode payload) {
        String code = requiredText(payload, "code");
        boolean onlyStandard = bool(payload, "onlyStandard", true);
        scryfallService.importCardsBySet(code, onlyStandard);
        imageDownloadService.downloadMissingImages();
    }

    private void syncNews() {
        List<News> scrapedNews = newsScrapingService.scrapeNews();
        for (News news : scrapedNews) {
            if (!newsRepository.existsByUrl(news.getUrl())) {
                newsRepository.save(news);
            }
        }
    }

    private JsonNode parse(String payloadJson) {
        try {
            return objectMapper.readTree(payloadJson == null || payloadJson.isBlank() ? "{}" : payloadJson);
        } catch (Exception e) {
            throw new IllegalArgumentException("Payload de ingesta inválido", e);
        }
    }

    private String requiredText(JsonNode payload, String field) {
        String value = text(payload, field, null);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Falta el campo obligatorio '" + field + "' en el payload de ingesta");
        }
        return value;
    }

    private String text(JsonNode payload, String field, String fallback) {
        JsonNode value = payload.get(field);
        return value == null || value.isNull() ? fallback : value.asText();
    }

    private boolean bool(JsonNode payload, String field, boolean fallback) {
        JsonNode value = payload.get(field);
        return value == null || value.isNull() ? fallback : value.asBoolean();
    }

    @Scheduled(cron = "0 0 0 * * ?")
    public void scheduledSyncNews() {
        log.info("Ejecutando sincronización programada de noticias...");
        syncNews();
    }
}
