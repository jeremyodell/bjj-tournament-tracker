'use client';

import { cn } from '@/lib/utils';

interface PresetButtonProps<T extends string | number> {
  value: T;
  label: string;
  selected: boolean;
  onClick: (value: T) => void;
  disabled?: boolean;
}

export function PresetButton<T extends string | number>({
  value,
  label,
  selected,
  onClick,
  disabled = false,
}: PresetButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0A1A]',
        selected
          ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 focus:ring-[#00F0FF]/50'
          : 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 focus:ring-white/20',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {label}
    </button>
  );
}

interface PresetButtonGroupProps<T extends string | number> {
  options: Array<{ value: T; label: string }>;
  selected: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function PresetButtonGroup<T extends string | number>({
  options,
  selected,
  onChange,
  disabled = false,
}: PresetButtonGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <PresetButton
          key={String(option.value)}
          value={option.value}
          label={option.label}
          selected={selected === option.value}
          onClick={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
