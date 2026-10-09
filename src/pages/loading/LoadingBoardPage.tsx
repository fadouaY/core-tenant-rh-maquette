// Tableau de chargement (RH-25) et planification des horaires par période (RH-26).
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { navigate, newId, useCompanyData, useStore } from '../../store';
import { Alert, Badge, EmptyState, Field, Modal, PageHeader, PersonCell, SelectFilter } from '../../components/ui';
import type { Employee, ID, LoadingPeriod } from '../../types';
import { addDays, eachDay, formatDate, formatDayMonth, formatRange, formatWeekdayShort, TODAY } from '../../utils/dates';
import { overlappingPeriod, periodsOf, scheduleOn, uncoveredRanges } from '../../utils/org';

const HORIZON = 28;
/** Couleurs des horaires dans la frise (attribuées dans l'ordre du paramétrage). */
const PALETTE = ['#2f5bd3', '#0f8a7a', '#8a4fd1', '#c2410c', '#0e7490', '#a16207'];

export function LoadingBoardPage() {
  const { db } = useStore();
  const data = useCompanyData();
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [selected, setSelected] = useState<ID>();
  const [editing, setEditing] = useState<{ period?: LoadingPeriod; employeeId?: ID }>();
  const days = eachDay(TODAY, addDays(TODAY, HORIZON - 1));
  const colorOf = (scheduleId?: ID) => PALETTE[Math.max(0, data.schedules.findIndex((s) => s.id === scheduleId)) % PALETTE.length];

  const rows = useMemo(() => data.employees
    .filter((e) => e.scheduleMode === 'chargement' && e.status !== 'inactif')
    .map((e) => ({ e, now: scheduleOn(db, e), gaps: uncoveredRanges(db, e, TODAY, HORIZON), next: periodsOf(db, e.id).find((p) => p.start > TODAY) }))
    .filter(({ e }) => !q || `${e.firstName} ${e.lastName} ${e.matricule}`.toLowerCase().includes(q.toLowerCase()))
    .filter(({ e }) => !departmentId || e.departmentId === departmentId)
    .filter(({ gaps }) => !onlyAlerts || gaps.length > 0)
    .sort((a, b) => a.e.lastName.localeCompare(b.e.lastName, 'fr')), [db, data, q, departmentId, onlyAlerts]);

  const unplannedNow = rows.filter((r) => r.now.unplanned).length;
  const current = data.employee(selected) ?? rows[0]?.e;

  return (
    <>
      <PageHeader eyebrow="Application RH · Temps de travail" icon={<CalendarClock size={20} strokeWidth={1.8} />}
        title="Tableau de chargement"
        subtitle={`${rows.length} employé(s) dont l’horaire est planifié par périodes · ${data.company.name}`}
        actions={<button type="button" className="btn btn-primary" disabled={rows.length === 0} onClick={() => setEditing({ employeeId: current?.id })}><Plus size={15} aria-hidden /> Planifier une période</button>}
      />

      {unplannedNow > 0 && (
        <Alert tone="warning" title={`${unplannedNow} employé(s) non planifié(s) aujourd’hui`}>
          Sans période en cours, un employé reste « Non planifié » : il ne revient jamais automatiquement à l’horaire de son département.
        </Alert>
      )}

      <div className="filters">
        <div className="filter filter-search">
          <label htmlFor="lb-q">Recherche</label>
          <div className="input-icon">
            <Search size={14} aria-hidden />
            <input id="lb-q" type="search" placeholder="Nom, matricule…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <SelectFilter label="Département" value={departmentId} onChange={setDepartmentId} options={data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))} />
        <SelectFilter label="Alertes" value={onlyAlerts ? '1' : ''} onChange={(v) => setOnlyAlerts(v === '1')} allLabel="Tous les employés"
          options={[{ value: '1', label: `Créneaux non planifiés (${HORIZON} j)` }]} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Aucun employé en tableau de chargement"
          text="Passez un employé en mode tableau de chargement depuis sa fiche (action « Passer au tableau de chargement »)."
          action={<button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('employes')}>Voir les employés</button>} />
      ) : (
        <div className="table-wrap">
          <table className="table load-table">
            <thead>
              <tr>
                <th scope="col">Employé</th>
                <th scope="col">Aujourd’hui</th>
                <th scope="col">
                  <span className="block">Frise des {HORIZON} prochains jours</span>
                  <span className="load-axis" aria-hidden>{days.filter((_, i) => i % 7 === 0).map((d) => <span key={d}>{formatDayMonth(d)}</span>)}</span>
                </th>
                <th scope="col">Alertes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, now, gaps, next }) => (
                <tr key={e.id} className={`row-click ${current?.id === e.id ? 'row-selected' : ''}`} onClick={() => setSelected(e.id)}>
                  <td><PersonCell employee={e} sub={`${data.department(e.departmentId)?.name} · depuis le ${e.loadingSince ? formatDate(e.loadingSince) : '—'}`} /></td>
                  <td>
                    {now.unplanned ? <Badge tone="danger">Non planifié</Badge>
                      : !now.period ? <><span className="person-name">Horaire du département</span><span className="block small text-muted">Jusqu’au {e.loadingSince && formatDate(addDays(e.loadingSince, -1))}</span></>
                      : <><span className="person-name">{now.period.label}</span><span className="block small text-muted">{now.schedule?.name}</span></>}
                    {next && <span className="block small text-muted">Ensuite : {formatRange(next.start, next.end)}</span>}
                  </td>
                  <td>
                    <span className="load-strip" role="img" aria-label={`Planning de ${e.firstName} ${e.lastName} sur ${HORIZON} jours`}>
                      {days.map((d) => {
                        const s = scheduleOn(db, e, d);
                        return <span key={d} className={`load-cell ${s.unplanned ? 'unplanned' : s.period ? '' : 'org'}`} style={s.period ? { background: colorOf(s.schedule?.id) } : undefined}
                          title={`${formatWeekdayShort(d)} ${formatDayMonth(d)} — ${s.unplanned ? 'Non planifié' : s.period ? `${s.period.label} (${s.schedule?.name})` : 'Horaire du département (avant la bascule)'}`} />;
                      })}
                    </span>
                  </td>
                  <td>{gaps.length === 0 ? <Badge tone="success">Couvert</Badge> : <Badge tone="warning">{gaps.length} créneau(x) non planifié(s)</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {current && current.scheduleMode === 'chargement' && (
        <PeriodsPanel employee={current} colorOf={colorOf}
          onAdd={() => setEditing({ employeeId: current.id })} onEdit={(period) => setEditing({ period })} />
      )}

      <PeriodModal state={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

function PeriodsPanel({ employee, colorOf, onAdd, onEdit }: { employee: Employee; colorOf: (id?: ID) => string; onAdd: () => void; onEdit: (p: LoadingPeriod) => void }) {
  const { db, cancelPeriod, toast } = useStore();
  const data = useCompanyData();
  const periods = periodsOf(db, employee.id).sort((a, b) => b.start.localeCompare(a.start));
  const gaps = uncoveredRanges(db, employee, TODAY, HORIZON);
  return (
    <section className="panel mt-16">
      <div className="panel-head">
        <h2 className="panel-title">Périodes de {employee.firstName} {employee.lastName}</h2>
        <div className="row-gap">
          <a className="btn btn-sm btn-ghost" href={`#/employes/${employee.id}`}>Fiche employé</a>
          <button type="button" className="btn btn-sm btn-primary" onClick={onAdd}><Plus size={14} aria-hidden /> Planifier</button>
        </div>
      </div>
      {gaps.length > 0 && <Alert tone="warning" title="Non planifié">{gaps.map((g) => formatRange(g.start, g.end)).join(' · ')}</Alert>}
      {periods.length === 0 ? <EmptyState title="Aucune période" text="Planifiez une première période pour cet employé." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Période</th><th scope="col">Horaire</th><th scope="col">Dates</th><th scope="col">État</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {periods.map((p) => {
                const past = p.end < TODAY;
                const ongoing = p.start <= TODAY && p.end >= TODAY;
                return (
                  <tr key={p.id} className={past ? 'row-archived' : ''}>
                    <td><span className="person-name">{p.label}</span>{p.reason && <span className="block small text-muted">{p.reason}</span>}</td>
                    <td><span className="legend-swatch" style={{ background: colorOf(p.scheduleId) }} aria-hidden /> {data.schedule(p.scheduleId)?.name}</td>
                    <td className="nowrap">{formatRange(p.start, p.end)}</td>
                    <td>{past ? <Badge tone="muted">Terminée</Badge> : ongoing ? <Badge tone="success">En cours</Badge> : <Badge tone="info">Planifiée</Badge>}</td>
                    <td className="actions">
                      {!past && (
                        <>
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(p)}><Pencil size={13} aria-hidden /> Modifier</button>
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { cancelPeriod(p.id); toast('Période annulée', 'info'); }}><Trash2 size={13} aria-hidden /> Annuler</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Création ou modification d'une période : horaire actif, dates, contrôle anti-chevauchement strict (RH-26). */
function PeriodModal({ state, onClose }: { state?: { period?: LoadingPeriod; employeeId?: ID }; onClose: () => void }) {
  const { db, companyId, savePeriod, toast } = useStore();
  const data = useCompanyData();
  const loadingEmployees = data.employees.filter((e) => e.scheduleMode === 'chargement' && e.status !== 'inactif');
  const schedules = data.schedules.filter((s) => !s.archived);
  const [f, setF] = useState({ employeeId: '', scheduleId: '', start: TODAY, end: addDays(TODAY, 13), label: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    const p = state.period;
    setF(p ? { employeeId: p.employeeId, scheduleId: p.scheduleId, start: p.start, end: p.end, label: p.label, reason: p.reason }
      : { employeeId: state.employeeId ?? loadingEmployees[0]?.id ?? '', scheduleId: schedules[0]?.id ?? '', start: TODAY, end: addDays(TODAY, 13), label: '', reason: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  if (!state) return null;

  const employee = data.employee(f.employeeId);
  const conflict = f.employeeId && f.start && f.end ? overlappingPeriod(db, f.employeeId, f.start, f.end, state.period?.id) : undefined;
  const errors: Record<string, string> = {};
  if (!f.employeeId) errors.employeeId = 'Choisissez un employé.';
  if (!f.scheduleId) errors.scheduleId = 'Choisissez un horaire actif.';
  if (!f.start || !f.end) errors.dates = 'Dates de début et de fin requises.';
  else if (f.end < f.start) errors.dates = 'La date de fin précède la date de début.';
  else if (employee?.loadingSince && f.start < employee.loadingSince) errors.dates = `L’employé est en tableau de chargement depuis le ${formatDate(employee.loadingSince)} seulement.`;
  else if (conflict) errors.dates = `Chevauchement avec « ${conflict.label} » (${formatRange(conflict.start, conflict.end)}).`;
  if (!f.label.trim()) errors.label = 'Intitulé requis.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    savePeriod({ id: state.period?.id ?? newId('lp'), companyId, employeeId: f.employeeId, scheduleId: f.scheduleId, start: f.start, end: f.end, label: f.label.trim(), reason: f.reason.trim() });
    toast(state.period ? 'Période modifiée' : 'Période planifiée');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={state.period ? 'Modifier la période' : 'Planifier une période'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Employé" required error={err('employeeId')} className="span-2">
          {(id) => (
            <select id={id} value={f.employeeId} disabled={!!state.period} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
              {loadingEmployees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {data.department(e.departmentId)?.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Horaire" required error={err('scheduleId')} className="span-2" hint="Seuls les horaires actifs peuvent être planifiés.">
          {(id) => (
            <select id={id} value={f.scheduleId} onChange={(e) => setF({ ...f, scheduleId: e.target.value })}>
              {schedules.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.slots.map((sl) => `${sl.start}-${sl.end}`).join(' / ')}</option>)}
            </select>
          )}
        </Field>
        <Field label="Du" required error={err('dates')}>{(id) => <input id={id} type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />}</Field>
        <Field label="Au" required>{(id) => <input id={id} type="date" value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} />}</Field>
        <Field label="Intitulé" required error={err('label')} className="span-2">{(id) => <input id={id} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Ex. : Rotation matin — semaine 42" />}</Field>
        <Field label="Motif" className="span-2">{(id) => <input id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />}</Field>
      </div>
      <p className="small text-muted mt-12">À l’échéance, s’il n’existe aucune période suivante, l’employé reste « Non planifié » : il ne revient pas automatiquement à l’horaire de son département.</p>
    </Modal>
  );
}
