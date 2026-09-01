package com.yarmirror.backend.repository;

import com.yarmirror.backend.domain.AuthProvider;
import com.yarmirror.backend.domain.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByProviderAndProviderId(AuthProvider provider, String providerId);
}
