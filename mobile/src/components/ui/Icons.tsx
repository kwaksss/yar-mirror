import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

/*
 * 아이콘은 이미지 파일 없이 View 로 그린다.
 * 웹 배포(Cloudflare Pages)에서 node_modules 아래 이미지 자산이 올라가지 않는 문제를 피하고,
 * 아이콘 폰트 같은 의존성도 늘리지 않기 위해서다.
 */

type IconProps = { size?: number; color?: string; weight?: number };

/** 왼쪽을 가리키는 꺾쇠. */
export function ChevronLeft({ size = 20, color = colors.ink, weight = 2.25 }: IconProps) {
  const arm = size * 0.48;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: arm,
          height: arm,
          marginLeft: arm * 0.35,
          borderLeftWidth: weight,
          borderBottomWidth: weight,
          borderColor: color,
          borderBottomLeftRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** 엑스(닫기). */
export function CloseIcon({ size = 16, color = colors.ink, weight = 2 }: IconProps) {
  const bar = { position: 'absolute' as const, width: size, height: weight, borderRadius: weight, backgroundColor: color };
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/** 더하기. */
export function PlusIcon({ size = 14, color = colors.paper, weight = 2.25 }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ position: 'absolute', width: size, height: weight, borderRadius: weight, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: weight, height: size, borderRadius: weight, backgroundColor: color }} />
    </View>
  );
}

/** 돋보기. 동그라미와 오른쪽 아래 손잡이. */
export function SearchIcon({ size = 18, color = colors.muted, weight = 2 }: IconProps) {
  const lens = size * 0.68;
  const handle = size * 0.34;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: lens,
          height: lens,
          borderRadius: lens / 2,
          borderWidth: weight,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: handle,
          height: weight,
          borderRadius: weight,
          backgroundColor: color,
          left: lens - handle * 0.3,
          top: lens + handle * 0.05,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** 내 위치 버튼 아이콘. 테두리 원 안의 점. 따라가기 중이면 강조색, 아니면 회색. */
export function LocateIcon({ size = 20, active = false }: { size?: number; active?: boolean }) {
  const color = active ? colors.accent : colors.muted;
  const dot = size * 0.4;
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color },
      ]}
    >
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
    </View>
  );
}

/** 위치 핀을 단순화한 점. 주소 줄 앞에 붙인다. */
export function PinDot({ size = 8, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
