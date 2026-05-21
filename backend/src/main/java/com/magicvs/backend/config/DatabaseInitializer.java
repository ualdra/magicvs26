package com.magicvs.backend.config;

import com.magicvs.backend.repository.CardRepository;
import com.magicvs.backend.repository.MetaDeckRepository;
import com.magicvs.backend.service.ScryfallService;
import com.magicvs.backend.service.MetaScrapingService;
import com.magicvs.backend.service.ImageDownloadService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseInitializer.class);

    private final CardRepository cardRepository;
    private final ScryfallService scryfallService;
    private final MetaDeckRepository metaDeckRepository;
    private final MetaScrapingService metaScrapingService;
    private final ImageDownloadService imageDownloadService;

    public DatabaseInitializer(CardRepository cardRepository, 
                               ScryfallService scryfallService,
                               MetaDeckRepository metaDeckRepository,
                               MetaScrapingService metaScrapingService,
                               ImageDownloadService imageDownloadService) {
        this.cardRepository = cardRepository;
        this.scryfallService = scryfallService;
        this.metaDeckRepository = metaDeckRepository;
        this.metaScrapingService = metaScrapingService;
        this.imageDownloadService = imageDownloadService;
    }

    @Override
    public void run(String... args) throws Exception {
        if (cardRepository.count() == 0) {
            logger.info("Base de datos de cartas vacía. Iniciando importación automática por lotes (Batching activo)...");
            long startTime = System.currentTimeMillis();
            
            scryfallService.importStandardCards();
            
            long endTime = System.currentTimeMillis();
            logger.info("Importación automática completada en {} segundos.", (endTime - startTime) / 1000);
        } else {
            logger.info("Base de datos de cartas ya poblada con {} registros. Omitiendo importación inicial.", cardRepository.count());
        }

        // Siempre intentar descargar imágenes faltantes en segundo plano tras validar las cartas
        imageDownloadService.downloadMissingImagesAsync();

        if (metaDeckRepository.count() == 0) {
            logger.info("Base de datos de Metajuego vacía. Iniciando scraping automático inicial de MTGGoldfish...");
            metaScrapingService.syncMetagame("30");
        } else {
            logger.info("Metajuego ya inicializado con {} mazos. Esperando al demonio nocturno para actualizar.", metaDeckRepository.count());
        }
    }
}
