package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "meta_decks")
public class MetaDeck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer tier;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String colorsJson; // Array of colors like ["u", "r"]

    @Column(name = "key_cards_string", columnDefinition = "TEXT")
    private String keyCardsString;

    private String presence; // e.g. "18.7%"
    
    private String price; // e.g. "$ 360"

    @Column(name = "gallery_json", columnDefinition = "TEXT")
    private String galleryJson; // JSON array of {name, imageUrl}

    @Column(name = "mainboard_json", columnDefinition = "TEXT")
    private String mainboardJson; // Store the exact mapped deep-scrape JSON structure

    @Column(name = "full_list_url")
    private String fullListUrl; // MTGGoldfish link

    public MetaDeck() {}

    public Long getId() { return id; }
    public Integer getTier() { return tier; }
    public void setTier(Integer tier) { this.tier = tier; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getColorsJson() { return colorsJson; }
    public void setColorsJson(String colorsJson) { this.colorsJson = colorsJson; }
    public String getKeyCardsString() { return keyCardsString; }
    public void setKeyCardsString(String keyCardsString) { this.keyCardsString = keyCardsString; }
    public String getPresence() { return presence; }
    public void setPresence(String presence) { this.presence = presence; }
    public String getPrice() { return price; }
    public void setPrice(String price) { this.price = price; }
    public String getGalleryJson() { return galleryJson; }
    public void setGalleryJson(String galleryJson) { this.galleryJson = galleryJson; }
    public String getMainboardJson() { return mainboardJson; }
    public void setMainboardJson(String mainboardJson) { this.mainboardJson = mainboardJson; }
    public String getFullListUrl() { return fullListUrl; }
    public void setFullListUrl(String fullListUrl) { this.fullListUrl = fullListUrl; }
}
