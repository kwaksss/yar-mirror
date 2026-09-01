CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    nickname    VARCHAR(50)  NOT NULL,
    provider    VARCHAR(20)  NOT NULL,
    provider_id VARCHAR(128) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_users_provider_provider_id UNIQUE (provider, provider_id)
);

CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uk_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE TABLE spots (
    id                  BIGSERIAL PRIMARY KEY,
    uploader_id         BIGINT                   NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    latitude            DOUBLE PRECISION         NOT NULL,
    longitude           DOUBLE PRECISION         NOT NULL,
    location            geography(Point, 4326)   NOT NULL,
    address             VARCHAR(255),
    name                VARCHAR(100)             NOT NULL,
    description         VARCHAR(500),
    photo_url           VARCHAR(512)             NOT NULL,
    photo_upload_status VARCHAR(20)              NOT NULL,
    created_at          TIMESTAMPTZ              NOT NULL DEFAULT now(),
    CONSTRAINT ck_spots_photo_upload_status CHECK (photo_upload_status IN ('PENDING', 'CONFIRMED')),
    CONSTRAINT ck_spots_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT ck_spots_longitude CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX idx_spots_location_gist ON spots USING GIST (location);
CREATE INDEX idx_spots_uploader_id ON spots (uploader_id);
CREATE INDEX idx_spots_photo_upload_status ON spots (photo_upload_status);
