'use client';

import { useState, useEffect } from 'react';
import type { PlannedTournament } from '@/stores/plannerStore';

interface TravelOverrideModalProps {
  isOpen: boolean;
  plannedTournament: PlannedTournament;
  onClose: () => void;
  onSave: (travelType: 'drive' | 'fly', travelCost: number) => void;
}

type TravelOption = 'fly' | 'drive' | 'custom';

export function TravelOverrideModal({
  isOpen,
  plannedTournament,
  onClose,
  onSave,
}: TravelOverrideModalProps) {
  const { tournament, travelType, travelCost, flightPrice, driveCost, driveDistance } = plannedTournament;

  const [selectedOption, setSelectedOption] = useState<TravelOption>(travelType);
  const [customAmount, setCustomAmount] = useState<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOption(travelType);
      setCustomAmount('');
    }
  }, [isOpen, travelType]);

  if (!isOpen) return null;

  const flyPrice = flightPrice?.price ?? travelCost;
  const drivePrice = driveCost ?? travelCost;

  const handleSave = () => {
    let finalType: 'drive' | 'fly';
    let finalCost: number;

    if (selectedOption === 'custom') {
      finalType = 'fly'; // Custom defaults to fly type
      finalCost = parseInt(customAmount, 10) || 0;
    } else if (selectedOption === 'drive') {
      finalType = 'drive';
      finalCost = drivePrice;
    } else {
      finalType = 'fly';
      finalCost = flyPrice;
    }

    onSave(finalType, finalCost);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-6"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Change travel type</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tournament Name */}
        <p className="text-sm text-gray-400 mb-4">
          {tournament.name} - {tournament.startDate}
        </p>

        {/* Options */}
        <div className="space-y-3">
          {/* Fly Option */}
          <label
            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${
              selectedOption === 'fly'
                ? 'bg-blue-500/20 border-blue-500'
                : 'bg-white/5 border-transparent hover:bg-white/10'
            } border`}
          >
            <input
              type="radio"
              name="travelType"
              value="fly"
              checked={selectedOption === 'fly'}
              onChange={() => setSelectedOption('fly')}
              className="sr-only"
              aria-label="Fly"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedOption === 'fly' ? 'border-blue-500' : 'border-gray-500'
            }`}>
              {selectedOption === 'fly' && (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <div className="flex-1">
              <span className="font-medium">Fly</span>
              {flightPrice?.source === 'amadeus' && (
                <span className="text-xs text-gray-400 ml-2">(checked price)</span>
              )}
              {flightPrice?.source === 'estimated_range' && (
                <span className="text-xs text-gray-400 ml-2">(estimated)</span>
              )}
            </div>
            <span className="font-semibold text-blue-400">${flyPrice}</span>
          </label>

          {/* Drive Option */}
          <label
            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${
              selectedOption === 'drive'
                ? 'bg-green-500/20 border-green-500'
                : 'bg-white/5 border-transparent hover:bg-white/10'
            } border`}
          >
            <input
              type="radio"
              name="travelType"
              value="drive"
              checked={selectedOption === 'drive'}
              onChange={() => setSelectedOption('drive')}
              className="sr-only"
              aria-label="Drive"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedOption === 'drive' ? 'border-green-500' : 'border-gray-500'
            }`}>
              {selectedOption === 'drive' && (
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              )}
            </div>
            <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <div className="flex-1">
              <span className="font-medium">Drive</span>
              {driveDistance && (
                <span className="text-xs text-gray-400 ml-2">
                  ({Math.round(driveDistance)} mi round trip)
                </span>
              )}
            </div>
            <span className="font-semibold text-green-400">${drivePrice}</span>
          </label>

          {/* Custom Amount Option */}
          <label
            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${
              selectedOption === 'custom'
                ? 'bg-purple-500/20 border-purple-500'
                : 'bg-white/5 border-transparent hover:bg-white/10'
            } border`}
          >
            <input
              type="radio"
              name="travelType"
              value="custom"
              checked={selectedOption === 'custom'}
              onChange={() => setSelectedOption('custom')}
              className="sr-only"
              aria-label="Custom"
            />
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedOption === 'custom' ? 'border-purple-500' : 'border-gray-500'
            }`}>
              {selectedOption === 'custom' && (
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              )}
            </div>
            <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <div className="flex-1">
              <span className="font-medium">Custom amount</span>
            </div>
            {selectedOption === 'custom' && (
              <div className="flex items-center gap-1">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-right focus:outline-none focus:border-purple-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
            style={{
              border: '1px solid var(--glass-border)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
