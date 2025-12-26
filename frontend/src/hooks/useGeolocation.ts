'use client';

import { useState, useCallback } from 'react';

interface GeolocationState {
  lat: number | null;
  lng: number | null;
  label: string | null;
  loading: boolean;
  error: string | null;
}

interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => void;
  setManualLocation: (lat: number, lng: number, label: string) => void;
  clearLocation: () => void;
}

const STORAGE_KEY = 'bjj-tracker-location';

function loadFromStorage(): Pick<GeolocationState, 'lat' | 'lng' | 'label'> | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveToStorage(lat: number, lng: number, label: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, label }));
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function useGeolocation(): UseGeolocationReturn {
  const stored = loadFromStorage();

  const [state, setState] = useState<GeolocationState>({
    lat: stored?.lat ?? null,
    lng: stored?.lng ?? null,
    label: stored?.label ?? null,
    loading: false,
    error: null,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get city name (using free Nominatim API)
        let label = 'Current location';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          const city = data.address?.city || data.address?.town || data.address?.village;
          const regionState = data.address?.state;
          if (city && regionState) {
            label = `${city}, ${regionState}`;
          } else if (city) {
            label = city;
          }
        } catch {
          // Use fallback label
        }

        saveToStorage(latitude, longitude, label);
        setState({
          lat: latitude,
          lng: longitude,
          label,
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const setManualLocation = useCallback((lat: number, lng: number, label: string) => {
    saveToStorage(lat, lng, label);
    setState({
      lat,
      lng,
      label,
      loading: false,
      error: null,
    });
  }, []);

  const clearLocation = useCallback(() => {
    clearStorage();
    setState({
      lat: null,
      lng: null,
      label: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    requestLocation,
    setManualLocation,
    clearLocation,
  };
}
