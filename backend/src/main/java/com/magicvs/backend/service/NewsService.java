package com.magicvs.backend.service;

import com.magicvs.backend.dto.NewsDto;
import com.magicvs.backend.model.News;
import com.magicvs.backend.repository.NewsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NewsService {

    private final NewsRepository newsRepository;
    private final NewsScrapingService newsScrapingService;

    @Transactional
    public void fetchAndSaveNews() {
        List<News> scrapedNews = newsScrapingService.scrapeNews();
        for (News news : scrapedNews) {
            if (!newsRepository.existsByUrl(news.getUrl())) {
                newsRepository.save(news);
            }
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
       newsRepository.deleteAll();
        fetchAndSaveNews();
    }

    public LocalDateTime getLastUpdateDate() {
        return newsRepository.findAll().stream()
                .map(News::getPublishDate)
                .max(LocalDateTime::compareTo)
                .orElse(LocalDateTime.now());
    }

    public List<NewsDto> getAllNews() {
        return newsRepository.findAll().stream()
                .map(this::convertToDto)
                .sorted((a, b) -> b.getPublishDate().compareTo(a.getPublishDate()))
                .collect(Collectors.toList());
    }

    private NewsDto convertToDto(News news) {
        return NewsDto.builder()
                .id(news.getId())
                .title(news.getTitle())
                .summary(news.getSummary())
                .url(news.getUrl())
                .imageUrl(news.getImageUrl())
                .publishDate(news.getPublishDate())
                .build();
    }
}
