// frontend/src/hooks/useAthletes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAthletes, createAthlete, updateAthlete, deleteAthlete, type CreateAthleteInput } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function useAthletes() {
  const { isAuthenticated, getAccessToken } = useAuthStore();

  return useQuery({
    queryKey: ['athletes'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return fetchAthletes(token);
    },
    enabled: isAuthenticated,
  });
}

export function useAthleteMutations() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  const createMutation = useMutation({
    mutationFn: async (input: CreateAthleteInput) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return createAthlete(token, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ athleteId, input }: { athleteId: string; input: Partial<CreateAthleteInput> }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return updateAthlete(token, athleteId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (athleteId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return deleteAthlete(token, athleteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
