package com.yarmirror.backend.spot.storage;

import java.util.regex.Pattern;

/**
 * 스토리지 어댑터들이 공유하는 오브젝트 키 규칙.
 *
 * <p>키는 {@code spots/{uuid}.{jpg|png|webp}} 형식만 허용한다. 서버가 직접 발급한 키만 통과하므로
 * path traversal이나 임의 경로 조회도 함께 막힌다.
 */
final class ObjectKeys {

    private static final Pattern OBJECT_KEY = Pattern.compile("spots/[0-9a-fA-F-]{36}\\.(jpg|png|webp)");

    private ObjectKeys() {
    }

    /** 이 서버가 발급하는 형식의 키인지 확인한다. */
    static boolean isValid(String objectKey) {
        return objectKey != null && OBJECT_KEY.matcher(objectKey).matches();
    }

    /** 공개 기본 URL과 키를 이어 붙여 공개 URL을 만든다. 기본 URL 끝의 {@code /}는 무시한다. */
    static String publicUrl(String publicBaseUrl, String objectKey) {
        return trimTrailingSlash(publicBaseUrl) + "/" + objectKey;
    }

    /**
     * 공개 URL에서 오브젝트 키를 되찾는다. 설정된 기본 URL 아래가 아니거나 키 형식이 맞지 않으면 {@code null}.
     */
    static String fromPublicUrl(String publicBaseUrl, String photoUrl) {
        if (photoUrl == null) {
            return null;
        }
        String prefix = trimTrailingSlash(publicBaseUrl) + "/";
        if (!photoUrl.startsWith(prefix)) {
            return null;
        }
        String key = photoUrl.substring(prefix.length());
        return isValid(key) ? key : null;
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
