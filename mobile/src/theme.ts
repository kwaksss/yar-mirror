import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * 앱 전체가 공유하는 디자인 값.
 *
 * 방향: 사진이 주인공인 차분한 화면. 바탕은 흰색과 서늘한 회색, 글자는 짙은 남색 계열,
 * 강조색은 하나(아이리스)만 쓴다. 거울의 은색 느낌을 위해 회색은 모두 푸른 기가 도는 쪽으로 맞췄다.
 */
export const colors = {
  ink: '#161A23',
  inkSoft: '#4A5160',
  muted: '#8A91A0',
  line: '#E6E9EF',
  surface: '#F3F5F8',
  paper: '#FFFFFF',
  accent: '#4F46E5',
  accentSoft: '#EEEDFD',
  danger: '#D93838',
  scrim: 'rgba(22, 26, 35, 0.72)',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  sheet: 24,
  pill: 999,
} as const;

/** 4pt 기반 간격. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

/** 크기 단계: 26 / 20 / 17 / 15 / 13. */
export const type = {
  display: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4, color: colors.ink },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2, color: colors.ink },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400', color: colors.inkSoft },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.muted },
} satisfies Record<string, TextStyle>;

/** 지도 위에 떠 있는 요소(버튼, 시트)용 그림자. */
export const floating: ViewStyle = Platform.select<ViewStyle>({
  web: { boxShadow: '0 6px 24px rgba(22, 26, 35, 0.14)' } as ViewStyle,
  default: {
    shadowColor: '#161A23',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});

/** 상세·등록 화면이 넓은 웹 화면에서 한없이 늘어나지 않도록 하는 폭. */
export const CONTENT_MAX_WIDTH = 560;
