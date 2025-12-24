'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Tournament } from '@/lib/types';

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (start === end) {
      return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    }

    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

  const getDaysUntil = (start: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntil = getDaysUntil(tournament.startDate);

  const getTimeLabel = () => {
    if (daysUntil < 0) return null;
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil <= 7) return `In ${daysUntil} days`;
    if (daysUntil <= 30) return `In ${Math.ceil(daysUntil / 7)} weeks`;
    return null;
  };

  const timeLabel = getTimeLabel();

  return (
    <Card className="hover:shadow-lg transition-shadow flex flex-col h-full">
      <CardHeader className="pb-2 flex-none">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          {/* Title - takes up more space on mobile */}
          <CardTitle className="text-base sm:text-lg leading-tight line-clamp-2">
            {tournament.name}
          </CardTitle>
          {/* Badge - wraps to new line on very small screens */}
          <Badge
            variant={tournament.org === 'IBJJF' ? 'default' : 'secondary'}
            className="self-start shrink-0"
          >
            {tournament.org}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-grow flex flex-col justify-between">
        <div className="space-y-3">
          {/* Location */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <svg
              className="h-4 w-4 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="line-clamp-1">
              {tournament.city}
              {tournament.country ? `, ${tournament.country}` : ''}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formatDateRange(tournament.startDate, tournament.endDate)}</span>
            {timeLabel && (
              <Badge variant="outline" className="ml-auto text-xs">
                {timeLabel}
              </Badge>
            )}
          </div>

          {/* Event type tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tournament.gi && (
              <Badge variant="outline" className="text-xs">
                GI
              </Badge>
            )}
            {tournament.nogi && (
              <Badge variant="outline" className="text-xs">
                NOGI
              </Badge>
            )}
            {tournament.kids && (
              <Badge variant="outline" className="text-xs">
                KIDS
              </Badge>
            )}
          </div>
        </div>

        {/* Registration link */}
        {tournament.registrationUrl && (
          <div className="mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <a
                href={tournament.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View Details
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
