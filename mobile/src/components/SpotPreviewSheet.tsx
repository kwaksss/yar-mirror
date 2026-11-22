import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, floating, radius, space, type } from '../theme';
import type { Spot } from '../types/spot';
import { CloseIcon } from './ui/Icons';

type Props = {
  spot: Spot;
  /** "320m" 처럼 이미 포맷된 거리. 알 수 없으면 null. */
  distanceText: string | null;
  /** 시트를 누르거나 위로 끌어 올렸을 때. 상세 화면으로 이동한다. */
  onOpen: () => void;
  onClose: () => void;
  bottomInset?: number;
};

/** 화면 높이 대비 처음 보여 줄 시트 높이. */
export const PEEK_RATIO = 0.5;
/** 이만큼 위로 끌거나 빠르게 튕기면 상세 화면을 연다. */
const OPEN_DRAG = 60;
const OPEN_VELOCITY = -0.6;
/** 이만큼 아래로 끌거나 빠르게 튕기면 닫는다. */
const CLOSE_DRAG = 80;
const CLOSE_VELOCITY = 0.6;

/**
 * 지도에서 마커를 눌렀을 때 화면 아래 절반에 뜨는 미리보기 시트.
 *
 * 높이 하나만 애니메이션한다. 위로 끌면 시트가 커지면서 사진도 같이 커지고, 기준을 넘기면 화면 꼭대기까지
 * 펼친 뒤 상세 화면으로 넘어간다. 높이(레이아웃 값)는 네이티브 드라이버를 쓸 수 없지만, 웹과 앱에서
 * 똑같이 동작하고 사진이 자연스럽게 따라 커진다는 점을 우선했다.
 */
export function SpotPreviewSheet({ spot, distanceText, onOpen, onClose, bottomInset = 0 }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const peek = Math.round(windowHeight * PEEK_RATIO);
  const height = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);

  // PanResponder 는 한 번만 만들므로, 최신 값은 ref 로 읽는다.
  const latest = useRef({ peek, windowHeight, onOpen, onClose });
  latest.current = { peek, windowHeight, onOpen, onClose };

  const settle = (toValue: number, then?: () => void) => {
    const { windowHeight: full } = latest.current;
    const animation =
      toValue === latest.current.peek
        ? Animated.spring(height, { toValue, useNativeDriver: false, bounciness: 4, speed: 14 })
        : Animated.timing(height, {
            toValue,
            duration: reduceMotion.current ? 0 : toValue >= full ? 240 : 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          });
    if (reduceMotion.current && toValue === latest.current.peek) {
      height.setValue(toValue);
      then?.();
      return;
    }
    animation.start(({ finished }) => {
      if (finished) then?.();
    });
  };

  // 처음 열릴 때 아래에서 올라온다. 이 화면의 유일한 등장 애니메이션이다.
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        reduceMotion.current = Boolean(enabled);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) settle(latest.current.peek);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 창 크기가 바뀌면(웹 리사이즈, 회전) 기준 높이를 따라간다.
  // 첫 렌더에서는 등장 애니메이션이 처리하므로 건너뛴다.
  const firstPeek = useRef(peek);
  useEffect(() => {
    if (peek === firstPeek.current) return;
    firstPeek.current = peek;
    height.setValue(peek);
  }, [height, peek]);

  const dragStart = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      // 손가락이 세로로 조금 움직이면 안쪽 버튼보다 먼저 시트가 제스처를 가져간다.
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        height.stopAnimation((value) => {
          dragStart.current = value;
        });
      },
      onPanResponderMove: (_e, g) => {
        const next = Math.min(latest.current.windowHeight, Math.max(0, dragStart.current - g.dy));
        height.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const current = latest.current;
        if (g.dy < -OPEN_DRAG || g.vy < OPEN_VELOCITY) {
          settle(current.windowHeight, current.onOpen);
        } else if (g.dy > CLOSE_DRAG || g.vy > CLOSE_VELOCITY) {
          settle(0, current.onClose);
        } else {
          settle(current.peek);
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => settle(latest.current.peek),
    }),
  ).current;

  const photoMessage =
    spot.photoUploadStatus === 'PENDING' ? '사진을 올리는 중이에요' : '아직 사진이 없어요';

  return (
    <Animated.View
      testID="spot-preview-sheet"
      style={[styles.sheet, floating, { height }]}
      {...panResponder.panHandlers}
    >
      <Pressable
        testID="spot-preview-open"
        accessibilityRole="button"
        accessibilityLabel={`${spot.name} 상세 보기`}
        accessibilityHint="누르거나 위로 끌어 올리면 상세 화면이 열립니다"
        onPress={onOpen}
        style={[styles.body, { paddingBottom: space.xl + bottomInset }]}
      >
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={styles.headerRow}>
          <Text style={[type.title, styles.name]} numberOfLines={1}>
            {spot.name}
          </Text>
          <Pressable
            testID="spot-preview-close"
            accessibilityRole="button"
            accessibilityLabel="미리보기 닫기"
            hitSlop={8}
            onPress={() => settle(0, onClose)}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <CloseIcon size={14} color={colors.inkSoft} />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          {distanceText ? (
            <Text testID="spot-preview-distance" style={styles.distance}>
              {distanceText}
            </Text>
          ) : null}
          <Text style={[type.body, styles.address]} numberOfLines={1}>
            {spot.address ?? '주소 정보 없음'}
          </Text>
        </View>

        {spot.photoUrl && spot.photoUploadStatus === 'CONFIRMED' ? (
          <Image
            testID="spot-preview-photo"
            source={{ uri: spot.photoUrl }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Text style={type.caption}>{photoMessage}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  body: { flex: 1, paddingHorizontal: space.xl },
  handleArea: { alignItems: 'center', paddingTop: space.sm + 2, paddingBottom: space.md },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { flex: 1 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  distance: { ...type.label, color: colors.accent },
  address: { flex: 1 },
  photo: {
    flex: 1,
    width: '100%',
    marginTop: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', minHeight: 120 },
});
