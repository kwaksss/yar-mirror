import React, { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Place, PlaceSearch } from '../hooks/usePlaceSearch';
import { colors, radius, space, type } from '../theme';
import { CloseIcon, SearchIcon } from './ui/Icons';

/** 카카오는 한 번에 15건을 준다. 지도를 가리지 않도록 앞쪽만 보여 준다. */
const MAX_RESULTS = 5;

type Props = {
  /** usePlaceSearch() 결과. request 는 같은 화면의 KakaoMapView 에 넘겨야 검색된다. */
  search: PlaceSearch;
  onSelect: (place: Place) => void;
  placeholder?: string;
  /** 검색창 오른쪽에 붙일 요소(예: 주변 스팟 수). 입력 중에는 지우기 버튼이 대신 나온다. */
  trailing?: React.ReactNode;
  /** 입력창 상자에 덧붙일 스타일(그림자, 배경색 등). */
  inputBoxStyle?: StyleProp<ViewStyle>;
};

/** 검색어를 입력하고 엔터를 누르면 장소를 찾고, 결과를 누르면 onSelect 로 알린다. */
export function PlaceSearchBar({
  search,
  onSelect,
  placeholder = '장소, 주소 검색',
  trailing,
  inputBoxStyle,
}: Props) {
  const [query, setQuery] = useState('');

  const handleClear = () => {
    setQuery('');
    search.clear();
  };

  const handleSelect = (place: Place) => {
    setQuery(place.name);
    search.clear();
    Keyboard.dismiss();
    onSelect(place);
  };

  let message: string | null = null;
  if (search.status === 'pending') message = '검색 중...';
  else if (search.status === 'failed') message = '검색하지 못했어요. 잠시 후 다시 시도해 주세요.';
  else if (search.status === 'resolved' && search.places.length === 0) message = '검색 결과가 없어요.';

  const showPanel = search.status !== 'idle';

  return (
    <View>
      <View style={[styles.inputBox, inputBoxStyle]}>
        <SearchIcon />
        <TextInput
          testID="place-search-input"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search.search(query)}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? (
          <Pressable
            testID="place-search-clear"
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            hitSlop={8}
            onPress={handleClear}
          >
            <CloseIcon size={12} color={colors.muted} />
          </Pressable>
        ) : (
          trailing
        )}
      </View>

      {showPanel ? (
        <View testID="place-search-results" style={styles.panel}>
          {message ? (
            <Text style={[type.caption, styles.message]}>{message}</Text>
          ) : (
            search.places.slice(0, MAX_RESULTS).map((place, index) => (
              <Pressable
                key={`${place.name}-${place.latitude}-${place.longitude}`}
                testID={`place-search-result-${index}`}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowDivider,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleSelect(place)}
              >
                <Text style={type.label} numberOfLines={1}>
                  {place.name}
                </Text>
                {place.address ? (
                  <Text style={type.caption} numberOfLines={1}>
                    {place.address}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: space.md },
  panel: {
    marginTop: space.sm,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  message: { padding: space.lg },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.surface },
});
