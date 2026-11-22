import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import {
  OAuthCancelledError,
  prepareAuthorization,
  type SocialProvider,
} from '../auth/oauth';
import { colors, radius, space, type } from '../theme';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 버튼을 누르는 즉시 팝업을 열 수 있도록 인증 URL 을 미리 만든다. 시도가 끝나면 다음 시도용으로 다시 만든다.
  useEffect(() => {
    if (pending === null) prepareAuthorization('kakao').catch(() => undefined);
  }, [pending]);

  const handleLogin = async (provider: SocialProvider) => {
    setPending(provider);
    setError(null);
    try {
      await signIn(provider);
    } catch (caught) {
      if (!(caught instanceof OAuthCancelledError)) {
        setError(caught instanceof Error ? caught.message : '로그인에 실패했습니다.');
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <View style={styles.mirror}>
          <View style={styles.mirrorGlint} />
        </View>
        <Text style={styles.title}>거울샷 스팟</Text>
        <Text style={styles.subtitle}>근처에서 전신거울 샷 찍기 좋은 곳을 찾아보세요</Text>
      </View>

      <Pressable
        testID="kakao-login-button"
        accessibilityRole="button"
        disabled={pending !== null}
        style={[styles.button, styles.kakaoButton]}
        onPress={() => handleLogin('kakao')}
      >
        {pending === 'kakao' ? (
          <ActivityIndicator color="#191600" />
        ) : (
          <Text style={styles.kakaoLabel}>카카오로 시작하기</Text>
        )}
      </Pressable>

      {error ? (
        <Text testID="login-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    gap: space.md,
    backgroundColor: colors.paper,
  },
  brand: { alignItems: 'center', gap: space.sm, marginBottom: 48 },
  // 세로로 긴 전신거울을 단순한 도형으로 표현한 로고.
  mirror: {
    width: 56,
    height: 84,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.accentSoft,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  mirrorGlint: {
    position: 'absolute',
    top: 14,
    left: 12,
    width: 8,
    height: 30,
    borderRadius: 4,
    backgroundColor: colors.paper,
    transform: [{ rotate: '20deg' }],
  },
  title: { ...type.display, fontSize: 30, lineHeight: 36, textAlign: 'center' },
  subtitle: { ...type.body, textAlign: 'center' },
  button: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: radius.md,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakaoButton: { backgroundColor: '#FEE500' },
  kakaoLabel: { color: '#191600', fontSize: 16, fontWeight: '700' },
  error: { ...type.body, color: colors.danger, textAlign: 'center', marginTop: space.sm },
});
