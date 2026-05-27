package com.magicvs.backend.service;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.User;
import com.magicvs.backend.model.UserCard;
import com.magicvs.backend.repository.CardRepository;
import com.magicvs.backend.repository.UserCardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class BoosterService {

    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;

    public BoosterService(CardRepository cardRepository, UserCardRepository userCardRepository) {
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
    }

    @Transactional
    public List<Card> openBooster(User user) {
        List<Card> boosterCards = new ArrayList<>();

        // 10 Commons
        boosterCards.addAll(cardRepository.findRandomCommons(10));
        
        // 3 Uncommons
        boosterCards.addAll(cardRepository.findRandomUncommons(3));
        
        // 1 Rare or Mythic
        boosterCards.addAll(cardRepository.findRandomRaresOrMythics(1));

        // Add to user collection
        for (Card card : boosterCards) {
            Optional<UserCard> existingCardOpt = userCardRepository.findByUserIdAndCardId(user.getId(), card.getId());
            if (existingCardOpt.isPresent()) {
                UserCard existingCard = existingCardOpt.get();
                existingCard.setQuantity(existingCard.getQuantity() + 1);
                userCardRepository.save(existingCard);
            } else {
                UserCard newCard = new UserCard(user, card, 1);
                newCard.setAcquiredAt(LocalDateTime.now());
                userCardRepository.save(newCard);
            }
        }

        return boosterCards;
    }
}
