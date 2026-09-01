import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { OAuthCancelledError, type SocialProvider } from '../auth/oauth';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Text style={styles.title}>거울샷 스팟</Text>
      <Text style={styles.subtitle}>주변의 거울샷 명당을 찾아보세요</Text>

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

      <Pressable
        testID="google-login-button"
        accessibilityRole="button"
        disabled={pending !== null}
        style={[styles.button, styles.googleButton]}
        onPress={() => handleLogin('google')}
      >
        {pending === 'google' ? (
          <ActivityIndicator color="#1f1f1f" />
        ) : (
          <Text style={styles.googleLabel}>Google로 시작하기</Text>
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
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 28 },
  button: { borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  kakaoButton: { backgroundColor: '#FEE500' },
  kakaoLabel: { color: '#191600', fontSize: 16, fontWeight: '600' },
  googleButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dadce0' },
  googleLabel: { color: '#1f1f1f', fontSize: 16, fontWeight: '600' },
  error: { color: '#c0392b', textAlign: 'center', marginTop: 8 },
});
