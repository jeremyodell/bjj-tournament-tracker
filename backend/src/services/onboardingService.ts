import { createAthlete, type CreateAthleteInput } from '../db/athleteQueries.js';
import { createGymSubmission } from '../db/gymSubmissionQueries.js';
import { ValidationError } from '../shared/errors.js';
import type { AthleteItem } from '../db/types.js';

export interface OnboardingAthleteData {
  name: string;
  birthdate: string; // YYYY-MM-DD format
  gender: 'Male' | 'Female';
  beltRank: string;
  weight: number;
  masterGymId?: string; // If user selected an existing gym
  customGymName?: string; // If user selected "Other" gym option
}

export interface OnboardingData {
  role: 'athlete' | 'parent';
  athletes: OnboardingAthleteData[];
}

export interface OnboardingResult {
  athletes: AthleteItem[];
  gymSubmissionIds: string[];
}

/**
 * Process onboarding data: create athletes and gym submissions
 */
export async function processOnboarding(
  userId: string,
  data: OnboardingData
): Promise<OnboardingResult> {
  // Validate data
  if (!data.athletes || data.athletes.length === 0) {
    throw new ValidationError('At least one athlete is required');
  }

  if (data.role === 'athlete' && data.athletes.length > 1) {
    throw new ValidationError('Athletes can only create one profile');
  }

  if (data.role === 'parent' && data.athletes.length > 4) {
    throw new ValidationError('Parents can create up to 4 athlete profiles');
  }

  // Create athletes first
  const createdAthletes: AthleteItem[] = [];

  for (const athleteData of data.athletes) {
    // Extract birth year from birthdate
    const birthYear = new Date(athleteData.birthdate).getFullYear();

    const athleteInput: CreateAthleteInput = {
      name: athleteData.name,
      gender: athleteData.gender,
      beltRank: athleteData.beltRank,
      birthYear,
      weight: athleteData.weight,
      masterGymId: athleteData.masterGymId || undefined,
    };

    const athlete = await createAthlete(userId, athleteInput);
    createdAthletes.push(athlete);
  }

  // Group athletes by custom gym name and create gym submissions
  const gymToAthletes = new Map<string, string[]>();
  for (let i = 0; i < data.athletes.length; i++) {
    const athleteData = data.athletes[i];
    if (athleteData.customGymName) {
      if (!gymToAthletes.has(athleteData.customGymName)) {
        gymToAthletes.set(athleteData.customGymName, []);
      }
      gymToAthletes.get(athleteData.customGymName)!.push(createdAthletes[i].athleteId);
    }
  }

  // Create gym submissions with athlete IDs
  const gymSubmissionIds: string[] = [];
  for (const [customGymName, athleteIds] of gymToAthletes.entries()) {
    const submission = await createGymSubmission({
      customGymName,
      submittedByUserId: userId,
      athleteIds,
    });
    gymSubmissionIds.push(submission.id);
  }

  return {
    athletes: createdAthletes,
    gymSubmissionIds,
  };
}
