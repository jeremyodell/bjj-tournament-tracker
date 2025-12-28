import { create } from 'zustand';

interface FavoritesState {
  favorites: string[];
  addFavorite: (tournamentId: string) => void;
  removeFavorite: (tournamentId: string) => void;
  toggleFavorite: (tournamentId: string) => void;
  isFavorite: (tournamentId: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],

  addFavorite: (tournamentId) => {
    set((state) => ({
      favorites: state.favorites.includes(tournamentId)
        ? state.favorites
        : [...state.favorites, tournamentId],
    }));
  },

  removeFavorite: (tournamentId) => {
    set((state) => ({
      favorites: state.favorites.filter((id) => id !== tournamentId),
    }));
  },

  toggleFavorite: (tournamentId) => {
    const { favorites, addFavorite, removeFavorite } = get();
    if (favorites.includes(tournamentId)) {
      removeFavorite(tournamentId);
    } else {
      addFavorite(tournamentId);
    }
  },

  isFavorite: (tournamentId) => {
    return get().favorites.includes(tournamentId);
  },

  clear: () => set({ favorites: [] }),
}));
