import { BalancesPage } from './BalancesPage';
import { RequestsPage } from './RequestsPage';

/** Section Congés : demandes (#/conges/demandes[/id|nouvelle]) et soldes (#/conges/soldes). */
export function LeavesPage({ section, param }: { section?: string; param?: string }) {
  if (section === 'soldes') return <BalancesPage />;
  return <RequestsPage param={param} />;
}
