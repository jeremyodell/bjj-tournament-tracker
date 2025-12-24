'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function TournamentCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          {/* Title skeleton */}
          <Skeleton className="h-6 w-3/4" />
          {/* Badge skeleton */}
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Location skeleton */}
          <Skeleton className="h-4 w-1/2" />
          {/* Date skeleton */}
          <Skeleton className="h-4 w-2/5" />
          {/* Tags skeleton */}
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-10 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TournamentGridSkeletonProps {
  count?: number;
}

export function TournamentGridSkeleton({ count = 6 }: TournamentGridSkeletonProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(count)].map((_, i) => (
        <TournamentCardSkeleton key={i} />
      ))}
    </div>
  );
}
