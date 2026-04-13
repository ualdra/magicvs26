package com.magicvs.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "card_faces")
public class CardFace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @Column(name = "face_order")
    private Integer faceOrder;

    @Column(nullable = false)
    private String name;

    @Column(name = "mana_cost")
    private String manaCost;

    @Column(name = "type_line")
    private String typeLine;

    @Column(name = "oracle_text", columnDefinition = "TEXT")
    private String oracleText;

    private String power;
    private String toughness;
    private String loyalty;
    private String defense;

    @Column(name = "flavor_text", columnDefinition = "TEXT")
    private String flavorText;

    private String artist;

    @Column(name = "colors_json", columnDefinition = "TEXT")
    private String colorsJson;

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

    @Column(name = "raw_json", columnDefinition = "TEXT")
    private String rawJson;

    public CardFace() {
    }

    public Long getId() {
        return id;
    }

    public Card getCard() {
        return card;
    }

    public void setCard(Card card) {
        this.card = card;
    }

    public Integer getFaceOrder() {
        return faceOrder;
    }

    public void setFaceOrder(Integer faceOrder) {
        this.faceOrder = faceOrder;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getManaCost() {
        return manaCost;
    }

    public void setManaCost(String manaCost) {
        this.manaCost = manaCost;
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

    public String getColorsJson() {
        return colorsJson;
    }

    public void setColorsJson(String colorsJson) {
        this.colorsJson = colorsJson;
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

    public String getRawJson() {
        return rawJson;
    }

    public void setRawJson(String rawJson) {
        this.rawJson = rawJson;
    }
}