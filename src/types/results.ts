export interface ResultsSubmission {
  id: string;
  locationId: string;
  routeId: string | null;
  teamName: string;
  answers: Record<string, unknown>;
  submittedAt: number;
}
