package com.yarmirror.backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
        name = "users",
        uniqueConstraints = @UniqueConstraint(name = "uk_users_provider_provider_id", columnNames = {"provider", "provider_id"}))
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuthProvider provider;

    @Column(name = "provider_id", nullable = false, length = 128)
    private String providerId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected User() {
    }

    private User(String nickname, AuthProvider provider, String providerId) {
        this.nickname = nickname;
        this.provider = provider;
        this.providerId = providerId;
    }

    public static User of(String nickname, AuthProvider provider, String providerId) {
        return new User(nickname, provider, providerId);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getNickname() {
        return nickname;
    }

    public AuthProvider getProvider() {
        return provider;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
