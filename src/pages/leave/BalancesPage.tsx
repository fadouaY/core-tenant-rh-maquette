import { useMemo, useState } from 'react';
import { Scale, Search } from 'lucide-react';
import { navigate, useCompanyData, useStore } from '../../store';
import { EmptyState, PageHeader, PersonCell, SelectFilter } from '../../components/ui';
import { formatDays } from '../../utils/dates';
import { balanceTypes, getAnnualBalance, getBalance } from '../../utils/leave';
import { dayHours, formatDaysHours, scheduleOf } from '../../utils/hours';

/** Vue d'ensemble des soldes de congé (valeurs de démonstration). */
export function BalancesPage() {
  const { db } = useStore();
  const data = useCompanyData();
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const { ref, own: types } = balanceTypes(db, data.company.id);

  const list = useMemo(() => data.activePeople
    .filter((p) => !q || `${p.firstName} ${p.lastName} ${p.matricule}`.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => !departmentId || p.departmentId === departmentId)
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr')), [data, q, departmentId]);

  return (
    <>
      <PageHeader eyebrow="Application RH · Congés" icon={<Scale size={20} strokeWidth={1.8} />} title="Soldes de congé" subtitle={`Solde annuel = quota « ${ref?.name ?? '—'} » + report − tous les congés imputés. Les types hors solde à plafond propre ont leur colonne. Valeurs de démonstration.`} />
      <div className="filters">
        <div className="filter filter-search">
          <label htmlFor="bal-q">Recherche</label>
          <div className="input-icon"><Search size={14} aria-hidden /><input id="bal-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, matricule…" /></div>
        </div>
        <SelectFilter label="Département" value={departmentId} onChange={setDepartmentId} options={data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))} />
      </div>
      <p className="result-count">{list.length} employé{list.length > 1 ? 's' : ''}</p>
      {list.length === 0 ? <EmptyState title="Aucun employé" text="Modifiez les filtres." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Employé</th>
                <th scope="col">Horaire</th>
                <th scope="col" className="num">Solde annuel</th>
                {types.map((t) => <th key={t.id} scope="col" className="num">{t.name} <span className="th-sub">plafond</span></th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="row-click" onClick={() => navigate(`employes/${p.id}`)}>
                  <td><PersonCell employee={p} link sub={p.departmentName} /></td>
                  <td>{data.schedule(data.profile(p.id)?.scheduleId)?.name}</td>
                  {(() => { const b = getAnnualBalance(db, p.id); const ph = dayHours(scheduleOf(db, p.id)); return (
                    <td className="num"><strong className={b.available < 0 ? 'text-danger' : 'text-primary'}>{formatDaysHours(b.available, ph)}</strong>
                      <span className="block small text-muted">sur {formatDays(b.acquired)}{b.pending ? ` · ${formatDaysHours(b.pending, ph)} en attente` : ''}</span></td>
                  ); })()}
                  {types.map((t) => {
                    const b = getBalance(db, p.id, t.id);
                    return (
                      <td key={t.id} className="num">
                        <strong className={b.available < 0 ? 'text-danger' : ''}>{formatDays(b.available)}</strong>
                        <span className="block small text-muted">sur {formatDays(b.acquired)}{b.pending ? ` · ${formatDays(b.pending)} en attente` : ''}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
