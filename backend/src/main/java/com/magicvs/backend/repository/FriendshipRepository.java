package com.magicvs.backend.repository;

import com.magicvs.backend.model.Friendship;
import com.magicvs.backend.model.FriendshipStatus;
import com.magicvs.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f WHERE (f.user = :u1 AND f.friend = :u2) OR (f.user = :u2 AND f.friend = :u1)")
    Optional<Friendship> findByUsers(@Param("u1") User u1, @Param("u2") User u2);

    @Query("SELECT f FROM Friendship f WHERE f.friend = :user AND f.status = 'PENDING'")
    List<Friendship> findPendingRequestsForUser(@Param("user") User user);

    @Query("SELECT f FROM Friendship f WHERE (f.user = :user OR f.friend = :user) AND f.status = 'ACCEPTED'")
    List<Friendship> findAcceptedFriendsForUser(@Param("user") User user);

    boolean existsByUserAndFriend(User user, User friend);
    
    void deleteByUserAndFriend(User user, User friend);
}
