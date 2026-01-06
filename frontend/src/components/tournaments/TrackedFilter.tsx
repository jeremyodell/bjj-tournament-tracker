'use client';

type TrackedFilterValue = 'all' | 'tracked' | 'not-tracked';

interface TrackedFilterProps {
  value: TrackedFilterValue;
  onChange: (value: TrackedFilterValue) => void;
}

export function TrackedFilter({ value, onChange }: TrackedFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Show:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TrackedFilterValue)}
        className="px-3 py-1.5 rounded-md bg-black/60 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/50 hover:bg-black/80 transition-colors"
        style={{ colorScheme: 'dark' }}
      >
        <option value="all" className="bg-black text-white">All Tournaments</option>
        <option value="tracked" className="bg-black text-white">Tracked Only</option>
        <option value="not-tracked" className="bg-black text-white">Not Tracked</option>
      </select>
    </div>
  );
}

export type { TrackedFilterValue };
