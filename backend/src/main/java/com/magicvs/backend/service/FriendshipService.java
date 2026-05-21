package com.magicvs.backend.service;

import com.magicvs.backend.model.Friendship;
import com.magicvs.backend.model.FriendshipStatus;
import com.magicvs.backend.model.NotificationType;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.FriendshipRepository;
import com.magicvs.backend.repository.NotificationRepository;
import com.magicvs.backend.repository.RegistroRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final RegistroRepository userRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final AchievementService achievementService;
    private final BlockService blockService; // <--- NUEVA DEPENDENCIA

    public FriendshipService(FriendshipRepository friendshipRepository,
                             RegistroRepository userRepository,
                             NotificationService notificationService,
                             NotificationRepository notificationRepository,
                             AchievementService achievementService,
                             BlockService blockService) { // <--- INYECTADO EN CONSTRUCTOR
        this.friendshipRepository = friendshipRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.notificationRepository = notificationRepository;
        this.achievementService = achievementService;
        this.blockService = blockService;
    }

    @Transactional
    public void sendFriendRequest(Long senderId, Long receiverId) {
        if (senderId.equals(receiverId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes enviarte una solicitud a ti mismo");
        }

        // --- MURO DE SEGURIDAD: BLOQUEOS ---
        if (blockService.isBlocked(receiverId, senderId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes enviar solicitudes a este usuario.");
        }
        if (blockService.isBlocked(senderId, receiverId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tienes a este usuario bloqueado.");
        }
        // -----------------------------------

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Remitente no encontrado"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destinatario no encontrado"));

        Optional<Friendship> existing = friendshipRepository.findByUsers(sender, receiver);
        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una relación o solicitud pendiente");
        }

        Friendship friendship = new Friendship();
        friendship.setUser(sender);
        friendship.setFriend(receiver);
        friendship.setStatus(FriendshipStatus.PENDING);
        friendshipRepository.save(friendship);

        // Notify receiver
        Map<String, Object> data = new HashMap<>();
        data.put("senderId", senderId);
        data.put("senderName", sender.getDisplayName() != null ? sender.getDisplayName() : sender.getUsername());
        data.put("message", sender.getUsername() + " te ha enviado una solicitud de amistad.");
        notificationService.createNotification(receiverId, NotificationType.FRIEND_REQUEST, data);
    }

    @Transactional
    public void acceptFriendRequest(Long receiverId, Long senderId) {
        // --- MURO DE SEGURIDAD: Por si se bloquearon mientras la solicitud estaba pendiente ---
        if (blockService.isBlocked(receiverId, senderId) || blockService.isBlocked(senderId, receiverId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se puede aceptar la solicitud debido a un bloqueo activo.");
        }

        User receiver = userRepository.findById(receiverId).orElseThrow();
        User sender = userRepository.findById(senderId).orElseThrow();

        Friendship friendship = friendshipRepository.findByUsers(receiver, sender)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada"));

        if (friendship.getStatus() == FriendshipStatus.ACCEPTED) {
            return;
        }

        friendship.setStatus(FriendshipStatus.ACCEPTED);
        friendshipRepository.save(friendship);

        // Increment friend counts
        incrementFriendCount(sender);
        incrementFriendCount(receiver);

        // Logros de amistad
        for (User u : List.of(sender, receiver)) {
            achievementService.increment(u, "FIRST_FRIEND");
            achievementService.increment(u, "FRIENDS_5");
            achievementService.increment(u, "FRIENDS_10");
        }

        removeFriendRequestNotification(receiverId, senderId);

        // Notificaciones de éxito
        Map<String, Object> dataForSender = new HashMap<>();
        dataForSender.put("message", "¡Tú y " + receiver.getUsername() + " ahora sois amigos!");
        notificationService.createNotification(senderId, NotificationType.SYSTEM, dataForSender);

        Map<String, Object> dataForReceiver = new HashMap<>();
        dataForReceiver.put("message", "¡Tú y " + sender.getUsername() + " ahora sois amigos!");
        notificationService.createNotification(receiverId, NotificationType.SYSTEM, dataForReceiver);
    }

    @Transactional
    public void cancelFriendRequest(Long senderId, Long receiverId) {
        User sender = userRepository.findById(senderId).orElseThrow();
        User receiver = userRepository.findById(receiverId).orElseThrow();

        Friendship friendship = friendshipRepository.findByUsers(sender, receiver)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada"));

        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se puede cancelar una solicitud ya aceptada");
        }

        friendshipRepository.delete(friendship);
        removeFriendRequestNotification(receiverId, senderId);
    }

    @Transactional
    public void rejectFriendRequest(Long receiverId, Long senderId) {
        User receiver = userRepository.findById(receiverId).orElseThrow();
        User sender = userRepository.findById(senderId).orElseThrow();

        Friendship friendship = friendshipRepository.findByUsers(receiver, sender)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada"));

        friendshipRepository.delete(friendship);
        removeFriendRequestNotification(receiverId, senderId);
    }

    @Transactional
    public void removeFriend(Long user1Id, Long user2Id) {
        User u1 = userRepository.findById(user1Id).orElseThrow();
        User u2 = userRepository.findById(user2Id).orElseThrow();

        Friendship friendship = friendshipRepository.findByUsers(u1, u2)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Amistad no encontrada"));

        friendshipRepository.delete(friendship);

        decrementFriendCount(u1);
        decrementFriendCount(u2);
    }

    public String getFriendshipStatus(Long user1Id, Long user2Id) {
        User u1 = userRepository.findById(user1Id).orElseThrow();
        User u2 = userRepository.findById(user2Id).orElseThrow();
        
        return friendshipRepository.findByUsers(u1, u2)
                .map(f -> f.getStatus().toString())
                .orElse("NONE");
    }

    public List<User> getAcceptedFriends(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        
        return friendshipRepository.findAcceptedFriendsForUser(user).stream()
                .map(f -> f.getUser().getId().equals(userId) ? f.getFriend() : f.getUser())
                .collect(Collectors.toList());
    }

    private void incrementFriendCount(User user) {
        user.setFriendsCount((user.getFriendsCount() == null ? 0 : user.getFriendsCount()) + 1);
        userRepository.save(user);
    }

    private void decrementFriendCount(User user) {
        int current = user.getFriendsCount() == null ? 0 : user.getFriendsCount();
        user.setFriendsCount(Math.max(0, current - 1));
        userRepository.save(user);
    }

    private void removeFriendRequestNotification(Long userId, Long senderId) {
        var notifications = notificationRepository.findAll().stream()
                .filter(n -> n.getUserId().equals(userId) && n.getType() == NotificationType.FRIEND_REQUEST)
                .filter(n -> {
                    Object sid = n.getData().get("senderId");
                    return sid != null && sid.toString().equals(senderId.toString());
                })
                .toList();
        
        notificationRepository.deleteAll(notifications);
    }

    /**
     * Obtiene la lista de amigos ACEPTADOS de un usuario.
     * Valida privacidad: si el usuario actual está bloqueado, lanza excepción.
     * 
     * @param userId ID del propietario de la lista
     * @param currentUserId ID del usuario que solicita (puede ser null)
     * @return Lista de amigos en estado ACCEPTED
     */
    public List<com.magicvs.backend.dto.UserDirectoryResponseDto> getFriendsOfUser(
            Long userId, 
            Long currentUserId) {
        
        // Validar que el usuario existe
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        
        // PRIVACIDAD: Si el usuario actual está bloqueado por el propietario, no puede ver la lista
        if (currentUserId != null && !currentUserId.equals(userId)) {
            if (blockService.isBlocked(userId, currentUserId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes permiso para ver esta lista de amigos.");
            }
        }
        
        // Obtener amigos aceptados
        List<User> friends = friendshipRepository.findAcceptedFriendsForUser(targetUser).stream()
                .map(f -> f.getUser().getId().equals(userId) ? f.getFriend() : f.getUser())
                .collect(Collectors.toList());
        
        // Convertir a DTO con estado de amistad
        return friends.stream()
                .map(friend -> {
                    com.magicvs.backend.dto.UserDirectoryResponseDto dto = 
                            com.magicvs.backend.dto.UserDirectoryResponseDto.fromEntity(friend);
                    dto.setFriendshipStatus("ACCEPTED");
                    return dto;
                })
                .collect(Collectors.toList());
    }
}