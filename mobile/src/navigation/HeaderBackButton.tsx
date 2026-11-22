import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronLeft } from '../components/ui/Icons';
import { colors, floating } from '../theme';

export type BackNavigation = {
  canGoBack: () => boolean;
  goBack: () => void;
  navigate: (name: 'Map') => void;
};

/** 쌓인 화면이 없으면(웹 새로고침 등) 지도 화면으로 보낸다. */
export function goBackOrMap(navigation: BackNavigation) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.navigate('Map');
  }
}

/**
 * 헤더 뒤로가기 버튼.
 *
 * 기본 뒤로가기 버튼은 `@react-navigation/elements` 의 back-icon.png 를 쓰는데, 웹 빌드에서 이 파일은
 * `dist/assets/node_modules/...` 아래에 놓인다. Cloudflare Pages 는 `node_modules` 경로를 올리지 않아
 * 이미지가 404(SPA 폴백 HTML)로 떨어지고 버튼이 보이지 않는다. 그래서 이미지 없이 View 로 그린다.
 */
export function HeaderBackButton({ navigation }: { navigation: BackNavigation }) {
  return (
    <Pressable
      testID="header-back-button"
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
      hitSlop={12}
      onPress={() => goBackOrMap(navigation)}
      style={({ pressed }) => [styles.header, pressed && styles.pressed]}
    >
      <ChevronLeft size={22} />
    </Pressable>
  );
}

/** 사진 위에 떠 있는 둥근 뒤로가기 버튼(상세 화면). */
export function FloatingBackButton({
  navigation,
  style,
}: {
  navigation: BackNavigation;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID="floating-back-button"
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
      hitSlop={8}
      onPress={() => goBackOrMap(navigation)}
      style={({ pressed }) => [styles.floating, floating, style, pressed && styles.pressed]}
    >
      <ChevronLeft size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 6, paddingVertical: 4, marginRight: 8 },
  floating: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
