// Éditeur de scénario d'horaire (RH-21) : libellé, période d'application, volume, créneaux, départements concernés,
// jours travaillés par département et jours non travaillés exceptionnels (sans doublon avec les jours fériés, RH-20).
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, CalendarDays, CalendarOff, Clock, Coffee, FileText, Moon, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, Drawer, Field } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { ExceptionalOffDay, ID, Schedule, TimeSlot } from '../../types';
import { TODAY } from '../../utils/dates';
import { dayHours, scheduleDays, slotDays, slotMinutes, toMinutes, weeklyMinutes } from '../../utils/hours';
import { holidayOn } from '../../utils/org';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const YEAR_END = `${TODAY.slice(0, 4)}-12-31`;

export function ScheduleEditor({ schedule, onClose }: { schedule?: Schedule; onClose: () => void }) {
  const { db, companyId, saveSchedule, toast } = useStore();
  const data = useCompanyData();
  const [s, setS] = useState<Schedule>(() => blank(companyId));
  const [deps, setDeps] = useState<ID[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSubmitted(false);
    // Chaque créneau porte ses jours ; un ancien scénario les reprend de ses jours travaillés.
    setS(schedule ? { ...schedule, slots: schedule.slots.map((x) => ({ ...x, days: slotDays(schedule, x) })), departmentWorkDays: {}, exceptionalOffDays: [...(schedule.exceptionalOffDays ?? [])] } : blank(companyId));
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
  const addDep = (id: ID) => { if (id) setDeps((l) => [...l, id]); };
  // Journées types : créneaux regroupés par jeu de jours identique ; un jour n'appartient qu'à une journée type.
  const groups = (() => {
    const map = new Map<string, { key: string; days: number[]; items: { slot: TimeSlot; index: number }[] }>();
    s.slots.forEach((slot, index) => {
      const days = [...(slot.days ?? [])].sort();
      const key = days.join(',') || `vide-${index}`;
      if (!map.has(key)) map.set(key, { key, days, items: [] });
      map.get(key)!.items.push({ slot, index });
    });
    return [...map.values()].sort((a, b) => (a.days[0] ?? 9) - (b.days[0] ?? 9));
  })();
  const usedDays = new Set(groups.flatMap((g) => g.days));
  const freeDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => !usedDays.has(d));
  const daysLabel = (days: number[]) => {
    const d = [...days].sort();
    return d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1] + 1) ? `${DAYS[d[0] - 1]}–${DAYS[d[d.length - 1] - 1]}` : d.map((x) => DAYS[x - 1]).join(', ');
  };
  const setGroupDays = (key: string, days: number[]) =>
    set('slots', s.slots.map((x) => ((x.days ?? []).slice().sort().join(',') === key ? { ...x, days } : x)));
  const toggleGroupDay = (key: string, day: number) => {
    const g = groups.find((x) => x.key === key);
    if (!g) return;
    const days = g.days.includes(day) ? g.days.filter((x) => x !== day) : [...g.days, day].sort();
    if (days.length === 0) { toast('Une journée type garde au moins un jour : supprimez-la pour libérer ce jour.', 'info'); return; }
    setGroupDays(key, days);
  };
  const addGroup = () => {
    if (!freeDays.length) return;
    set('slots', [...s.slots, { label: 'Matin', start: '08:00', end: '12:00', days: [freeDays[0]] }]);
  };
  const addSlot = (g: { days: number[]; items: { slot: TimeSlot }[] }) => {
    const last = g.items[g.items.length - 1]?.slot;
    const start = last?.end && toMinutes(last.end) < 22 * 60 ? last.end : '14:00';
    const end = `${String(Math.min(23, Math.floor(toMinutes(start) / 60) + 4)).padStart(2, '0')}:${start.slice(3)}`;
    set('slots', [...s.slots, { label: '', start, end, days: [...g.days] }]);
  };
  const removeGroup = (key: string) => set('slots', s.slots.filter((x) => (x.days ?? []).slice().sort().join(',') !== key));
  // Contrôles par journée type : au moins un créneau, sans chevauchement de créneaux le même jour.
  const groupErrors = groups.map((g) => {
    const day = g.items.map((x) => x.slot).filter((x) => x.start && x.end && x.start !== x.end && toMinutes(x.end) > toMinutes(x.start))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    return day.some((x, i) => i > 0 && toMinutes(x.start) < toMinutes(day[i - 1].end)) ? 'Deux créneaux se chevauchent dans cette journée type.' : '';
  });
  const removeDep = (id: ID) => {
    setDeps((l) => l.filter((x) => x !== id));
    setS((x) => ({ ...x, exceptionalOffDays: (x.exceptionalOffDays ?? []).filter((o) => o.departmentId !== id) }));
  };
  const setOff = (i: number, patch: Partial<ExceptionalOffDay>) => set('exceptionalOffDays', (s.exceptionalOffDays ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Volume calculé : chaque créneau compte sur ses propres jours ; jours travaillés = jours couverts par un créneau.
  const computedHours = Math.round(weeklyMinutes(s) / 6) / 10;
  const workDays = scheduleDays(s);
  const over = Number(s.weeklyHours) > 0 && computedHours > Number(s.weeklyHours) + 0.01;

  // Validation.
  const errors: Record<string, string> = {};
  if (!s.name.trim()) errors.name = 'Libellé requis.';
  else if (data.schedules.some((x) => x.id !== s.id && x.name.trim().toLowerCase() === s.name.trim().toLowerCase())) errors.name = 'Un scénario porte déjà ce libellé.';
  if (!s.startDate || !s.endDate) errors.period = 'Période requise.';
  else if (s.endDate < s.startDate) errors.period = 'La fin précède le début.';
  if (!(Number(s.weeklyHours) > 0)) errors.weeklyHours = 'Volume strictement positif.';
  if (over && !(s.volumeJustification ?? '').trim()) errors.justification = 'Justifiez le dépassement du volume hebdomadaire.';
  if (s.slots.length === 0) errors.slots = 'Ajoutez au moins un créneau.';
  else if (s.slots.some((x) => !x.label.trim() || !x.start || !x.end || x.start === x.end)) errors.slots = 'Chaque créneau a un libellé, un début et une fin différents.';
  if (s.slots.some((x) => !x.days?.length)) errors.days = 'Chaque créneau doit s’appliquer à au moins un jour.';
  if (groupErrors.some(Boolean)) errors.groups = 'Corrigez les journées types.';
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
    // Jours travaillés déduits des créneaux, communs à tous les départements concernés.
    const departmentWorkDays = {};
    const saved: Schedule = { ...s, id: s.id || newId('s'), name: s.name.trim(), weeklyHours: Number(s.weeklyHours), workDays, departmentWorkDays,
      volumeJustification: over ? s.volumeJustification?.trim() : undefined,
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
        <dl className="fkpis cols-3" aria-label="Synthèse du scénario">
          <div><dt>Jours travaillés</dt><dd>{workDays.length}<span>{s.slots.length} créneau{s.slots.length > 1 ? 'x' : ''}</span></dd></div>
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
              hint={over ? `Créneaux : ${fmtHours(computedHours)} — dépassement` : Number(s.weeklyHours) > 0 && computedHours < Number(s.weeklyHours) - 0.4 ? `Créneaux : ${fmtHours(computedHours)} (sous le volume)` : 'Conforme aux créneaux'}>
              {(id) => (
                <span className="input-suffix">
                  <input id={id} type="number" min={0} step={0.5} value={s.weeklyHours ?? ''} onChange={(e) => set('weeklyHours', e.target.value === '' ? undefined : Number(e.target.value))} />
                  <span aria-hidden>h</span>
                </span>
              )}
            </Field>
          </div>
        </FormCard>

        <FormCard icon={<Clock size={16} />} title="Journées types et créneaux"
          subtitle="Chaque journée type a ses jours et ses créneaux (ex. Lun–Jeu, puis Ven, puis Sam). Un jour sans journée type est un jour de repos."
          actions={<button type="button" className="btn btn-sm btn-ghost" disabled={freeDays.length === 0} onClick={addGroup} title={freeDays.length ? undefined : 'Tous les jours ont déjà une journée type.'}><Plus size={14} aria-hidden /> Journée type</button>}>
          {/* Comparaison du volume déclaré et des heures accumulées par les créneaux, mise à jour en direct */}
          {(() => {
            const declared = Number(s.weeklyHours) || 0;
            const gap = Math.round((computedHours - declared) * 10) / 10;
            const tone = !declared ? 'none' : Math.abs(gap) < 0.05 ? 'ok' : gap > 0 ? 'over' : 'under';
            const max = Math.max(declared, computedHours, 1);
            return (
              <p className={`vol-line ${tone}`} aria-live="polite">
                <span>Déclaré <strong>{fmtHours(declared)}</strong></span>
                <span aria-hidden>·</span>
                <span>Créneaux <strong>{fmtHours(computedHours)}</strong></span>
                <span aria-hidden>·</span>
                <span className="vol-line-gap">{tone === 'ok' ? 'Conforme' : <>Écart <strong>{gap > 0 ? '+' : ''}{fmtHours(gap)}</strong></>}</span>
                <span className="vol-line-bar" aria-hidden><span style={{ width: `${Math.min(100, (computedHours / max) * 100)}%` }} /><i style={{ left: `${(declared / max) * 100}%` }} /></span>
              </p>
            );
          })()}
          {over && (
            <div className={`sched-over ${err('justification') ? 'invalid' : ''}`}>
              <p><AlertTriangle size={14} aria-hidden /> Les créneaux totalisent <strong>{fmtHours(computedHours)}</strong> par semaine, soit <strong>{fmtHours(computedHours - Number(s.weeklyHours))}</strong> de plus que le volume déclaré ({fmtHours(Number(s.weeklyHours))}).</p>
              <Field label="Justification du dépassement" required error={err('justification')}>
                {(id) => <textarea id={id} rows={2} value={s.volumeJustification ?? ''} placeholder="Ex. : heures supplémentaires structurelles validées par la direction, poste en équipes…" onChange={(e) => set('volumeJustification', e.target.value)} />}
              </Field>
            </div>
          )}
          <div className="day-types">
            {groups.map((g, gi) => {
              const groupMinutes = g.items.reduce((sum, { slot }) => sum + (slot.start && slot.end && slot.start !== slot.end ? slotMinutes(slot) : 0), 0);
              return (
                <section key={g.key} className={`day-type ${submitted && groupErrors[gi] ? 'invalid' : ''}`} aria-label={`Journée type ${LETTERS[gi]}`}>
                  <header className="day-type-head">
                    <span className="day-type-badge">{LETTERS[gi]}</span>
                    <span className="day-type-title">
                      <strong>Journée type {LETTERS[gi]}</strong>
                      <span>{g.days.length ? daysLabel(g.days) : 'Aucun jour'} · {fmtDuration(groupMinutes)} par jour</span>
                    </span>
                    <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" disabled={groups.length === 1} onClick={() => removeGroup(g.key)} aria-label={`Supprimer la journée type ${LETTERS[gi]}`} title="Supprimer cette journée type"><Trash2 size={14} /></button>
                  </header>

                  <div className="slot-days" role="group" aria-label={`Jours de la journée type ${LETTERS[gi]}`}>
                    <span className="slot-days-label">Jours</span>
                    {DAYS.map((d, k) => {
                      const day = k + 1;
                      const on = g.days.includes(day);
                      const owner = !on ? groups.findIndex((o) => o.key !== g.key && o.days.includes(day)) : -1;
                      return (
                        <button key={d} type="button" className={`slot-day ${on ? 'on' : ''} ${owner >= 0 ? 'taken' : ''}`} aria-pressed={on} disabled={owner >= 0}
                          title={owner >= 0 ? `Déjà dans la journée type ${LETTERS[owner]}` : on ? 'Retirer ce jour' : 'Ajouter ce jour'}
                          onClick={() => toggleGroupDay(g.key, day)}>{d}{owner >= 0 && <small>{LETTERS[owner]}</small>}</button>
                      );
                    })}
                  </div>

                  <SlotTimeline slots={g.items.map((x) => x.slot)} />
                  <ol className="sched-slots">
                    {g.items.map(({ slot: x, index: i }, k) => {
                      const night = !!x.start && !!x.end && toMinutes(x.end) < toMinutes(x.start);
                      const valid = !!x.start && !!x.end && x.start !== x.end;
                      const next = g.items[k + 1]?.slot;
                      const pause = next && valid && !night && next.start && toMinutes(next.start) > toMinutes(x.end) ? toMinutes(next.start) - toMinutes(x.end) : 0;
                      return (
                        <li key={i}>
                          <div className={`slot-card ${submitted && (!x.label.trim() || !valid) ? 'invalid' : ''}`}>
                            <div className="slot-top">
                              <span className="slot-index" aria-hidden>{k + 1}</span>
                              <input className="fx-input slot-label" aria-label={`Libellé du créneau ${k + 1}, journée ${LETTERS[gi]}`} value={x.label} onChange={(e) => setSlot(i, { label: e.target.value })} placeholder="Libellé — ex. : Matin" />
                              <span className={`slot-duration ${night ? 'night' : ''}`} title={night ? 'Poste de nuit : traverse minuit' : undefined}>
                                {night && <Moon size={11} aria-hidden />}{valid ? fmtDuration(slotMinutes(x)) : '—'}
                              </span>
                              <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" disabled={g.items.length === 1} onClick={() => set('slots', s.slots.filter((_, j) => j !== i))} aria-label={`Supprimer le créneau ${k + 1}`}><Trash2 size={14} /></button>
                            </div>
                            <div className="time-range">
                              <label><span>De</span><input type="time" aria-label={`Début du créneau ${k + 1}`} value={x.start} onChange={(e) => setSlot(i, { start: e.target.value })} /></label>
                              <ArrowRight size={14} aria-hidden />
                              <label><span>À</span><input type="time" aria-label={`Fin du créneau ${k + 1}`} value={x.end} onChange={(e) => setSlot(i, { end: e.target.value })} /></label>
                            </div>
                          </div>
                          {pause > 0 && <p className="slot-pause"><Coffee size={12} aria-hidden /> Pause de {fmtDuration(pause)}</p>}
                        </li>
                      );
                    })}
                  </ol>
                  <button type="button" className="btn btn-sm btn-ghost day-type-add" onClick={() => addSlot(g)}><Plus size={13} aria-hidden /> Créneau pour {g.days.length ? daysLabel(g.days) : 'cette journée'}</button>
                  {submitted && groupErrors[gi] && <p className="field-error">{groupErrors[gi]}</p>}
                </section>
              );
            })}
          </div>
          <p className="day-types-rest">
            <CalendarOff size={13} aria-hidden /> {freeDays.length ? <>Repos : <strong>{freeDays.map((d) => DAYS[d - 1]).join(', ')}</strong> — ajoutez une journée type pour les travailler.</> : 'Tous les jours de la semaine sont travaillés.'}
          </p>
          {err('slots') && <p className="field-error">{err('slots')}</p>}
        </FormCard>

        <FormCard icon={<CalendarDays size={16} />} title="Jours travaillés" subtitle="Déduits des créneaux et de leurs jours : affichage seul, à modifier depuis les créneaux.">
          <div className="table-wrap sched-days">
            <table className="table">
              <thead><tr><th scope="col">Périmètre</th>{DAYS.map((d) => <th key={d} scope="col" className="sched-day-col">{d}</th>)}<th scope="col" className="num">Jours</th><th scope="col" className="num">Total</th></tr></thead>
              <tbody>
                <tr>
                  <td className="sched-day-dept">{deps.length ? <span>{deps.length} département{deps.length > 1 ? 's' : ''} concerné{deps.length > 1 ? 's' : ''}</span> : <span className="text-muted">Tous les jours du scénario</span>}</td>
                  {DAYS.map((d, i) => {
                    const h = dayHours(s, i + 1);
                    return (
                      <td key={d} className="sched-day-col">
                        <span className={`day-toggle readonly ${h > 0 ? 'on' : 'off'}`}>{h > 0 ? 'Travaillé' : 'Repos'}</span>
                        {h > 0 && <span className="day-hours">{fmtDuration(Math.round(h * 60))}</span>}
                      </td>
                    );
                  })}
                  <td className="num"><strong>{workDays.length}</strong></td>
                  <td className="num"><strong>{fmtHours(computedHours)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          {err('days') && <p className="field-error">{err('days')}</p>}
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
    slots: [{ label: 'Matin', start: '08:30', end: '12:30', days: [1, 2, 3, 4, 5] }, { label: 'Après-midi', start: '13:30', end: '17:00', days: [1, 2, 3, 4, 5] }],
    departmentWorkDays: {}, exceptionalOffDays: [],
  };
}
