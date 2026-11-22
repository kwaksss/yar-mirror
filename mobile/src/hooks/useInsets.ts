import { useContext } from 'react';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';

const ZERO: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * useSafeAreaInsets 는 Provider 가 없으면 예외를 던진다.
 * 화면 단위 테스트는 Provider 없이 렌더링하므로, 없으면 0 으로 처리한다.
 */
export function useInsets(): EdgeInsets {
  return useContext(SafeAreaInsetsContext) ?? ZERO;
}
