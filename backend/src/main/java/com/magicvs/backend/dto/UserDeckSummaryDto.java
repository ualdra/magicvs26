package com.magicvs.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public class UserDeckSummaryDto {

	private Long id;
	private String name;
	private String description;
	private String formatName;
	private Integer totalCards;
	private Boolean isPublic;
	private LocalDateTime createdAt;
	private LocalDateTime updatedAt;
	private List<String> colors;

	public UserDeckSummaryDto() {
	}

	public UserDeckSummaryDto(Long id, String name, String description, String formatName, Integer totalCards, Boolean isPublic, LocalDateTime createdAt, LocalDateTime updatedAt, List<String> colors) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.formatName = formatName;
		this.totalCards = totalCards;
		this.isPublic = isPublic;
		this.createdAt = createdAt;
		this.updatedAt = updatedAt;
		this.colors = colors;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getFormatName() {
		return formatName;
	}

	public void setFormatName(String formatName) {
		this.formatName = formatName;
	}

	public Integer getTotalCards() {
		return totalCards;
	}

	public void setTotalCards(Integer totalCards) {
		this.totalCards = totalCards;
	}

	public Boolean getIsPublic() {
		return isPublic;
	}

	public void setIsPublic(Boolean isPublic) {
		this.isPublic = isPublic;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(LocalDateTime createdAt) {
		this.createdAt = createdAt;
	}

	public LocalDateTime getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(LocalDateTime updatedAt) {
		this.updatedAt = updatedAt;
	}

	public List<String> getColors() {
		return colors;
	}

	public void setColors(List<String> colors) {
		this.colors = colors;
	}
}
