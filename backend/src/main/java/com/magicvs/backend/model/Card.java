package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cards")
public class Card {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scryfall_id", unique = true, nullable = false)
    private UUID scryfallId;

    @Column(name = "oracle_id")
    private UUID oracleId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "set_id")
    private CardSet set;

    @Column(nullable = false)
    private String name;

    @Column(length = 10)
    private String lang;

    @Column(name = "released_at")
    private LocalDate releasedAt;

    private String layout;

    @Column(name = "mana_cost")
    private String manaCost;

    private BigDecimal cmc;

    @Column(name = "type_line")
    private String typeLine;

    @Column(name = "oracle_text", columnDefinition = "TEXT")
    private String oracleText;

    private String power;
    private String toughness;
    private String loyalty;
    private String defense;

    @Column(name = "collector_number")
    private String collectorNumber;

    private String rarity;

    @Column(name = "flavor_text", columnDefinition = "TEXT")
    private String flavorText;

    private String artist;

    private Boolean reserved;
    private Boolean reprint;
    private Boolean digital;
    private Boolean foil;
    private Boolean nonfoil;
    private Boolean promo;

    @Column(name = "full_art")
    private Boolean fullArt;

    private Boolean textless;

    @Column(name = "scryfall_uri", columnDefinition = "TEXT")
    private String scryfallUri;

    @Column(name = "prints_search_uri", columnDefinition = "TEXT")
    private String printsSearchUri;

    @Column(name = "rulings_uri", columnDefinition = "TEXT")
    private String rulingsUri;

    @Column(name = "small_image_uri", columnDefinition = "TEXT")
    private String smallImageUri;

    @Column(name = "normal_image_uri", columnDefinition = "TEXT")
    private String normalImageUri;

    @Column(name = "large_image_uri", columnDefinition = "TEXT")
    private String largeImageUri;

    @Column(name = "png_image_uri", columnDefinition = "TEXT")
    private String pngImageUri;

    @Column(name = "art_crop_uri", columnDefinition = "TEXT")
    private String artCropUri;

    @Column(name = "border_crop_uri", columnDefinition = "TEXT")
    private String borderCropUri;

    @Column(name = "arena_id")
    private Integer arenaId;

    @Column(name = "mtgo_id")
    private Integer mtgoId;

    @Column(name = "tcgplayer_id")
    private Integer tcgplayerId;

    @Column(name = "cardmarket_id")
    private Integer cardmarketId;

    @Column(name = "edhrec_rank")
    private Integer edhrecRank;

    @Column(name = "colors_json", columnDefinition = "TEXT")
    private String colorsJson;

    @Column(name = "color_identity_json", columnDefinition = "TEXT")
    private String colorIdentityJson;

    @Column(name = "games_json", columnDefinition = "TEXT")
    private String gamesJson;

    @Column(name = "keywords_json", columnDefinition = "TEXT")
    private String keywordsJson;

    @Column(name = "produced_mana_json", columnDefinition = "TEXT")
    private String producedManaJson;

    @Column(name = "purchase_uris_json", columnDefinition = "TEXT")
    private String purchaseUrisJson;

    @Column(name = "related_uris_json", columnDefinition = "TEXT")
    private String relatedUrisJson;

    @Column(name = "raw_json", columnDefinition = "TEXT")
    private String rawJson;

    @Column(name = "synced_at")
    private LocalDateTime syncedAt;

    @OneToMany(mappedBy = "card", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<CardFace> faces = new ArrayList<>();

    @OneToMany(mappedBy = "card", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<CardLegality> legalities = new ArrayList<>();

    @OneToOne(mappedBy = "card", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private CardPrice price;

    @OneToMany(mappedBy = "card", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<Ruling> rulings = new ArrayList<>();



    public Card() {
    }

    public Long getId() {
        return id;
    }

    public UUID getScryfallId() {
        return scryfallId;
    }

    public void setScryfallId(UUID scryfallId) {
        this.scryfallId = scryfallId;
    }

    public UUID getOracleId() {
        return oracleId;
    }

    public void setOracleId(UUID oracleId) {
        this.oracleId = oracleId;
    }

    public CardSet getSet() {
        return set;
    }

    public void setSet(CardSet set) {
        this.set = set;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLang() {
        return lang;
    }

    public void setLang(String lang) {
        this.lang = lang;
    }

    public LocalDate getReleasedAt() {
        return releasedAt;
    }

    public void setReleasedAt(LocalDate releasedAt) {
        this.releasedAt = releasedAt;
    }

    public String getLayout() {
        return layout;
    }

    public void setLayout(String layout) {
        this.layout = layout;
    }

    public String getManaCost() {
        return manaCost;
    }

    public void setManaCost(String manaCost) {
        this.manaCost = manaCost;
    }

    public BigDecimal getCmc() {
        return cmc;
    }

    public void setCmc(BigDecimal cmc) {
        this.cmc = cmc;
    }

    public String getTypeLine() {
        return typeLine;
    }

    public void setTypeLine(String typeLine) {
        this.typeLine = typeLine;
    }

    public String getOracleText() {
        return oracleText;
    }

    public void setOracleText(String oracleText) {
        this.oracleText = oracleText;
    }

    public String getPower() {
        return power;
    }

    public void setPower(String power) {
        this.power = power;
    }

    public String getToughness() {
        return toughness;
    }

    public void setToughness(String toughness) {
        this.toughness = toughness;
    }

    public String getLoyalty() {
        return loyalty;
    }

    public void setLoyalty(String loyalty) {
        this.loyalty = loyalty;
    }

    public String getDefense() {
        return defense;
    }

    public void setDefense(String defense) {
        this.defense = defense;
    }

    public String getCollectorNumber() {
        return collectorNumber;
    }

    public void setCollectorNumber(String collectorNumber) {
        this.collectorNumber = collectorNumber;
    }

    public String getRarity() {
        return rarity;
    }

    public void setRarity(String rarity) {
        this.rarity = rarity;
    }

    public String getFlavorText() {
        return flavorText;
    }

    public void setFlavorText(String flavorText) {
        this.flavorText = flavorText;
    }

    public String getArtist() {
        return artist;
    }

    public void setArtist(String artist) {
        this.artist = artist;
    }

    public Boolean getReserved() {
        return reserved;
    }

    public void setReserved(Boolean reserved) {
        this.reserved = reserved;
    }

    public Boolean getReprint() {
        return reprint;
    }

    public void setReprint(Boolean reprint) {
        this.reprint = reprint;
    }

    public Boolean getDigital() {
        return digital;
    }

    public void setDigital(Boolean digital) {
        this.digital = digital;
    }

    public Boolean getFoil() {
        return foil;
    }

    public void setFoil(Boolean foil) {
        this.foil = foil;
    }

    public Boolean getNonfoil() {
        return nonfoil;
    }

    public void setNonfoil(Boolean nonfoil) {
        this.nonfoil = nonfoil;
    }

    public Boolean getPromo() {
        return promo;
    }

    public void setPromo(Boolean promo) {
        this.promo = promo;
    }

    public Boolean getFullArt() {
        return fullArt;
    }

    public void setFullArt(Boolean fullArt) {
        this.fullArt = fullArt;
    }

    public Boolean getTextless() {
        return textless;
    }

    public void setTextless(Boolean textless) {
        this.textless = textless;
    }

    public String getScryfallUri() {
        return scryfallUri;
    }

    public void setScryfallUri(String scryfallUri) {
        this.scryfallUri = scryfallUri;
    }

    public String getPrintsSearchUri() {
        return printsSearchUri;
    }

    public void setPrintsSearchUri(String printsSearchUri) {
        this.printsSearchUri = printsSearchUri;
    }

    public String getRulingsUri() {
        return rulingsUri;
    }

    public void setRulingsUri(String rulingsUri) {
        this.rulingsUri = rulingsUri;
    }

    public String getSmallImageUri() {
        return smallImageUri;
    }

    public void setSmallImageUri(String smallImageUri) {
        this.smallImageUri = smallImageUri;
    }

    public String getNormalImageUri() {
        return normalImageUri;
    }

    public void setNormalImageUri(String normalImageUri) {
        this.normalImageUri = normalImageUri;
    }

    public String getLargeImageUri() {
        return largeImageUri;
    }

    public void setLargeImageUri(String largeImageUri) {
        this.largeImageUri = largeImageUri;
    }

    public String getPngImageUri() {
        return pngImageUri;
    }

    public void setPngImageUri(String pngImageUri) {
        this.pngImageUri = pngImageUri;
    }

    public String getArtCropUri() {
        return artCropUri;
    }

    public void setArtCropUri(String artCropUri) {
        this.artCropUri = artCropUri;
    }

    public String getBorderCropUri() {
        return borderCropUri;
    }

    public void setBorderCropUri(String borderCropUri) {
        this.borderCropUri = borderCropUri;
    }

    public Integer getArenaId() {
        return arenaId;
    }

    public void setArenaId(Integer arenaId) {
        this.arenaId = arenaId;
    }

    public Integer getMtgoId() {
        return mtgoId;
    }

    public void setMtgoId(Integer mtgoId) {
        this.mtgoId = mtgoId;
    }

    public Integer getTcgplayerId() {
        return tcgplayerId;
    }

    public void setTcgplayerId(Integer tcgplayerId) {
        this.tcgplayerId = tcgplayerId;
    }

    public Integer getCardmarketId() {
        return cardmarketId;
    }

    public void setCardmarketId(Integer cardmarketId) {
        this.cardmarketId = cardmarketId;
    }

    public Integer getEdhrecRank() {
        return edhrecRank;
    }

    public void setEdhrecRank(Integer edhrecRank) {
        this.edhrecRank = edhrecRank;
    }

    public String getColorsJson() {
        return colorsJson;
    }

    public void setColorsJson(String colorsJson) {
        this.colorsJson = colorsJson;
    }

    public String getColorIdentityJson() {
        return colorIdentityJson;
    }

    public void setColorIdentityJson(String colorIdentityJson) {
        this.colorIdentityJson = colorIdentityJson;
    }

    public String getGamesJson() {
        return gamesJson;
    }

    public void setGamesJson(String gamesJson) {
        this.gamesJson = gamesJson;
    }

    public String getKeywordsJson() {
        return keywordsJson;
    }

    public void setKeywordsJson(String keywordsJson) {
        this.keywordsJson = keywordsJson;
    }

    public String getProducedManaJson() {
        return producedManaJson;
    }

    public void setProducedManaJson(String producedManaJson) {
        this.producedManaJson = producedManaJson;
    }

    public String getPurchaseUrisJson() {
        return purchaseUrisJson;
    }

    public void setPurchaseUrisJson(String purchaseUrisJson) {
        this.purchaseUrisJson = purchaseUrisJson;
    }

    public String getRelatedUrisJson() {
        return relatedUrisJson;
    }

    public void setRelatedUrisJson(String relatedUrisJson) {
        this.relatedUrisJson = relatedUrisJson;
    }

    public String getRawJson() {
        return rawJson;
    }

    public void setRawJson(String rawJson) {
        this.rawJson = rawJson;
    }

    public LocalDateTime getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(LocalDateTime syncedAt) {
        this.syncedAt = syncedAt;
    }

    public List<CardFace> getFaces() {
        return faces;
    }

    public void setFaces(List<CardFace> faces) {
        this.faces = faces;
    }

    public List<CardLegality> getLegalities() {
        return legalities;
    }

    public void setLegalities(List<CardLegality> legalities) {
        this.legalities = legalities;
    }

    public CardPrice getPrice() {
        return price;
    }

    public void setPrice(CardPrice price) {
        this.price = price;
    }

    public List<Ruling> getRulings() {
        return rulings;
    }

    public void setRulings(List<Ruling> rulings) {
        this.rulings = rulings;
    }
}