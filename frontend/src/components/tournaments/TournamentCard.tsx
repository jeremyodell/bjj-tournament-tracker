// frontend/src/components/tournaments/TournamentCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{tournament.name}</CardTitle>
          <Badge variant={tournament.org === 'IBJJF' ? 'default' : 'secondary'}>
            {tournament.org}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{tournament.city}{tournament.country ? `, ${tournament.country}` : ''}</p>
          <p>{formatDateRange(tournament.startDate, tournament.endDate)}</p>
          <div className="flex gap-2 pt-2">
            {tournament.gi && <Badge variant="outline">GI</Badge>}
            {tournament.nogi && <Badge variant="outline">NOGI</Badge>}
            {tournament.kids && <Badge variant="outline">KIDS</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
