import { describe, it, expect, beforeEach } from 'vitest';
import { useFavoritesStore } from '@/stores/favoritesStore';

describe('favoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.getState().clear();
  });

  it('initializes with empty favorites', () => {
    const { favorites } = useFavoritesStore.getState();
    expect(favorites).toEqual([]);
  });

  it('adds a favorite', () => {
    const { addFavorite } = useFavoritesStore.getState();
    addFavorite('tournament-1');

    const { favorites } = useFavoritesStore.getState();
    expect(favorites).toContain('tournament-1');
  });

  it('removes a favorite', () => {
    const { addFavorite, removeFavorite } = useFavoritesStore.getState();
    addFavorite('tournament-1');
    removeFavorite('tournament-1');

    const { favorites } = useFavoritesStore.getState();
    expect(favorites).not.toContain('tournament-1');
  });

  it('toggles a favorite', () => {
    const { toggleFavorite } = useFavoritesStore.getState();

    toggleFavorite('tournament-1');
    expect(useFavoritesStore.getState().favorites).toContain('tournament-1');

    toggleFavorite('tournament-1');
    expect(useFavoritesStore.getState().favorites).not.toContain('tournament-1');
  });

  it('checks if tournament is favorited', () => {
    const { addFavorite, isFavorite } = useFavoritesStore.getState();
    addFavorite('tournament-1');

    expect(isFavorite('tournament-1')).toBe(true);
    expect(isFavorite('tournament-2')).toBe(false);
  });
});
