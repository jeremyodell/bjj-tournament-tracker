'use client';

import { useState, useEffect, useCallback } from 'react';
import { searchAirports, findNearestAirport, type Airport } from '@/lib/airports';

interface AirportSelectorProps {
  selectedAirport: Airport | null;
  onSelect: (airport: Airport) => void;
}

type DetectionState = 'detecting' | 'detected' | 'denied' | 'error';

export function AirportSelector({ selectedAirport, onSelect }: AirportSelectorProps) {
  const [detectedAirport, setDetectedAirport] = useState<Airport | null>(null);
  const [detectionState, setDetectionState] = useState<DetectionState>('detecting');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Airport[]>([]);

  // Detect nearest airport from geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setDetectionState('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestAirport(
          position.coords.latitude,
          position.coords.longitude
        );
        if (nearest) {
          setDetectedAirport(nearest);
          setDetectionState('detected');
        } else {
          setDetectionState('error');
        }
      },
      () => {
        setDetectionState('denied');
      }
    );
  }, []);

  // Update search results when query changes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      setSearchResults(searchAirports(searchQuery));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSelect = useCallback(
    (airport: Airport) => {
      onSelect(airport);
      setIsSearching(false);
      setSearchQuery('');
    },
    [onSelect]
  );

  const handleCancel = useCallback(() => {
    setIsSearching(false);
    setSearchQuery('');
  }, []);

  // If airport is already selected, show compact view with change button
  if (selectedAirport && !isSearching) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium">
            {selectedAirport.name} ({selectedAirport.iataCode})
          </p>
          <p className="text-sm text-gray-600">
            {selectedAirport.city}, {selectedAirport.state}
          </p>
        </div>
        <button
          onClick={() => setIsSearching(true)}
          className="text-blue-600 hover:underline text-sm"
        >
          Change
        </button>
      </div>
    );
  }

  // Search mode
  if (isSearching) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <input
          type="text"
          placeholder="Search airports by city, name, or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {searchResults.length > 0 && (
          <ul className="max-h-48 overflow-y-auto border rounded bg-white">
            {searchResults.map((airport) => (
              <li
                key={airport.iataCode}
                onClick={() => handleSelect(airport)}
                className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
              >
                <span className="font-medium">{airport.name}</span>
                <span className="text-gray-500 ml-2">({airport.iataCode})</span>
                <p className="text-sm text-gray-600">
                  {airport.city}, {airport.state}
                </p>
              </li>
            ))}
          </ul>
        )}
        {searchQuery.length >= 2 && searchResults.length === 0 && (
          <p className="text-sm text-gray-500 py-2">No airports found</p>
        )}
        <button
          onClick={handleCancel}
          className="mt-2 text-gray-600 text-sm hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Detection in progress
  if (detectionState === 'detecting') {
    return (
      <div className="p-4 bg-gray-50 rounded-lg" role="status">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Detecting your nearest airport...</span>
        </div>
      </div>
    );
  }

  // Detection successful - show detected airport with options
  if (detectionState === 'detected' && detectedAirport) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">Based on your location:</p>
        <p className="font-medium">
          {detectedAirport.name} ({detectedAirport.iataCode})
        </p>
        <p className="text-sm text-gray-600 mb-3">
          {detectedAirport.city}, {detectedAirport.state}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleSelect(detectedAirport)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Use {detectedAirport.iataCode}
          </button>
          <button
            onClick={() => setIsSearching(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          >
            Choose different
          </button>
        </div>
      </div>
    );
  }

  // Geolocation denied or error - show search only
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <p className="text-gray-600 mb-2">Select your home airport:</p>
      <button
        onClick={() => setIsSearching(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Search airports
      </button>
    </div>
  );
}
