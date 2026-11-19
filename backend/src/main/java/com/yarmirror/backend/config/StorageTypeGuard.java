package com.yarmirror.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * {@code app.storage.type}({@code STORAGE_TYPE}) 값이 {@code local} 또는 {@code s3}인지 기동 시점에 검사한다.
 *
 * <p>두 스토리지 구현은 이 값과 정확히 일치할 때만 등록된다. 값 뒤에 공백이나 인라인 주석이 붙으면(예:
 * {@code STORAGE_TYPE=s3 # 주석}) 어느 쪽도 등록되지 않아 엉뚱한 빈 누락 오류로 보이므로, 원인을 바로 알 수 있게
 * 여기서 먼저 실패시킨다.
 */
@Configuration
public class StorageTypeGuard {

    public StorageTypeGuard(@Value("${app.storage.type:local}") String storageType) {
        if (!"local".equalsIgnoreCase(storageType) && !"s3".equalsIgnoreCase(storageType)) {
            throw new IllegalStateException("app.storage.type (STORAGE_TYPE) must be 'local' or 's3' but was '"
                    + storageType + "'; check for trailing spaces or inline comments");
        }
    }
}
