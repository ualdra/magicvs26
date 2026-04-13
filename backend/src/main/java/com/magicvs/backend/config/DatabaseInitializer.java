package com.magicvs.backend.config;

import com.magicvs.backend.repository.CardRepository;
import com.magicvs.backend.service.ScryfallService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseInitializer.class);

    private final CardRepository cardRepository;
    private final ScryfallService scryfallService;

    public DatabaseInitializer(CardRepository cardRepository, ScryfallService scryfallService) {
        this.cardRepository = cardRepository;
        this.scryfallService = scryfallService;
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
    }
}
