package com.magicvs.backend.service;

import com.magicvs.backend.dto.CardDetailDTO;
import com.magicvs.backend.dto.CardSummaryDTO;
import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.CardFace;
import com.magicvs.backend.model.CardLegality;
import com.magicvs.backend.model.CardPrice;
import com.magicvs.backend.repository.CardRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import java.util.Arrays;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CardService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    // ─── Supertipos ──────────────────────────────────────────────────────────
    // Valor: base del adjetivo sin desinencia de género.
    // Casos especiales: "nevada", "mundial", "élite" ya son invariables.
    private static final Map<String, String> SUPERTYPE_MAP = new HashMap<>();
    static {
        SUPERTYPE_MAP.put("Legendary", "legendari");
        SUPERTYPE_MAP.put("Basic",     "básic");
        SUPERTYPE_MAP.put("Snow",      "nevada");
        SUPERTYPE_MAP.put("World",     "mundial");
        SUPERTYPE_MAP.put("Elite",     "élite");
    }

    // ─── Tipos de carta (nombre en español + género: true=femenino) ──────────
    private static final Map<String, Object[]> TYPE_MAP = new HashMap<>();
    static {
        TYPE_MAP.put("Creature",     new Object[]{"Criatura",      true});
        TYPE_MAP.put("Land",         new Object[]{"Tierra",        true});
        TYPE_MAP.put("Instant",      new Object[]{"Instantáneo",   false});
        TYPE_MAP.put("Sorcery",      new Object[]{"Conjuro",       false});
        TYPE_MAP.put("Artifact",     new Object[]{"Artefacto",     false});
        TYPE_MAP.put("Enchantment",  new Object[]{"Encantamiento", false});
        TYPE_MAP.put("Planeswalker", new Object[]{"Planeswalker",  false});
        TYPE_MAP.put("Battle",       new Object[]{"Batalla",       true});
        TYPE_MAP.put("Tribal",       new Object[]{"Tribal",        false});
        TYPE_MAP.put("Kindred",      new Object[]{"Afín",          false});
    }

    // ─── Subtipos exhaustivos de Magic: The Gathering ────────────────────────
    private static final Map<String, String> SUBTYPE_MAP = new HashMap<>();
    static {
        // ── Criaturas ─────────────────────────────────────────────────────────
        SUBTYPE_MAP.put("Advisor",         "Consejero");
        SUBTYPE_MAP.put("Aetherborn",      "Etérineo");
        SUBTYPE_MAP.put("Alien",           "Alienígena");
        SUBTYPE_MAP.put("Ally",            "Aliado");
        SUBTYPE_MAP.put("Angel",           "Ángel");
        SUBTYPE_MAP.put("Antelope",        "Antílope");
        SUBTYPE_MAP.put("Ape",             "Simio");
        SUBTYPE_MAP.put("Archer",          "Arquero");
        SUBTYPE_MAP.put("Archon",          "Arconte");
        SUBTYPE_MAP.put("Armadillo",       "Armadillo");
        SUBTYPE_MAP.put("Army",            "Ejército");
        SUBTYPE_MAP.put("Artificer",       "Artífice");
        SUBTYPE_MAP.put("Assassin",        "Asesino");
        SUBTYPE_MAP.put("Assembly-Worker", "Obrero-ensamblador");
        SUBTYPE_MAP.put("Atog",            "Atog");
        SUBTYPE_MAP.put("Aurochs",         "Uro");
        SUBTYPE_MAP.put("Avatar",          "Avatar");
        SUBTYPE_MAP.put("Azra",            "Azra");
        SUBTYPE_MAP.put("Badger",          "Tejón");
        SUBTYPE_MAP.put("Balloon",         "Globo");
        SUBTYPE_MAP.put("Barbarian",       "Bárbaro");
        SUBTYPE_MAP.put("Bard",            "Bardo");
        SUBTYPE_MAP.put("Basilisk",        "Basilisco");
        SUBTYPE_MAP.put("Bat",             "Murciélago");
        SUBTYPE_MAP.put("Bear",            "Oso");
        SUBTYPE_MAP.put("Beast",           "Bestia");
        SUBTYPE_MAP.put("Beeble",          "Beeble");
        SUBTYPE_MAP.put("Beholder",        "Beholder");
        SUBTYPE_MAP.put("Berserker",       "Berserker");
        SUBTYPE_MAP.put("Bird",            "Pájaro");
        SUBTYPE_MAP.put("Blinkmoth",       "Parpamota");
        SUBTYPE_MAP.put("Boar",            "Jabalí");
        SUBTYPE_MAP.put("Bringer",         "Portador");
        SUBTYPE_MAP.put("Brushwagg",       "Brushwagg");
        SUBTYPE_MAP.put("Camarid",         "Camárido");
        SUBTYPE_MAP.put("Camel",           "Camello");
        SUBTYPE_MAP.put("Caribou",         "Caribú");
        SUBTYPE_MAP.put("Carrier",         "Portador");
        SUBTYPE_MAP.put("Cat",             "Felino");
        SUBTYPE_MAP.put("Centaur",         "Centauro");
        SUBTYPE_MAP.put("Cephalid",        "Cefálido");
        SUBTYPE_MAP.put("Child",           "Niño");
        SUBTYPE_MAP.put("Chimera",         "Quimera");
        SUBTYPE_MAP.put("Citizen",         "Ciudadano");
        SUBTYPE_MAP.put("Cleric",          "Clérigo");
        SUBTYPE_MAP.put("Cockatrice",      "Cocatriz");
        SUBTYPE_MAP.put("Construct",       "Constructo");
        SUBTYPE_MAP.put("Coward",          "Cobarde");
        SUBTYPE_MAP.put("Crab",            "Cangrejo");
        SUBTYPE_MAP.put("Crocodile",       "Cocodrilo");
        SUBTYPE_MAP.put("Cyclops",         "Cíclope");
        SUBTYPE_MAP.put("Dauthi",          "Dauthi");
        SUBTYPE_MAP.put("Demigod",         "Semidiós");
        SUBTYPE_MAP.put("Demon",           "Demonio");
        SUBTYPE_MAP.put("Deserter",        "Desertor");
        SUBTYPE_MAP.put("Devil",           "Diablo");
        SUBTYPE_MAP.put("Dinosaur",        "Dinosaurio");
        SUBTYPE_MAP.put("Djinn",           "Djinn");
        SUBTYPE_MAP.put("Dog",             "Perro");
        SUBTYPE_MAP.put("Dragon",          "Dragón");
        SUBTYPE_MAP.put("Drake",           "Drakón");
        SUBTYPE_MAP.put("Dreadnought",     "Acorazado");
        SUBTYPE_MAP.put("Drone",           "Abejorro");
        SUBTYPE_MAP.put("Druid",           "Druida");
        SUBTYPE_MAP.put("Dryad",           "Dríade");
        SUBTYPE_MAP.put("Dwarf",           "Enano");
        SUBTYPE_MAP.put("Efreet",          "Efreet");
        SUBTYPE_MAP.put("Egg",             "Huevo");
        SUBTYPE_MAP.put("Elder",           "Anciano");
        SUBTYPE_MAP.put("Eldrazi",         "Eldrazi");
        SUBTYPE_MAP.put("Elemental",       "Elemental");
        SUBTYPE_MAP.put("Elephant",        "Elefante");
        SUBTYPE_MAP.put("Elf",             "Elfo");
        SUBTYPE_MAP.put("Elk",             "Alce");
        SUBTYPE_MAP.put("Employee",        "Empleado");
        SUBTYPE_MAP.put("Eye",             "Ojo");
        SUBTYPE_MAP.put("Faerie",          "Hada");
        SUBTYPE_MAP.put("Ferret",          "Hurón");
        SUBTYPE_MAP.put("Fish",            "Pez");
        SUBTYPE_MAP.put("Flagbearer",      "Abanderado");
        SUBTYPE_MAP.put("Fox",             "Zorro");
        SUBTYPE_MAP.put("Fractal",         "Fractal");
        SUBTYPE_MAP.put("Frog",            "Rana");
        SUBTYPE_MAP.put("Fungus",          "Hongo");
        SUBTYPE_MAP.put("Gargoyle",        "Gárgola");
        SUBTYPE_MAP.put("Germ",            "Germen");
        SUBTYPE_MAP.put("Giant",           "Gigante");
        SUBTYPE_MAP.put("Gnoll",           "Gnoll");
        SUBTYPE_MAP.put("Gnome",           "Gnomo");
        SUBTYPE_MAP.put("Goat",            "Cabra");
        SUBTYPE_MAP.put("Goblin",          "Trasgo");
        SUBTYPE_MAP.put("God",             "Dios");
        SUBTYPE_MAP.put("Golem",           "Gólem");
        SUBTYPE_MAP.put("Gorgon",          "Gorgona");
        SUBTYPE_MAP.put("Graveborn",       "Graveborn");
        SUBTYPE_MAP.put("Gremlin",         "Gremlin");
        SUBTYPE_MAP.put("Griffin",         "Grifo");
        SUBTYPE_MAP.put("Guest",           "Invitado");
        SUBTYPE_MAP.put("Hag",             "Bruja");
        SUBTYPE_MAP.put("Halfling",        "Mediano");
        SUBTYPE_MAP.put("Hamster",         "Hámster");
        SUBTYPE_MAP.put("Harpy",           "Arpía");
        SUBTYPE_MAP.put("Hellion",         "Hellion");
        SUBTYPE_MAP.put("Hippo",           "Hipopótamo");
        SUBTYPE_MAP.put("Hippogriff",      "Hipogrifo");
        SUBTYPE_MAP.put("Homarid",         "Homárido");
        SUBTYPE_MAP.put("Homunculus",      "Homúnculo");
        SUBTYPE_MAP.put("Horror",          "Horror");
        SUBTYPE_MAP.put("Horse",           "Caballo");
        SUBTYPE_MAP.put("Human",           "Humano");
        SUBTYPE_MAP.put("Hydra",           "Hidra");
        SUBTYPE_MAP.put("Hyena",           "Hiena");
        SUBTYPE_MAP.put("Illusion",        "Ilusión");
        SUBTYPE_MAP.put("Imp",             "Diablillo");
        SUBTYPE_MAP.put("Incarnation",     "Encarnación");
        SUBTYPE_MAP.put("Inkling",         "Mancha");
        SUBTYPE_MAP.put("Insect",          "Insecto");
        SUBTYPE_MAP.put("Jackal",          "Chacal");
        SUBTYPE_MAP.put("Jellyfish",       "Medusa");
        SUBTYPE_MAP.put("Juggernaut",      "Leviatán");
        SUBTYPE_MAP.put("Kavu",            "Kavu");
        SUBTYPE_MAP.put("Kirin",           "Kirin");
        SUBTYPE_MAP.put("Kithkin",         "Kithkin");
        SUBTYPE_MAP.put("Knight",          "Caballero");
        SUBTYPE_MAP.put("Kobold",          "Kobold");
        SUBTYPE_MAP.put("Kor",             "Kor");
        SUBTYPE_MAP.put("Kraken",          "Kraken");
        SUBTYPE_MAP.put("Lamia",           "Lamia");
        SUBTYPE_MAP.put("Lammasu",         "Lammasu");
        SUBTYPE_MAP.put("Leech",           "Sanguijuela");
        SUBTYPE_MAP.put("Leviathan",       "Leviatán");
        SUBTYPE_MAP.put("Lhurgoyf",        "Lhurgoyf");
        SUBTYPE_MAP.put("Licid",           "Lícido");
        SUBTYPE_MAP.put("Lizard",          "Lagarto");
        SUBTYPE_MAP.put("Manticore",       "Mantícora");
        SUBTYPE_MAP.put("Masticore",       "Masticor");
        SUBTYPE_MAP.put("Mercenary",       "Mercenario");
        SUBTYPE_MAP.put("Merfolk",         "Tritón");
        SUBTYPE_MAP.put("Metathran",       "Metatrano");
        SUBTYPE_MAP.put("Minion",          "Súbdito");
        SUBTYPE_MAP.put("Minotaur",        "Minotauro");
        SUBTYPE_MAP.put("Mite",            "Ácaro");
        SUBTYPE_MAP.put("Mole",            "Topo");
        SUBTYPE_MAP.put("Monger",          "Mercader");
        SUBTYPE_MAP.put("Mongoose",        "Mangosta");
        SUBTYPE_MAP.put("Monk",            "Monje");
        SUBTYPE_MAP.put("Monkey",          "Mono");
        SUBTYPE_MAP.put("Moonfolk",        "Gente-luna");
        SUBTYPE_MAP.put("Mouse",           "Ratón");
        SUBTYPE_MAP.put("Mutant",          "Mutante");
        SUBTYPE_MAP.put("Myr",             "Myr");
        SUBTYPE_MAP.put("Mystic",          "Místico");
        SUBTYPE_MAP.put("Naga",            "Naga");
        SUBTYPE_MAP.put("Nautilus",        "Nautilo");
        SUBTYPE_MAP.put("Nightmare",       "Pesadilla");
        SUBTYPE_MAP.put("Nightstalker",    "Acechador-nocturno");
        SUBTYPE_MAP.put("Ninja",           "Ninja");
        SUBTYPE_MAP.put("Noble",           "Noble");
        SUBTYPE_MAP.put("Noggle",          "Noggle");
        SUBTYPE_MAP.put("Nomad",           "Nómada");
        SUBTYPE_MAP.put("Nymph",           "Ninfa");
        SUBTYPE_MAP.put("Octopus",         "Pulpo");
        SUBTYPE_MAP.put("Ogre",            "Ogro");
        SUBTYPE_MAP.put("Ooze",            "Limo");
        SUBTYPE_MAP.put("Orb",             "Orbe");
        SUBTYPE_MAP.put("Orc",             "Orco");
        SUBTYPE_MAP.put("Orgg",            "Orgg");
        SUBTYPE_MAP.put("Otter",           "Nutria");
        SUBTYPE_MAP.put("Ouphe",           "Ouphe");
        SUBTYPE_MAP.put("Ox",              "Buey");
        SUBTYPE_MAP.put("Oyster",          "Ostra");
        SUBTYPE_MAP.put("Pangolin",        "Pangolín");
        SUBTYPE_MAP.put("Peasant",         "Campesino");
        SUBTYPE_MAP.put("Pegasus",         "Pegaso");
        SUBTYPE_MAP.put("Pentavite",       "Pentavita");
        SUBTYPE_MAP.put("Performer",       "Artista");
        SUBTYPE_MAP.put("Pest",            "Plaga");
        SUBTYPE_MAP.put("Phelddagrif",     "Phelddagrif");
        SUBTYPE_MAP.put("Phoenix",         "Fénix");
        SUBTYPE_MAP.put("Phyrexian",       "Phyrexiano");
        SUBTYPE_MAP.put("Pilot",           "Piloto");
        SUBTYPE_MAP.put("Pincher",         "Pinzas");
        SUBTYPE_MAP.put("Pirate",          "Pirata");
        SUBTYPE_MAP.put("Plant",           "Planta");
        SUBTYPE_MAP.put("Praetor",         "Pretor");
        SUBTYPE_MAP.put("Primarch",        "Primarca");
        SUBTYPE_MAP.put("Prism",           "Prisma");
        SUBTYPE_MAP.put("Processor",       "Procesador");
        SUBTYPE_MAP.put("Rabbit",          "Conejo");
        SUBTYPE_MAP.put("Raccoon",         "Mapache");
        SUBTYPE_MAP.put("Ranger",          "Explorador");
        SUBTYPE_MAP.put("Rat",             "Rata");
        SUBTYPE_MAP.put("Rebel",           "Rebelde");
        SUBTYPE_MAP.put("Reflection",      "Reflejo");
        SUBTYPE_MAP.put("Rhino",           "Rinoceronte");
        SUBTYPE_MAP.put("Rigger",          "Aparejador");
        SUBTYPE_MAP.put("Robot",           "Robot");
        SUBTYPE_MAP.put("Rogue",           "Pícaro");
        SUBTYPE_MAP.put("Rukh",            "Rukh");
        SUBTYPE_MAP.put("Salamander",      "Salamandra");
        SUBTYPE_MAP.put("Samurai",         "Samurái");
        SUBTYPE_MAP.put("Sand",            "Arena");
        SUBTYPE_MAP.put("Saproling",       "Saprotejo");
        SUBTYPE_MAP.put("Satyr",           "Sátiro");
        SUBTYPE_MAP.put("Scarecrow",       "Espantapájaros");
        SUBTYPE_MAP.put("Scientist",       "Científico");
        SUBTYPE_MAP.put("Scion",           "Vástago");
        SUBTYPE_MAP.put("Scorpion",        "Escorpión");
        SUBTYPE_MAP.put("Scout",           "Explorador");
        SUBTYPE_MAP.put("Sculpture",       "Escultura");
        SUBTYPE_MAP.put("Serf",            "Siervo");
        SUBTYPE_MAP.put("Serpent",         "Serpiente");
        SUBTYPE_MAP.put("Servo",           "Servo");
        SUBTYPE_MAP.put("Shade",           "Sombra");
        SUBTYPE_MAP.put("Shaman",          "Chamán");
        SUBTYPE_MAP.put("Shapeshifter",    "Transformista");
        SUBTYPE_MAP.put("Shark",           "Tiburón");
        SUBTYPE_MAP.put("Sheep",           "Oveja");
        SUBTYPE_MAP.put("Siren",           "Sirena");
        SUBTYPE_MAP.put("Skeleton",        "Esqueleto");
        SUBTYPE_MAP.put("Slith",           "Slith");
        SUBTYPE_MAP.put("Sliver",          "Fragmento");
        SUBTYPE_MAP.put("Slug",            "Babosa");
        SUBTYPE_MAP.put("Snake",           "Serpiente");
        SUBTYPE_MAP.put("Soldier",         "Soldado");
        SUBTYPE_MAP.put("Soltari",         "Soltari");
        SUBTYPE_MAP.put("Spawn",           "Engendro");
        SUBTYPE_MAP.put("Specter",         "Espectro");
        SUBTYPE_MAP.put("Spellshaper",     "Dador-de-hechizos");
        SUBTYPE_MAP.put("Sphinx",          "Esfinge");
        SUBTYPE_MAP.put("Spider",          "Araña");
        SUBTYPE_MAP.put("Spike",           "Espiga");
        SUBTYPE_MAP.put("Spirit",          "Espíritu");
        SUBTYPE_MAP.put("Splinter",        "Astilla");
        SUBTYPE_MAP.put("Sponge",          "Esponja");
        SUBTYPE_MAP.put("Squid",           "Calamar");
        SUBTYPE_MAP.put("Squirrel",        "Ardilla");
        SUBTYPE_MAP.put("Starfish",        "Estrella-de-mar");
        SUBTYPE_MAP.put("Surrakar",        "Surrakar");
        SUBTYPE_MAP.put("Survivor",        "Superviviente");
        SUBTYPE_MAP.put("Tentacle",        "Tentáculo");
        SUBTYPE_MAP.put("Tetravite",       "Tetravita");
        SUBTYPE_MAP.put("Thalakos",        "Thalakos");
        SUBTYPE_MAP.put("Thopter",         "Thopter");
        SUBTYPE_MAP.put("Thrull",          "Thrull");
        SUBTYPE_MAP.put("Tiefling",        "Tiefling");
        SUBTYPE_MAP.put("Treefolk",        "Hombre-árbol");
        SUBTYPE_MAP.put("Trilobite",       "Trilobites");
        SUBTYPE_MAP.put("Triskelavite",    "Triskelavita");
        SUBTYPE_MAP.put("Troll",           "Trol");
        SUBTYPE_MAP.put("Turtle",          "Tortuga");
        SUBTYPE_MAP.put("Tyranid",         "Tyránido");
        SUBTYPE_MAP.put("Unicorn",         "Unicornio");
        SUBTYPE_MAP.put("Vampire",         "Vampiro");
        SUBTYPE_MAP.put("Vedalken",        "Vedalken");
        SUBTYPE_MAP.put("Viashino",        "Viashino");
        SUBTYPE_MAP.put("Villain",         "Villano");
        SUBTYPE_MAP.put("Volver",          "Volver");
        SUBTYPE_MAP.put("Wall",            "Muro");
        SUBTYPE_MAP.put("Warlock",         "Brujo");
        SUBTYPE_MAP.put("Warrior",         "Guerrero");
        SUBTYPE_MAP.put("Weird",           "Extraño");
        SUBTYPE_MAP.put("Werewolf",        "Hombre-lobo");
        SUBTYPE_MAP.put("Whale",           "Ballena");
        SUBTYPE_MAP.put("Wizard",          "Mago");
        SUBTYPE_MAP.put("Wolf",            "Lobo");
        SUBTYPE_MAP.put("Wolverine",       "Lirón");
        SUBTYPE_MAP.put("Wombat",          "Wombat");
        SUBTYPE_MAP.put("Worm",            "Gusano");
        SUBTYPE_MAP.put("Wraith",          "Espectro");
        SUBTYPE_MAP.put("Wurm",            "Gusano");
        SUBTYPE_MAP.put("Yeti",            "Yeti");
        SUBTYPE_MAP.put("Zombie",          "Zombie");
        SUBTYPE_MAP.put("Zubera",          "Zubera");
        // ── Tierras ────────────────────────────────────────────────────────────
        SUBTYPE_MAP.put("Plains",          "Llanura");
        SUBTYPE_MAP.put("Island",          "Isla");
        SUBTYPE_MAP.put("Swamp",           "Pantano");
        SUBTYPE_MAP.put("Mountain",        "Montaña");
        SUBTYPE_MAP.put("Forest",          "Bosque");
        SUBTYPE_MAP.put("Cave",            "Cueva");
        SUBTYPE_MAP.put("Desert",          "Desierto");
        SUBTYPE_MAP.put("Gate",            "Puerta");
        SUBTYPE_MAP.put("Lair",            "Guarida");
        SUBTYPE_MAP.put("Locus",           "Locus");
        SUBTYPE_MAP.put("Mine",            "Mina");
        SUBTYPE_MAP.put("Power-Plant",     "Central-eléctrica");
        SUBTYPE_MAP.put("Sphere",          "Esfera");
        SUBTYPE_MAP.put("Tower",           "Torre");
        SUBTYPE_MAP.put("Urza's",          "de Urza");
        SUBTYPE_MAP.put("Urza",            "Urza");
        // ── Artefactos ─────────────────────────────────────────────────────────
        SUBTYPE_MAP.put("Blood",           "Sangre");
        SUBTYPE_MAP.put("Clue",            "Pista");
        SUBTYPE_MAP.put("Contraption",     "Artilugio");
        SUBTYPE_MAP.put("Equipment",       "Equipo");
        SUBTYPE_MAP.put("Food",            "Comida");
        SUBTYPE_MAP.put("Gold",            "Oro");
        SUBTYPE_MAP.put("Incubator",       "Incubadora");
        SUBTYPE_MAP.put("Junk",            "Chatarra");
        SUBTYPE_MAP.put("Map",             "Mapa");
        SUBTYPE_MAP.put("Powerstone",      "Piedra-de-poder");
        SUBTYPE_MAP.put("Treasure",        "Tesoro");
        SUBTYPE_MAP.put("Vehicle",         "Vehículo");
        // ── Encantamientos ─────────────────────────────────────────────────────
        SUBTYPE_MAP.put("Aura",            "Aura");
        SUBTYPE_MAP.put("Background",      "Trasfondo");
        SUBTYPE_MAP.put("Cartouche",       "Cartucho");
        SUBTYPE_MAP.put("Case",            "Caso");
        SUBTYPE_MAP.put("Class",           "Clase");
        SUBTYPE_MAP.put("Curse",           "Maldición");
        SUBTYPE_MAP.put("Role",            "Rol");
        SUBTYPE_MAP.put("Room",            "Estancia");
        SUBTYPE_MAP.put("Rune",            "Runa");
        SUBTYPE_MAP.put("Saga",            "Saga");
        SUBTYPE_MAP.put("Shard",           "Fragmento");
        SUBTYPE_MAP.put("Shrine",          "Santuario");
        // ── Instantáneos / Conjuros ────────────────────────────────────────────
        SUBTYPE_MAP.put("Adventure",       "Aventura");
        SUBTYPE_MAP.put("Arcane",          "Arcano");
        SUBTYPE_MAP.put("Cantrip",         "Cantrip");
        SUBTYPE_MAP.put("Lesson",          "Lección");
        SUBTYPE_MAP.put("Trap",            "Trampa");
        // ── Batallas ───────────────────────────────────────────────────────────
        SUBTYPE_MAP.put("Siege",           "Asedio");
    }

    @Autowired
    private CardRepository cardRepository;

    public Page<CardSummaryDTO> getCardsList(Pageable pageable) {
        return cardRepository.findAll(pageable)
                .map(card -> new CardSummaryDTO(
                        card.getId(),
                        card.getScryfallId(),
                        resolveDisplayName(card.getName(), card.getRawJson()),
                        resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                        card.getNormalImageUri(),
                        card.getRarity()
                ));
    }

    public Optional<CardDetailDTO> getCardDetail(Long id) {
        return cardRepository.findById(id).map(card -> {
            String normalImage = resolveNormalImage(card);
            String backImage = resolveBackImage(card);
            List<CardDetailDTO.FaceDTO> faces = mapFaces(card.getFaces());

            return new CardDetailDTO(
                card.getId(),
                card.getScryfallId(),
                resolveDisplayName(card.getName(), card.getRawJson()),
                card.getManaCost(),
                resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                resolveDisplayOracleText(card.getOracleText(), card.getRawJson()),
                card.getPower(),
                card.getToughness(),
                card.getRarity(),
                card.getFlavorText(),
                card.getArtist(),
                normalImage,
                backImage,
                parseColors(card.getColorsJson()),
                mapLegalities(card.getLegalities()),
                mapPrice(card.getPrice()),
                card.getEdhrecRank(),
                faces,
                card.getSet() != null ? card.getSet().getName() : "Desconocido",
                card.getCollectorNumber(),
                card.getCmc() != null ? card.getCmc().doubleValue() : 0.0,
                card.getReleasedAt() != null ? card.getReleasedAt().toString() : "???"
            );
        });
    }

    private List<CardDetailDTO.FaceDTO> mapFaces(List<CardFace> faces) {
        if (faces == null || faces.isEmpty()) return List.of();
        return faces.stream()
                .map(f -> new CardDetailDTO.FaceDTO(
                    resolveDisplayName(f.getName(), f.getRawJson()),
                    f.getManaCost(),
                    resolveDisplayType(f.getTypeLine(), f.getRawJson()),
                    resolveDisplayOracleText(f.getOracleText(), f.getRawJson()),
                    f.getPower(),
                    f.getToughness(),
                    f.getFlavorText(),
                    f.getArtist(),
                    f.getNormalImageUri()
                ))
                .collect(Collectors.toList());
    }

    private String resolveNormalImage(Card card) {
        if (card.getNormalImageUri() != null && !card.getNormalImageUri().isBlank()) {
            return card.getNormalImageUri();
        }
        if (card.getFaces() != null && !card.getFaces().isEmpty()) {
            return card.getFaces().get(0).getNormalImageUri();
        }
        return null;
    }

    private String resolveBackImage(Card card) {
        if (card.getFaces() != null && card.getFaces().size() > 1) {
            return card.getFaces().get(1).getNormalImageUri();
        }
        return null;
    }

    private List<CardDetailDTO.LegalityDTO> mapLegalities(List<CardLegality> legalities) {
        if (legalities == null) return List.of();
        return legalities.stream()
                .map(l -> new CardDetailDTO.LegalityDTO(l.getFormatName(), l.getLegalityStatus()))
                .collect(Collectors.toList());
    }

    private CardDetailDTO.PriceDTO mapPrice(CardPrice price) {
        if (price == null) return null;
        return new CardDetailDTO.PriceDTO(
            price.getUsd() != null ? price.getUsd().toString() : null,
            price.getUsdFoil() != null ? price.getUsdFoil().toString() : null,
            price.getEur() != null ? price.getEur().toString() : null,
            price.getEurFoil() != null ? price.getEurFoil().toString() : null
        );
    }

    private List<String> parseColors(String colorsJson) {
        if (colorsJson == null || colorsJson.isBlank()) return List.of();
        return Arrays.asList(colorsJson.replaceAll("[\\[\\]\" ]", "").split(","));
    }

    public String resolveDisplayName(String defaultName, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_name");
        return (localized != null && !localized.isBlank()) ? localized : defaultName;
    }

    public String resolveDisplayType(String defaultTypeLine, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_type_line");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        // Fallback: traducción dinámica al español
        return translateTypeLine(defaultTypeLine);
    }

    private String resolveDisplayOracleText(String defaultOracleText, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_text");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        return defaultOracleText == null ? "" : defaultOracleText;
    }

    private String extractStringFromRawJson(String rawJson, String field) {
        if (rawJson == null || rawJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = OBJECT_MAPPER.readTree(rawJson);
            JsonNode value = node.get(field);
            return (value != null && value.isTextual()) ? value.asText() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Traduce una línea de tipo MTG del inglés al español.
     * Soporta supertipos (con concordancia de género), tipos principales y subtipos.
     * Soporta cartas de doble cara separadas por " // ".
     */
    public static String translateTypeLine(String typeLine) {
        if (typeLine == null || typeLine.isBlank()) return "";

        // Cartas de doble cara: "Sorcery // Instant"
        if (typeLine.contains(" // ")) {
            String[] halves = typeLine.split(" // ", 2);
            return translateSingleTypeLine(halves[0].trim()) + " // " + translateSingleTypeLine(halves[1].trim());
        }
        return translateSingleTypeLine(typeLine.trim());
    }

    private static String translateSingleTypeLine(String typeLine) {
        if (typeLine == null || typeLine.isBlank()) return "";

        // Separar tipo principal de subtipo (por "—", "–" o " - ")
        String[] parts = typeLine.split("\\s*[—–]\\s*|\\s+-\\s+", 2);
        String mainPart = parts[0].trim();
        String subPart  = parts.length > 1 ? parts[1].trim() : null;

        // Clasificar palabras de la parte principal
        String[] mainWords = mainPart.split("\\s+");
        List<String> supertypeWords = new ArrayList<>();
        List<String> typeWords      = new ArrayList<>();

        for (String word : mainWords) {
            if (TYPE_MAP.containsKey(word)) {
                typeWords.add(word);
            } else if (SUPERTYPE_MAP.containsKey(word)) {
                supertypeWords.add(word);
            } else {
                typeWords.add(word); // palabra desconocida → se conserva
            }
        }

        // Determinar género del tipo principal
        boolean isFeminine = false;
        StringBuilder translatedMain = new StringBuilder();
        if (!typeWords.isEmpty()) {
            String firstType = typeWords.get(0);
            if (TYPE_MAP.containsKey(firstType)) {
                Object[] info = TYPE_MAP.get(firstType);
                translatedMain.append((String) info[0]);
                isFeminine = (boolean) info[1];
                for (int i = 1; i < typeWords.size(); i++) {
                    String t = typeWords.get(i);
                    translatedMain.append(" ");
                    translatedMain.append(TYPE_MAP.containsKey(t) ? (String) TYPE_MAP.get(t)[0] : t);
                }
            } else {
                translatedMain.append(String.join(" ", typeWords));
            }
        }

        // Traducir supertipos con concordancia de género
        for (String s : supertypeWords) {
            String base = SUPERTYPE_MAP.get(s);
            if (base == null) { translatedMain.append(" ").append(s); continue; }
            if (base.equals("nevada") || base.equals("mundial") || base.equals("élite")) {
                translatedMain.append(" ").append(base);
            } else {
                translatedMain.append(" ").append(base).append(isFeminine ? "a" : "o");
            }
        }

        // Traducir subtipos
        String result = translatedMain.toString().trim();
        if (subPart != null && !subPart.isBlank()) {
            String[] subtypes = subPart.split("\\s+");
            List<String> translatedSubs = new ArrayList<>();
            for (String sub : subtypes) {
                translatedSubs.add(SUBTYPE_MAP.getOrDefault(sub, sub));
            }
            result += " — " + String.join(" ", translatedSubs);
        }

        return result;
    }
}