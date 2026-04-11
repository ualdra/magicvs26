package com.magicvs.backend.config;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.CardFace;
import com.magicvs.backend.repository.CardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Component
public class CardExampleSeeder implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(CardExampleSeeder.class);

    private final CardRepository cardRepository;

    public CardExampleSeeder(CardRepository cardRepository) {
        this.cardRepository = cardRepository;
    }

    @Override
    public void run(String... args) {
        List<CardSeed> examples = List.of(
            new CardSeed(
                "11111111-1111-1111-1111-111111111111",
                "Arcane Apprentice",
                "{1}{U}",
                2,
                "Creature - Human Wizard",
                "When Arcane Apprentice enters, draw a card.",
                "[\"U\"]",
                "https://placehold.co/488x680/1f2937/e5e7eb?text=Arcane+Apprentice"
            ),
            new CardSeed(
                "22222222-2222-2222-2222-222222222222",
                "Inferno Raider",
                "{2}{R}",
                3,
                "Creature - Goblin Berserker",
                "Haste",
                "[\"R\"]",
                "https://placehold.co/488x680/1f2937/e5e7eb?text=Inferno+Raider"
            ),
            new CardSeed(
                "33333333-3333-3333-3333-333333333333",
                "Verdant Guardian",
                "{3}{G}",
                4,
                "Creature - Treefolk",
                "Reach",
                "[\"G\"]",
                "https://placehold.co/488x680/1f2937/e5e7eb?text=Verdant+Guardian"
            ),
            new CardSeed(
                "44444444-4444-4444-4444-444444444444",
                "Radiant Pulse",
                "{1}{W}",
                2,
                "Instant",
                "You gain 4 life and draw a card.",
                "[\"W\"]",
                "https://placehold.co/488x680/1f2937/e5e7eb?text=Radiant+Pulse"
            ),
            new CardSeed(
                "55555555-5555-5555-5555-555555555555",
                "Nightveil Ritual",
                "{2}{B}",
                3,
                "Sorcery",
                "Target player discards two cards.",
                "[\"B\"]",
                "https://placehold.co/488x680/1f2937/e5e7eb?text=Nightveil+Ritual"
            ),
            new CardSeed(
                "66666666-6666-6666-6666-666666666666",
                "Mystic Crossroads",
                "",
                0,
                "Land",
                "{T}: Add one mana of any color.",
                "[]",
                "https://placehold.co/488x680/1f2937/e5e7eb?text=Mystic+Crossroads"
            )
        );

        int inserted = 0;
        for (CardSeed seed : examples) {
            if (insertIfMissing(seed)) {
                inserted++;
            }
        }

        if (inserted > 0) {
            logger.info("Inserted {} sample cards for tester flows", inserted);
        }
    }

    private boolean insertIfMissing(CardSeed seed) {
        UUID scryfallId = UUID.fromString(seed.scryfallId());
        if (cardRepository.existsByScryfallId(scryfallId)) {
            return false;
        }

        Card card = new Card();
        card.setScryfallId(scryfallId);
        card.setName(seed.name());
        card.setLang("en");
        card.setLayout("normal");
        card.setManaCost(seed.manaCost());
        card.setCmc(BigDecimal.valueOf(seed.cmc()));
        card.setTypeLine(seed.typeLine());
        card.setOracleText(seed.oracleText());
        card.setRarity("common");
        card.setReserved(false);
        card.setReprint(false);
        card.setDigital(false);
        card.setFoil(true);
        card.setNonfoil(true);
        card.setPromo(false);
        card.setFullArt(false);
        card.setTextless(false);
        card.setColorsJson(seed.colorsJson());
        card.setColorIdentityJson(seed.colorsJson());
        card.setGamesJson("[\"paper\"]");
        card.setKeywordsJson("[]");
        card.setProducedManaJson("[]");
        card.setPurchaseUrisJson("{}");
        card.setRelatedUrisJson("{}");
        card.setRawJson("{}");
        card.setSyncedAt(LocalDateTime.now());

        CardFace face = new CardFace();
        face.setCard(card);
        face.setFaceOrder(0);
        face.setName(seed.name());
        face.setManaCost(seed.manaCost());
        face.setTypeLine(seed.typeLine());
        face.setOracleText(seed.oracleText());
        face.setColorsJson(seed.colorsJson());
        face.setNormalImageUri(seed.normalImageUri());
        face.setSmallImageUri(seed.normalImageUri());
        face.setLargeImageUri(seed.normalImageUri());

        card.getFaces().add(face);
        cardRepository.save(card);
        return true;
    }

    private record CardSeed(
        String scryfallId,
        String name,
        String manaCost,
        int cmc,
        String typeLine,
        String oracleText,
        String colorsJson,
        String normalImageUri
    ) {
    }
}
