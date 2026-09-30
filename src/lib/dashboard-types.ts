export type Contest = {
  id: string; title: string; organization: string | null; roles: string[];
  city: string | null; uf: string | null; region: string | null;
  vacancies: string | null; salary: string | null;
  sourceResult?: boolean; education?: string | null; newsImageUrl?: string | null;
  registrationStart: string | null; registrationEnd: string | null;
  status: string | null; sourceUrl: string | null; noticeUrl: string | null;
  applicationUrl: string | null; firstSeenAt: string; isDemo: boolean;
};
export type RadarEvent = { id: string; kind: string; summary: string; createdAt: string; concurso: { title: string; organization: string | null; sourceUrl: string | null } };
export type DashboardData = {
  asOf?: string;
  contests: Contest[]; events: RadarEvent[];
  stats: { total: number; newSinceLast: number; closingSoon: number; lastSuccessAt: string | null; lastRun: { status: string; startedAt: string; errorMessage: string | null; returnedCount: number; expectedCount: number | null; truncated: boolean } | null; isDemo: boolean; source: string };
};

