import Dashboard from "@/components/dashboard";
import { getRadarData } from "@/lib/radar-data";
import { demoResult } from "@/lib/demo";
import { daysRemaining } from "@/lib/date-utils";
export const dynamic = "force-dynamic";
export default async function Home() {
  try { return <Dashboard data={await getRadarData()} />; }
  catch {
    if (process.env.RADAR_SOURCE !== "pci") {
      const now = new Date().toISOString();
      const contests = demoResult().contests.map((c, i) => ({ id: `preview-${i}`, ...c, organization: c.organization ?? null, city: c.city ?? null, uf: c.uf ?? null, region: c.region ?? null, vacancies: c.vacancies ?? null, salary: c.salary ?? null, status: c.status ?? null, sourceUrl: c.sourceUrl ?? null, noticeUrl: c.noticeUrl ?? null, applicationUrl: c.applicationUrl ?? null, firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now, registrationStart: c.registrationStart?.toISOString() ?? null, registrationEnd: c.registrationEnd?.toISOString() ?? null, isDemo: true }));
      const closingSoon = contests.filter(c => { const days=c.registrationEnd ? daysRemaining(c.registrationEnd) : Infinity; return days >= 0 && days <= 7; }).length;
      return <Dashboard data={{ asOf: now, contests, events: [], stats: { total: contests.length, newSinceLast: 0, closingSoon, lastSuccessAt: null, lastRun: null, isDemo: true, source: "Demonstração local (sem banco)" } }} />;
    }
    return <main className="boot"><div className="boot-brand">RADAR <span>DE CONCURSOS</span></div><h1>O painel está temporariamente indisponível.</h1><p>Não conseguimos carregar os concursos. Tente novamente em alguns instantes. Você também pode consultar a <a href="https://www.pciconcursos.com.br/" target="_blank" rel="noreferrer">PCI Concursos</a>.</p></main>;
  }
}
