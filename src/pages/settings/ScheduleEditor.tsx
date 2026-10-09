// Éditeur de scénario d'horaire (RH-21) : libellé, période d'application, volume, créneaux, départements concernés,
// jours travaillés par département et jours non travaillés exceptionnels (sans doublon avec les jours fériés, RH-20).
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, CalendarOff, Clock, Coffee, FileText, Moon, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, Drawer, Field } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { ExceptionalOffDay, ID, Schedule, TimeSlot } from '../../types';
import { TODAY } from '../../utils/dates';
import { toMinutes } from '../../utils/hours';
import { holidayOn } from '../../utils/org';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const YEAR_END = `${TODAY.slice(0, 4)}-12-31`;

/** Durée d'un créneau en minutes ; un créneau de nuit (fin avant début) traverse minuit. */
const slotMinutes = (s: TimeSlot) => { const d = toMinutes(s.end) - toMinutes(s.start); return d > 0 ? d : d + 24 * 60; };

export function ScheduleEditor({ schedule, onClose }: { schedule?: Schedule; onClose: () => void }) {
  const { db, companyId, saveSchedule, toast } = useStore();
  const data = useCompanyData();
  const [s, setS] = useState<Schedule>(() => blank(companyId));
  const [deps, setDeps] = useState<ID[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSubmitted(false);
    setS(schedule ? { ...schedule, departmentWorkDays: { ...schedule.departmentWorkDays }, exceptionalOffDays: [...(schedule.exceptionalOffDays ?? [])] } : blank(companyId));
    setDeps(schedule ? db.departments.filter((d) => d.scheduleId === schedule.id && !d.archived).map((d) => d.id) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, companyId]);

  // Départements et sous-départements actifs, dans l'ordre de l'arborescence.
  const options = data.activeDepartments.flatMap((d) => [d, ...data.subDepartments(d.id).filter((x) => !x.archived)]);
  const label = (id?: ID) => { const d = data.department(id); const p = data.department(d?.parentId); return p ? `${p.name} › ${d?.name}` : d?.name ?? ''; };
  const available = options.filter((d) => !deps.includes(d.id));

  // Impact : employés en mode organisationnel dont l'horaire viendrait de ce scénario.
  const impacted = data.employees.filter((e) => e.status !== 'inactif' && e.scheduleMode === 'organisation' && (
    (e.subDepartmentId && deps.includes(e.subDepartmentId)) ||
    (deps.includes(e.departmentId) && (!e.subDepartmentId || !data.department(e.subDepartmentId)?.scheduleId || data.department(e.subDepartmentId)?.scheduleId === s.id))
  ));
  const removed = schedule ? db.departments.filter((d) => d.scheduleId === schedule.id && !d.archived && !deps.includes(d.id)) : [];

  const set = <K extends keyof Schedule>(k: K, v: Schedule[K]) => setS((x) => ({ ...x, [k]: v }));
  const setSlot = (i: number, patch: Partial<TimeSlot>) => set('slots', s.slots.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const daysOf = (id?: ID) => (id ? s.departmentWorkDays?.[id] : undefined) ?? s.workDays;
  const toggleDay = (id: ID | undefined, day: number) => {
    const current = daysOf(id);
    const next = current.includes(day) ? current.filter((x) => x !== day) : [...current, day].sort();
    if (!id) set('workDays', next);
    else set('departmentWorkDays', { ...s.departmentWorkDays, [id]: next });
  };
  const addDep = (id: ID) => { if (id) { setDeps((l) => [...l, id]); set('departmentWorkDays', { ...s.departmentWorkDays, [id]: daysOf(id) }); } };
  const removeDep = (id: ID) => {
    setDeps((l) => l.filter((x) => x !== id));
    const { [id]: _, ...rest } = s.departmentWorkDays ?? {};
    setS((x) => ({ ...x, departmentWorkDays: rest, exceptionalOffDays: (x.exceptionalOffDays ?? []).filter((o) => o.departmentId !== id) }));
  };
  const setOff = (i: number, patch: Partial<ExceptionalOffDay>) => set('exceptionalOffDays', (s.exceptionalOffDays ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const computedHours = Math.round(s.slots.reduce((sum, x) => sum + slotMinutes(x), 0) / 60 * s.workDays.length * 10) / 10;

  // Validation.
  const errors: Record<string, string> = {};
  if (!s.name.trim()) errors.name = 'Libellé requis.';
  else if (data.schedules.some((x) => x.id !== s.id && x.name.trim().toLowerCase() === s.name.trim().toLowerCase())) errors.name = 'Un scénario porte déjà ce libellé.';
  if (!s.startDate || !s.endDate) errors.period = 'Période requise.';
  else if (s.endDate < s.startDate) errors.period = 'La fin précède le début.';
  if (!(Number(s.weeklyHours) > 0)) errors.weeklyHours = 'Volume strictement positif.';
  if (s.slots.length === 0) errors.slots = 'Ajoutez au moins un créneau.';
  else if (s.slots.some((x) => !x.label.trim() || !x.start || !x.end || x.start === x.end)) errors.slots = 'Chaque créneau a un libellé, un début et une fin différents.';
  const deptDays = deps.length ? deps.map((id) => daysOf(id)) : [s.workDays];
  if (deptDays.some((d) => d.length === 0)) errors.days = 'Chaque département doit avoir au moins un jour travaillé.';
  const offErrors = (s.exceptionalOffDays ?? []).map((o, i, all) => {
    if (!o.date) return 'Date requise.';
    if (s.startDate && s.endDate && (o.date < s.startDate || o.date > s.endDate)) return 'Hors de la période d’application.';
    const holiday = holidayOn(db, companyId, o.date);
    if (holiday) return `Coïncide avec le jour férié « ${holiday.name} » (déjà chômé, RH-20).`;
    if (all.some((x, j) => j < i && x.date === o.date && (x.departmentId ?? '') === (o.departmentId ?? ''))) return 'Jour déjà saisi.';
    if (!o.label.trim()) return 'Motif requis.';
    return '';
  });
  if (offErrors.some(Boolean)) errors.off = 'Corrigez les jours exceptionnels.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    // Jours par défaut : ceux du premier département concerné (utilisés aussi par le tableau de chargement).
    const workDays = deps.length ? daysOf(deps[0]) : s.workDays;
    const departmentWorkDays = Object.fromEntries(deps.map((id) => [id, daysOf(id)]));
    const saved: Schedule = { ...s, id: s.id || newId('s'), name: s.name.trim(), weeklyHours: Number(s.weeklyHours), workDays, departmentWorkDays,
      slots: s.slots.map((x) => ({ ...x, label: x.label.trim() })), exceptionalOffDays: (s.exceptionalOffDays ?? []).map((o) => ({ ...o, label: o.label.trim() })) };
    saveSchedule(saved, deps);
    toast(schedule ? `Scénario « ${saved.name} » mis à jour` : `Scénario « ${saved.name} » créé`);
    onClose();
  };

  const fmtHours = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
  const fmtDuration = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
  const offs = s.exceptionalOffDays ?? [];

  return (
    <Drawer open onClose={onClose} wide
      title={schedule ? `Modifier « ${schedule.name} »` : 'Nouveau scénario d’horaire'}
      subtitle="Scénario d’horaire (RH-21) : créneaux, départements concernés, jours travaillés et jours exceptionnels."
      footer={<>
        {submitted && Object.keys(errors).length > 0
          ? <span className="footer-note text-danger">{Object.keys(errors).length} point(s) à corriger</span>
          : <span className="footer-note">{deps.length ? `Appliqué à ${deps.length} département(s) · ${impacted.length} employé(s)` : 'Disponible pour le tableau de chargement'}</span>}
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button type="button" className="btn btn-primary" onClick={save}><Save size={15} aria-hidden /> {schedule ? 'Enregistrer' : 'Créer le scénario'}</button>
      </>}>
      <div className="fstack">
        {/* Synthèse du scénario, mise à jour en direct */}
        <dl className="fkpis" aria-label="Synthèse du scénario">
          <div><dt>Volume calculé</dt><dd>{fmtHours(computedHours)}<span>/ semaine</span></dd></div>
          <div><dt>Créneaux</dt><dd>{s.slots.length}<span>par jour</span></dd></div>
          <div><dt>Départements</dt><dd>{deps.length}<span>concerné{deps.length > 1 ? 's' : ''}</span></dd></div>
          <div className={impacted.length ? 'accent' : ''}><dt>Impact</dt><dd>{impacted.length}<span>employé{impacted.length > 1 ? 's' : ''}</span></dd></div>
        </dl>

        <FormCard icon={<FileText size={16} />} title="Informations générales" subtitle="Le libellé est unique dans la société.">
          <div className="sched-head">
            <Field label="Libellé" required error={err('name')}>{(id) => <input id={id} value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. : Scénario Ramadan" />}</Field>
            <Field label="Période d’application" required error={err('period')}>
              {(id) => (
                <span className="sched-period">
                  <input id={id} type="date" value={s.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} aria-label="Début de la période" />
                  <ArrowRight size={14} aria-hidden />
                  <input type="date" value={s.endDate ?? ''} min={s.startDate} onChange={(e) => set('endDate', e.target.value)} aria-label="Fin de la période" />
                </span>
              )}
            </Field>
            <Field label="Volume hebdomadaire" required error={err('weeklyHours')}
              hint={Number(s.weeklyHours) > 0 && Math.abs(Number(s.weeklyHours) - computedHours) >= 0.5 ? `Écart avec le calcul : ${fmtHours(computedHours)}` : 'Conforme aux créneaux'}>
              {(id) => (
                <span className="input-suffix">
                  <input id={id} type="number" min={0} step={0.5} value={s.weeklyHours ?? ''} onChange={(e) => set('weeklyHours', e.target.value === '' ? undefined : Number(e.target.value))} />
                  <span aria-hidden>h</span>
                </span>
              )}
            </Field>
          </div>
        </FormCard>

        <div className="sched-grid">
          <FormCard icon={<Clock size={16} />} title="Créneaux horaires" subtitle="Plages de travail de la journée ; une fin avant le début traverse minuit."
            actions={<button type="button" className="btn btn-sm btn-ghost" onClick={() => set('slots', [...s.slots, { label: '', start: '14:00', end: '18:00' }])}><Plus size={14} aria-hidden /> Créneau</button>}>
            <SlotTimeline slots={s.slots} />
            <ol className="sched-slots">
              {s.slots.map((x, i) => {
                const night = !!x.start && !!x.end && toMinutes(x.end) < toMinutes(x.start);
                const valid = !!x.start && !!x.end && x.start !== x.end;
                const next = s.slots[i + 1];
                const pause = next && valid && !night && next.start && toMinutes(next.start) > toMinutes(x.end) ? toMinutes(next.start) - toMinutes(x.end) : 0;
                return (
                  <li key={i}>
                    <div className={`slot-card ${submitted && (!x.label.trim() || !valid) ? 'invalid' : ''}`}>
                      <div className="slot-top">
                        <span className="slot-index" aria-hidden>{i + 1}</span>
                        <input className="fx-input slot-label" aria-label={`Libellé du créneau ${i + 1}`} value={x.label} onChange={(e) => setSlot(i, { label: e.target.value })} placeholder="Libellé — ex. : Matin" />
                        <span className={`slot-duration ${night ? 'night' : ''}`} title={night ? 'Poste de nuit : traverse minuit' : undefined}>
                          {night && <Moon size={11} aria-hidden />}{valid ? fmtDuration(slotMinutes(x)) : '—'}
                        </span>
                        <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" disabled={s.slots.length === 1} onClick={() => set('slots', s.slots.filter((_, j) => j !== i))} aria-label={`Supprimer le créneau ${i + 1}`}><Trash2 size={14} /></button>
                      </div>
                      <div className="time-range">
                        <label><span>De</span><input type="time" aria-label={`Début du créneau ${i + 1}`} value={x.start} onChange={(e) => setSlot(i, { start: e.target.value })} /></label>
                        <ArrowRight size={14} aria-hidden />
                        <label><span>À</span><input type="time" aria-label={`Fin du créneau ${i + 1}`} value={x.end} onChange={(e) => setSlot(i, { end: e.target.value })} /></label>
                      </div>
                    </div>
                    {pause > 0 && <p className="slot-pause"><Coffee size={12} aria-hidden /> Pause de {fmtDuration(pause)}</p>}
                  </li>
                );
              })}
            </ol>
            {err('slots') && <p className="field-error">{err('slots')}</p>}
          </FormCard>

          <FormCard icon={<Building2 size={16} />} title="Départements concernés" subtitle="Ils utilisent ce scénario comme horaire organisationnel.">
            {deps.length === 0 ? (
              <p className="fempty">Aucun département : le scénario reste disponible pour le tableau de chargement.</p>
            ) : (
              <ul className="perm-chips sched-chips">
                {deps.map((id) => (
                  <li key={id} className="perm-chip">{label(id)}<button type="button" onClick={() => removeDep(id)} aria-label={`Retirer ${label(id)}`}><X size={12} /></button></li>
                ))}
              </ul>
            )}
            {available.length > 0 && (
              <select className="fx-input fx-select sched-add" value="" onChange={(e) => addDep(e.target.value)} aria-label="Ajouter un département">
                <option value="">+ Ajouter un département…</option>
                {available.map((d) => <option key={d.id} value={d.id}>{label(d.id)}{d.scheduleId ? ` (remplace « ${data.schedule(d.scheduleId)?.name} »)` : ''}</option>)}
              </select>
            )}
            <p className="sched-impact"><Users size={14} aria-hidden /> <span><strong>{impacted.length} employé{impacted.length > 1 ? 's' : ''}</strong> en horaire organisationnel concerné{impacted.length > 1 ? 's' : ''} dans ce périmètre.</span></p>
            {removed.length > 0 && <Alert tone="warning">{removed.map((d) => d.name).join(', ')} n’aura plus d’horaire organisationnel{removed.some((d) => !d.parentId) ? ' : affectez-lui un autre scénario' : ' (hérite de son département)'}.</Alert>}
          </FormCard>
        </div>

        <FormCard icon={<CalendarDays size={16} />} title="Jours travaillés" subtitle="Cliquez sur un jour pour basculer entre travaillé et repos, département par département.">
          <div className="table-wrap sched-days">
            <table className="table">
              <thead><tr><th scope="col">Département</th>{DAYS.map((d) => <th key={d} scope="col" className="sched-day-col">{d}</th>)}<th scope="col" className="num">Jours</th></tr></thead>
              <tbody>
                {(deps.length ? deps : [undefined]).map((id) => (
                  <tr key={id ?? 'default'}>
                    <td className="sched-day-dept">{id ? label(id) : <span className="text-muted">Jours par défaut</span>}</td>
                    {DAYS.map((d, i) => {
                      const on = daysOf(id).includes(i + 1);
                      return (
                        <td key={d} className="sched-day-col">
                          <button type="button" className={`day-toggle ${on ? 'on' : 'off'}`} aria-pressed={on} onClick={() => toggleDay(id, i + 1)}
                            aria-label={`${id ? label(id) : 'Par défaut'}, ${d} : ${on ? 'travaillé' : 'repos'}`}>
                            {on ? 'Travaillé' : 'Repos'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="num"><strong>{daysOf(id).length}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err('days') && <p className="field-error">{err('days')}</p>}
        </FormCard>

        <FormCard icon={<CalendarOff size={16} />} title="Jours non travaillés exceptionnels"
          subtitle="Fermetures propres à ce scénario. Un jour férié est déjà chômé : il ne peut pas être ressaisi ici (RH-20)."
          actions={<button type="button" className="btn btn-sm btn-ghost" onClick={() => set('exceptionalOffDays', [...offs, { id: newId('x'), date: '', label: '' }])}><Plus size={14} aria-hidden /> Jour exceptionnel</button>}>
          {offs.length === 0 ? <p className="fempty">Aucun jour non travaillé exceptionnel configuré.</p> : (
            <ul className="sched-offs">
              {offs.map((o, i) => (
                <li key={o.id} className={submitted && offErrors[i] ? 'invalid' : ''}>
                  <div className="sched-off-row">
                    <input className="fx-input" type="date" aria-label={`Date du jour exceptionnel ${i + 1}`} value={o.date} min={s.startDate} max={s.endDate} onChange={(e) => setOff(i, { date: e.target.value })} />
                    <input className="fx-input" aria-label={`Motif du jour exceptionnel ${i + 1}`} value={o.label} onChange={(e) => setOff(i, { label: e.target.value })} placeholder="Motif — ex. : maintenance annuelle" />
                    <select className="fx-input fx-select" aria-label={`Département du jour exceptionnel ${i + 1}`} value={o.departmentId ?? ''} onChange={(e) => setOff(i, { departmentId: e.target.value || undefined })}>
                      <option value="">Tous les départements du scénario</option>
                      {deps.map((id) => <option key={id} value={id}>{label(id)}</option>)}
                    </select>
                    <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => set('exceptionalOffDays', offs.filter((_, j) => j !== i))} aria-label={`Supprimer le jour exceptionnel ${i + 1}`}><Trash2 size={14} /></button>
                  </div>
                  {submitted && offErrors[i] && <p className="field-error">{offErrors[i]}</p>}
                </li>
              ))}
            </ul>
          )}
        </FormCard>
      </div>
    </Drawer>
  );
}

/** Frise de 24 h : chaque créneau y est placé ; un poste de nuit est coupé à minuit et reprend le lendemain. */
function SlotTimeline({ slots }: { slots: TimeSlot[] }) {
  const pct = (min: number) => `${(min / (24 * 60)) * 100}%`;
  const segments = slots.flatMap((x, i) => {
    if (!x.start || !x.end || x.start === x.end) return [];
    const a = toMinutes(x.start); const b = toMinutes(x.end);
    return b > a ? [{ i, a, b, night: false, label: x.label }] : [{ i, a, b: 24 * 60, night: true, label: x.label }, { i, a: 0, b, night: true, label: x.label }];
  });
  return (
    <div className="slot-timeline" aria-hidden>
      <div className="slot-track">
        {segments.map((g, k) => (
          <span key={k} className={`slot-seg ${g.night ? 'night' : ''}`} style={{ left: pct(g.a), width: pct(g.b - g.a) }} title={g.label}>{g.i + 1}</span>
        ))}
      </div>
      <div className="slot-scale">{[0, 6, 12, 18, 24].map((h) => <span key={h} style={{ left: pct(h * 60) }}>{h} h</span>)}</div>
    </div>
  );
}

function blank(companyId: ID): Schedule {
  return {
    id: '', companyId, name: '', workDays: [1, 2, 3, 4, 5], startDate: TODAY, endDate: YEAR_END, weeklyHours: 40,
    slots: [{ label: 'Matin', start: '08:30', end: '12:30' }, { label: 'Après-midi', start: '13:30', end: '17:00' }],
    departmentWorkDays: {}, exceptionalOffDays: [],
  };
}
