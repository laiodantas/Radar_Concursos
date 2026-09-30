export type NormalizedContest = {
  sourceKey: string; sourceUrl?: string; title: string; organization?: string; roles: string[];
  city?: string; uf?: string; region?: string; vacancies?: string; salary?: string;
  registrationStart?: Date; registrationEnd?: Date; status?: string; noticeUrl?: string;
  applicationUrl?: string; contentHash: string; raw: unknown;
};
/**
 * `expectedCount` é o total que a fonte anunciou no envelope (`meta.total`). Sem ele,
 * `complete` apenas indica que nenhuma chamada devolveu menos do que a fonte declarou.
 */
export type SourceResult = { contests: NormalizedContest[]; source: "pci" | "demo"; complete: boolean; notes: string[]; expectedCount?: number };
