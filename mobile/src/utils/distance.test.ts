import { formatDistance, haversineMeters } from './distance';

describe('formatDistance', () => {
  it('renders sub-kilometre distances in whole metres', () => {
    expect(formatDistance(0)).toBe('0m');
    expect(formatDistance(320)).toBe('320m');
    expect(formatDistance(320.4)).toBe('320m');
    expect(formatDistance(999)).toBe('999m');
  });

  it('switches to kilometres at the 1km boundary', () => {
    expect(formatDistance(999.4)).toBe('999m');
    expect(formatDistance(999.6)).toBe('1.0km');
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1200)).toBe('1.2km');
    expect(formatDistance(12345)).toBe('12.3km');
  });

  it('reports missing or invalid distances instead of throwing', () => {
    expect(formatDistance(null)).toBe('거리 정보 없음');
    expect(formatDistance(undefined)).toBe('거리 정보 없음');
    expect(formatDistance(Number.NaN)).toBe('거리 정보 없음');
    expect(formatDistance(-1)).toBe('거리 정보 없음');
  });
});

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    const point = { latitude: 37.5665, longitude: 126.978 };
    expect(haversineMeters(point, point)).toBe(0);
  });

  it('matches a known Seoul City Hall -> Gangnam Station distance', () => {
    const meters = haversineMeters(
      { latitude: 37.5665, longitude: 126.978 },
      { latitude: 37.4979, longitude: 127.0276 },
    );
    expect(meters).toBeGreaterThan(8500);
    expect(meters).toBeLessThan(9500);
  });
});
