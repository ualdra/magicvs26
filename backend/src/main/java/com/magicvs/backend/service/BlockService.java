package com.magicvs.backend.service;

import com.magicvs.backend.model.Friendship;
import com.magicvs.backend.model.FriendshipStatus;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.FriendshipRepository;
import com.magicvs.backend.repository.RegistroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class BlockService {

    private final RegistroRepository userRepository;
    private final FriendshipRepository friendshipRepository;

    public BlockService(RegistroRepository userRepository, FriendshipRepository friendshipRepository) {
        this.userRepository = userRepository;
        this.friendshipRepository = friendshipRepository;
    }

    /**
     * Lógica principal de bloqueo (unidireccional):
     * 1. Valida que no esté ya bloqueado.
     * 2. Registra el bloqueo.
     * 3. Elimina cualquier relación de amistad (pendiente o aceptada).
     * 4. Ajusta contadores si eran amigos.
     */
    @Transactional
    public void blockUser(Long userId, Long targetId) {
        if (userId.equals(targetId)) {
            throw new RuntimeException("No puedes bloquearte a ti mismo.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + userId));
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new RuntimeException("Usuario a bloquear no encontrado: " + targetId));

        // Validar que no esté ya bloqueado
        if (user.getBlockedUsers().contains(target)) {
            throw new RuntimeException("El usuario ya está bloqueado.");
        }

        // 1. Añadimos el bloqueo (Set gestionado por JPA) - Unidireccional
        user.getBlockedUsers().add(target);

        // 2. Gestionar la ruptura de amistad
        Optional<Friendship> friendship = friendshipRepository.findByUsers(user, target);
        
        if (friendship.isPresent()) {
            // Si la amistad ya estaba aceptada, decrementamos los contadores de ambos
            if (friendship.get().getStatus() == FriendshipStatus.ACCEPTED) {
                decrementFriendCount(user);
                decrementFriendCount(target);
            }
            
            // Borramos la relación físicamente de la tabla 'friendships'
            friendshipRepository.deleteFriendshipBetween(user, target);
        }

        // 3. Persistimos los cambios (solo el usuario que bloquea)
        userRepository.save(user);
    }

    /**
     * Elimina a un usuario de la lista de bloqueados.
     * Lanza una excepción si el usuario no está bloqueado.
     */
    @Transactional
    public void unblockUser(Long userId, Long targetId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + userId));
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado: " + targetId));

        boolean wasRemoved = user.getBlockedUsers().remove(target);
        if (!wasRemoved) {
            throw new RuntimeException("El usuario no estaba bloqueado.");
        }
        
        userRepository.save(user);
    }

    /**
     * Comprueba si el 'blockerId' tiene bloqueado al 'targetId' (unidireccional).
     */
    @Transactional(readOnly = true)
    public boolean isBlocked(Long blockerId, Long targetId) {
        if (blockerId == null || targetId == null) {
            return false;
        }
        return userRepository.findById(blockerId)
                .map(user -> user.getBlockedUsers().stream()
                        .anyMatch(u -> u.getId().equals(targetId)))
                .orElse(false);
    }

    /**
     * Helper privado para bajar el contador de amigos de forma segura.
     */
    private void decrementFriendCount(User user) {
        int current = (user.getFriendsCount() == null) ? 0 : user.getFriendsCount();
        user.setFriendsCount(Math.max(0, current - 1));
    }
}