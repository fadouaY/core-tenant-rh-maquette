import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarDays, Clock, Paperclip, Send, Trash2, Upload, UserCheck } from 'lucide-react';
import { useCompanyData, useStore } from '../../store';
import type { DayPart, ID } from '../../types';
import { diffDays, formatDate, formatDays, formatRange, overlaps, TODAY } from '../../utils/dates';
import { balanceTypes, countLeaveDays, findEventConflicts, getAnnualBalance, getBalance } from '../../utils/leave';
import { countAuthorization, dayHours, formatDaysHours, formatHours, fromMinutes, nextWorkingDay, scheduleOf, slotTimes, toMinutes } from '../../utils/hours';
import { findPresenceConflicts, presenceEffect } from '../../utils/presence';
import { Alert, Avatar, Drawer, EffectBadge, Field } from '../../components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: ID) => void;
  defaultEmployeeId?: ID;
}

export function LeaveForm({ open, onClose, onCreated, defaultEmployeeId }: Props) {
  const { db, currentUser, submitLeave, toast } = useStore();
  const data = useCompanyData();
  const types = data.leaveTypes.filter((t) => !t.archived);
  const dayTypes = types.filter((t) => t.unit !== 'heure');
  const hourTypes = types.filter((t) => t.unit === 'heure');
  const selectable = data.activePeople.filter((e) => !!data.profile(e.id));

  const [employeeId, setEmployeeId] = useState<ID>(defaultEmployeeId ?? currentUser.id);
  const [kind, setKind] = useState<'conge' | 'autorisation'>('conge');
  const [leaveTypeId, setLeaveTypeId] = useState<ID>(dayTypes[0]?.id ?? '');
  const [authDate, setAuthDate] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [singlePart, setSinglePart] = useState<DayPart>('full');
  const [startsPm, setStartsPm] = useState(false);
  const [endsAm, setEndsAm] = useState(false);
  const [comment, setComment] = useState('');
  const [attachment, setAttachment] = useState<string>('');
  const [ackWarning, setAckWarning] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Réinitialisation à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    setEmployeeId(defaultEmployeeId ?? currentUser.id);
    setKind('conge');
    setLeaveTypeId(dayTypes[0]?.id ?? '');
    setAuthDate(''); setFromTime(''); setToTime('');
    setStart(''); setEnd(''); setSinglePart('full'); setStartsPm(false); setEndsAm(false);
    setComment(''); setAttachment(''); setAckWarning(false); setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const employee = data.person(employeeId)!;
  const type = data.leaveType(leaveTypeId);
  const rule = data.leaveRules.find((r) => r.leaveTypeId === leaveTypeId && !r.archived);
  const isAuth = kind === 'autorisation';
  const switchKind = (k: 'conge' | 'autorisation') => {
    setKind(k);
    setLeaveTypeId((k === 'autorisation' ? hourTypes : dayTypes)[0]?.id ?? '');
    setSubmitted(false); setAckWarning(false);
    if (k === 'autorisation') {
      const first = scheduleOf(db, employeeId)?.slots[0];
      if (!authDate) setAuthDate(nextWorkingDay(db, employeeId, TODAY));
      if (first && !fromTime) {
        setFromTime(first.start);
        setToTime(fromMinutes(Math.min(toMinutes(first.start) + 60, toMinutes(first.end))));
      }
    }
  };
  const pickFrom = (v: string) => {
    setFromTime(v);
    // L'heure de fin reste après le début : à défaut, +1 h dans la limite du créneau.
    if (!toTime || toMinutes(toTime) <= toMinutes(v)) {
      const slot = scheduleOf(db, employeeId)?.slots.find((sl) => toMinutes(v) >= toMinutes(sl.start) && toMinutes(v) < toMinutes(sl.end));
      setToTime(fromMinutes(Math.min(toMinutes(v) + 60, slot ? toMinutes(slot.end) : toMinutes(v) + 60)));
    }
  };
  const rangeStart = isAuth ? authDate : start;
  const rangeEnd = isAuth ? authDate : end;
  const single = !!start && start === end;
  const startPart: DayPart = isAuth ? 'full' : single ? singlePart : startsPm ? 'pm' : 'full';
  const endPart: DayPart = isAuth ? 'full' : single ? singlePart : endsAm ? 'am' : 'full';
  const datesValid = !!rangeStart && !!rangeEnd && rangeEnd >= rangeStart;

  const count = useMemo(
    () => (!isAuth && employee && datesValid ? countLeaveDays(db, employee.id, start, end, startPart, endPart) : null),
    [db, employee, start, end, startPart, endPart, datesValid, isAuth],
  );
  const schedule = employee ? scheduleOf(db, employee.id) : undefined;
  const perDay = dayHours(schedule);
  const timesValid = !!fromTime && !!toTime && toMinutes(toTime) > toMinutes(fromTime);
  const times = slotTimes(schedule?.slots ?? []);
  const auth = isAuth && employee && authDate && timesValid ? countAuthorization(db, employee.id, authDate, fromTime, toTime) : null;
  const requested = isAuth ? auth?.days ?? 0 : count?.total ?? 0;
  const annual = employee ? getAnnualBalance(db, employee.id) : null;
  const ownCaps = employee ? balanceTypes(db, employee.companyId).own : [];
  const balance = employee ? getBalance(db, employee.id, leaveTypeId) : null;
  const conflicts = employee && datesValid ? findEventConflicts(db, employee.id, rangeStart, rangeEnd) : [];
  const blocking = conflicts.filter((c) => c.effect === 'block');
  const warnings = conflicts.filter((c) => c.effect === 'warning');
  // Règles de présence (fonctions solo liées, présence minimale des fonctions groupe)
  // Une autorisation de quelques heures n'est pas soumise aux règles de présence (journées entières).
  const presence = !isAuth && employee && datesValid ? findPresenceConflicts(db, employee.id, leaveTypeId, start, end) : [];
  const presenceBlocks = presence.length > 0 && presenceEffect(db, employee?.companyId ?? '') === 'block';
  const presenceWarns = presence.length > 0 && !presenceBlocks;
  const hardBlock = blocking.length > 0 || presenceBlocks;
  const overlapping = employee && datesValid
    ? data.requests.filter((r) => r.employeeId === employee.id && (r.status === 'approuve' || r.status === 'en_attente') && overlaps(r.start, r.end, rangeStart, rangeEnd)
      // Deux autorisations le même jour ne se chevauchent que si leurs plages horaires se croisent.
      && !(isAuth && r.startTime && r.endTime && timesValid && (toMinutes(r.endTime) <= toMinutes(fromTime) || toMinutes(r.startTime) >= toMinutes(toTime))))
    : [];
  const teamAbsent = employee && datesValid
    ? data.requests.filter((r) => r.status === 'approuve' && r.employeeId !== employee.id && data.person(r.employeeId)?.departmentId === employee.departmentId && overlaps(r.start, r.end, rangeStart, rangeEnd))
    : [];
  const noticeShort = !isAuth && rule && start && diffDays(TODAY, start) < rule.minNoticeDays;
  const insufficient = balance?.tracked && requested > 0 ? requested > balance.available + 1e-9 : false;
  const fmtBal = (d: number) => (balance?.scope === 'annuel' ? formatDaysHours(d, perDay) : formatDays(d));
  const profile = data.profile(employeeId);
  const circuit = data.circuit(profile?.circuitId);
  const exempt = !!circuit?.exempt || profile?.approverIds.length === 0;

  const errors: Record<string, string> = {};
  if (!leaveTypeId) errors.type = isAuth ? 'Aucun type d’autorisation paramétré (Paramètres › Types de congé).' : 'Choisissez un type.';
  if (isAuth) {
    if (!authDate) errors.authDate = 'Indiquez la date.';
    if (!fromTime) errors.fromTime = 'Heure de début requise.';
    if (!toTime) errors.toTime = 'Heure de fin requise.';
    else if (fromTime && !timesValid) errors.toTime = 'L’heure de fin doit suivre l’heure de début.';
    if (auth && !auth.workingDay) errors.authDate = auth.holiday ? `Jour férié : ${auth.holiday}.` : 'Ce jour n’est pas travaillé selon votre horaire.';
    else if (auth && auth.hours === 0) errors.toTime = 'La plage est entièrement en dehors de vos créneaux de travail.';
  } else {
    if (!start) errors.start = 'Indiquez la date de début.';
    if (!end) errors.end = 'Indiquez la date de fin.';
    if (start && end && end < start) errors.end = 'La date de fin doit être postérieure ou égale à la date de début.';
    if (count && count.total === 0) errors.end = 'Aucun jour ouvré dans la période sélectionnée.';
  }
  const blockers = [...Object.values(errors)];
  if (blocking.length) blockers.push('Conflit avec un événement bloquant.');
  if (overlapping.length) blockers.push('Chevauchement avec une autre demande.');
  if (presenceBlocks) blockers.push('Règle de présence non respectée.');
  if ((warnings.length || presenceWarns) && !ackWarning) blockers.push('Avertissement à confirmer.');

  const submit = () => {
    setSubmitted(true);
    if (blockers.length) return;
    const req = submitLeave({
      employeeId, leaveTypeId, start: rangeStart, end: rangeEnd, startPart, endPart, comment, attachment: attachment || undefined,
      ...(isAuth ? { startTime: fromTime, endTime: toTime } : {}),
    });
    toast(exempt ? 'Demande envoyée et validée automatiquement (profil dispensé)' : 'Demande envoyée au premier approbateur');
    onClose();
    onCreated?.(req.id);
  };

  const showErr = (k: string) => (submitted ? errors[k] : undefined);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={isAuth ? 'Nouvelle demande d’autorisation' : 'Nouvelle demande de congé'}
      subtitle="Les décomptes affichés sont des exemples de démonstration."
      footer={
        <>
          <span className="footer-note">
            {submitted && blockers.length > 0 ? <span className="text-danger">{blockers[0]}</span> : 'Vérifiez le décompte avant l’envoi.'}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={hardBlock}>
            <Send size={16} aria-hidden /> Envoyer la demande
          </button>
        </>
      }
    >
      <div className="request-top">
        <div className="kind-switch" role="radiogroup" aria-label="Nature de la demande">
          {([
            ['conge', 'Congé', 'En jours ou demi-journées', <CalendarDays key="i" size={17} />],
            ['autorisation', 'Autorisation', 'En heures, sur vos créneaux', <Clock key="i" size={17} />],
          ] as const).map(([k, label, sub, icon]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={`kind-option ${kind === k ? 'active' : ''}`} onClick={() => switchKind(k)}>
              <span className="kind-icon" aria-hidden>{icon}</span>
              <span><span className="kind-label">{label}</span><span className="kind-sub">{sub}</span></span>
            </button>
          ))}
        </div>
        <div className="balance-strip" aria-label="Soldes restants">
          {annual?.tracked && (
            <div className="balance-tile primary">
              <span className="balance-tile-label">Solde annuel restant</span>
              <span className="balance-tile-value">{formatDaysHours(annual.available, perDay)}</span>
              <span className="balance-tile-sub">soit {formatHours(annual.available * perDay)} · 1 j = {formatHours(perDay)}{annual.pending ? ` · ${formatDaysHours(annual.pending, perDay)} en attente` : ''}</span>
            </div>
          )}
          {ownCaps.map((t) => {
            const b = getBalance(db, employeeId, t.id);
            return (
              <div key={t.id} className="balance-tile">
                <span className="balance-tile-label" title={t.name}><span className="dot" style={{ background: t.color }} aria-hidden /> {t.name}</span>
                <span className="balance-tile-value">{formatDays(b.available)}</span>
                <span className="balance-tile-sub">sur {formatDays(b.acquired)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-split">
        <div className="form-main">
          <fieldset className="form-section">
            <legend>Demande</legend>
            <div className="form-grid">
              <Field label="Employé" required className="span-2"
                hint={employeeId !== currentUser.id ? 'Vous saisissez la demande pour le compte de cet employé.' : undefined}>
                {(id) => (
                  <select id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                    {selectable.map((e) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.id === currentUser.id ? ' (moi)' : ''} — {data.departmentName(e.departmentId)}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={isAuth ? 'Type d’autorisation' : 'Type de congé'} required className="span-2" error={showErr('type')}>
                {(id) => (
                  <select id={id} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
                    {(isAuth ? hourTypes : dayTypes).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                  </select>
                )}
              </Field>
              {isAuth ? (
                <>
                  <Field label="Date" required error={showErr('authDate')} className="span-2">
                    {(id) => <input id={id} type="date" value={authDate} min="2026-01-01" onChange={(e) => setAuthDate(e.target.value)} />}
                  </Field>
                  <Field label="De" required error={showErr('fromTime')}>
                    {(id) => (
                      <select id={id} value={fromTime} onChange={(e) => pickFrom(e.target.value)}>
                        {!fromTime && <option value="">Heure de début</option>}
                        {times.starts.map((g) => (
                          <optgroup key={g.label} label={g.label}>{g.times.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label="À" required error={showErr('toTime')}>
                    {(id) => (
                      <select id={id} value={toTime} onChange={(e) => setToTime(e.target.value)} disabled={!fromTime}>
                        {!toTime && <option value="">Heure de fin</option>}
                        {times.endsAfter(fromTime).map((g) => (
                          <optgroup key={g.label} label={g.label}>{g.times.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
                        ))}
                      </select>
                    )}
                  </Field>
                </>
              ) : (<>
              <Field label="Date de début" required error={showErr('start')}>
                {(id) => <input id={id} type="date" value={start} min="2026-01-01" onChange={(e) => { setStart(e.target.value); if (!end || e.target.value > end) setEnd(e.target.value); }} />}
              </Field>
              <Field label="Date de fin" required error={showErr('end')}>
                {(id) => <input id={id} type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />}
              </Field>
              </>)}
            </div>

            {isAuth ? (
              <div className="form-subsection">
                <p className="label">Vos créneaux de travail <span className="text-muted">· horaire « {schedule?.name} »</span></p>
                <div className="slot-row">
                  {(schedule?.slots ?? []).map((sl) => (
                    <button key={sl.label} type="button" className="slot-chip" onClick={() => { setFromTime(sl.start); setToTime(sl.end); }}
                      title={`Remplir avec le créneau ${sl.label.toLowerCase()}`}>
                      <span>{sl.label}</span> {sl.start}–{sl.end}
                    </button>
                  ))}
                </div>
                <p className="text-muted small mt-4">Seules les heures comprises dans vos créneaux sont décomptées (les pauses sont exclues). Une journée de solde = {formatHours(perDay)}.</p>
              </div>
            ) : (
            <div className="form-subsection">
              <p className="label">Période partielle</p>
              {!type?.allowHalfDay ? (
                <p className="text-muted small">Ce type de congé se pose uniquement en journées complètes.</p>
              ) : single ? (
                <div className="radio-row" role="radiogroup" aria-label="Période de la journée">
                  {([['full', 'Journée complète'], ['am', 'Matin'], ['pm', 'Après-midi']] as const).map(([v, l]) => (
                    <label key={v} className={`radio-pill ${singlePart === v ? 'checked' : ''}`}>
                      <input type="radio" name="singlePart" checked={singlePart === v} onChange={() => setSinglePart(v)} /> {l}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="check-col">
                  <label className="check"><input type="checkbox" checked={startsPm} onChange={(e) => setStartsPm(e.target.checked)} disabled={!start} /> Commencer l’après-midi du premier jour</label>
                  <label className="check"><input type="checkbox" checked={endsAm} onChange={(e) => setEndsAm(e.target.checked)} disabled={!end} /> Terminer à midi le dernier jour</label>
                </div>
              )}
            </div>
            )}
          </fieldset>

          <fieldset className="form-section">
            <legend>Compléments</legend>
            <Field label="Commentaire" hint="Visible par les approbateurs.">
              {(id) => <textarea id={id} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Motif ou précision utile (facultatif)" />}
            </Field>
            <Field label="Justificatif (facultatif)"
              hint={type?.requiresProof ? 'Conseillé pour ce type de congé — vous pourrez aussi le transmettre plus tard.' : 'Fichier fictif : seul le nom est conservé dans la maquette, rien n’est envoyé.'}>
              {(id) => attachment ? (
                <div className="file-chip">
                  <Paperclip size={15} aria-hidden /> <span>{attachment}</span>
                  <button type="button" className="icon-btn" onClick={() => setAttachment('')} aria-label="Retirer le justificatif"><Trash2 size={15} /></button>
                </div>
              ) : (
                <div className="file-row">
                  <label htmlFor={id} className="dropzone">
                    <span className="dropzone-icon" aria-hidden><Upload size={15} /></span>
                    <span><strong>Choisir un fichier</strong><span className="dropzone-sub">PDF, JPG ou PNG</span></span>
                  </label>
                  <input id={id} type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? '')} />
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAttachment('justificatif_exemple.pdf')}>Utiliser un fichier d’exemple</button>
                </div>
              )}
            </Field>
          </fieldset>

          {datesValid && (blocking.length > 0 || warnings.length > 0 || presence.length > 0 || overlapping.length > 0 || noticeShort || teamAbsent.length > 0) && (
            <div className="stack">
              {presence.map((c) => (
                <Alert key={c.rule} tone={presenceBlocks ? 'danger' : 'warning'}
                  title={`${c.kind === 'solo' ? 'Fonction liée' : 'Présence minimale'} : ${c.rule}${presenceBlocks ? ' — demande bloquée' : ''}`}>
                  <p>{c.message}</p>
                  <p className="small mt-4">Jours concernés : {c.days.slice(0, 6).map((d) => formatDate(d)).join(', ')}{c.days.length > 6 ? ` et ${c.days.length - 6} autre(s)` : ''}</p>
                  {presenceWarns && <label className="check mt-8"><input type="checkbox" checked={ackWarning} onChange={(e) => setAckWarning(e.target.checked)} /> J’ai pris connaissance de cette règle et je maintiens ma demande</label>}
                </Alert>
              ))}
              {blocking.map((ev) => (
                <Alert key={ev.id} tone="danger" title={`Période bloquée : ${ev.name}`}>
                  {formatRange(ev.start, ev.end)} — {ev.description} Les demandes chevauchant cet événement ne peuvent pas être envoyées.
                </Alert>
              ))}
              {overlapping.map((r) => (
                <Alert key={r.id} tone="danger" title="Chevauchement avec une demande existante">
                  {data.leaveType(r.leaveTypeId)?.name} du {formatRange(r.start, r.end)} ({r.status === 'approuve' ? 'approuvée' : 'en attente'}).
                </Alert>
              ))}
              {warnings.map((ev) => (
                <Alert key={ev.id} tone="warning" title={`Attention : ${ev.name}`}>
                  <p>{formatRange(ev.start, ev.end)} — {ev.description}</p>
                  <label className="check mt-8"><input type="checkbox" checked={ackWarning} onChange={(e) => setAckWarning(e.target.checked)} /> J’ai pris connaissance de cet événement et je maintiens ma demande</label>
                </Alert>
              ))}
              {noticeShort && (
                <Alert tone="warning" title="Délai de prévenance court">
                  La règle d’exemple prévoit {rule!.minNoticeDays} jours de prévenance pour ce type. La demande reste possible mais sera signalée.
                </Alert>
              )}
              {teamAbsent.length > 0 && (
                <Alert tone="info" title={`${teamAbsent.length} collègue(s) du département absent(s) sur la période`}>
                  {teamAbsent.map((r) => { const e = data.person(r.employeeId); return `${e?.firstName} ${e?.lastName} (${formatRange(r.start, r.end)})`; }).join(', ')}
                </Alert>
              )}
            </div>
          )}
        </div>

        <aside className="form-aside" aria-label="Solde et décompte">
          <div className="aside-card">
            <p className="aside-title">{balance?.scope === 'annuel' ? 'Solde annuel' : balance?.scope === 'propre' ? `Plafond — ${type?.name}` : 'Solde'}</p>
            <p className={`impact-badge impact-${type?.deductsFromAnnual ? 'annuel' : 'hors'}`}>
              {type?.deductsFromAnnual ? 'Ce type est déduit du solde annuel' : 'Hors solde annuel : le solde annuel n’est pas modifié'}
            </p>
            {balance?.tracked ? (
              <>
                <dl className="balance-grid">
                  <div><dt>Acquis 2026</dt><dd>{formatDays(balance.acquired)}</dd></div>
                  <div><dt>Pris</dt><dd>{fmtBal(balance.taken)}</dd></div>
                  <div><dt>En attente</dt><dd>{fmtBal(balance.pending)}</dd></div>
                  <div className="strong"><dt>Disponible</dt><dd>{fmtBal(balance.available)}</dd></div>
                </dl>
                <div className="meter" aria-hidden>
                  <span className="meter-taken" style={{ width: `${Math.min(100, (balance.taken / Math.max(balance.acquired, 1)) * 100)}%` }} />
                  <span className="meter-pending" style={{ width: `${Math.min(100, (balance.pending / Math.max(balance.acquired, 1)) * 100)}%` }} />
                </div>
              </>
            ) : (
              <p className="text-muted small">Aucun plafond pour ce type{type?.requiresProof ? ' — justificatif conseillé' : ''}.</p>
            )}
          </div>

          <div className="aside-card">
            <p className="aside-title">Aperçu du décompte</p>
            {isAuth ? (auth && auth.workingDay ? (
              <>
                <ul className="count-list">
                  <li><span>Plage demandée</span><span>{fromTime}–{toTime}</span></li>
                  {auth.outsideMinutes > 0 && <li><span>Hors créneaux (pause, hors horaire)</span><span>− {formatHours(auth.outsideMinutes / 60)}</span></li>}
                  <li><span>Journée de travail (horaire « {schedule?.name} »)</span><span>{formatHours(perDay)}</span></li>
                  <li className="total"><span>Total décompté</span><span>{formatHours(auth.hours)}</span></li>
                  <li className="sub"><span>Équivalent en jours de solde</span><span>{auth.days.toFixed(2).replace('.', ',')} j</span></li>
                </ul>
                {balance?.tracked && (
                  <p className={`after-balance ${insufficient ? 'text-danger' : ''}`}>
                    {balance.scope === 'annuel' ? 'Solde annuel après demande' : 'Plafond restant après demande'} : <strong>{fmtBal(balance.available - auth.days)}</strong>
                    {balance.scope === 'annuel' && <span className="block small text-muted">soit {formatHours((balance.available - auth.days) * perDay)} restantes</span>}
                    {insufficient && ' — solde insuffisant (signalé aux approbateurs)'}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted small">Choisissez une date travaillée et une plage horaire pour afficher le décompte.</p>
            )) : count ? (
              <>
                <ul className="count-list">
                  <li><span>Jours calendaires</span><span>{count.calendarDays}</span></li>
                  <li><span>Jours non travaillés (horaire « {data.schedule(profile?.scheduleId)?.name} »)</span><span>− {count.nonWorkingDays}</span></li>
                  <li><span>Jours fériés</span><span>− {count.holidays.length}</span></li>
                  {count.holidays.map((h) => <li key={h.date} className="sub"><span>{formatDate(h.date)} · {h.name}</span><span /></li>)}
                  {count.halfDayDeduction > 0 && <li><span>Demi-journées</span><span>− {String(count.halfDayDeduction).replace('.', ',')}</span></li>}
                  <li className="total"><span>Total décompté</span><span>{formatDays(count.total)}</span></li>
                </ul>
                {balance?.tracked && (
                  <p className={`after-balance ${insufficient ? 'text-danger' : ''}`}>
                    {balance.scope === 'annuel' ? 'Solde annuel après demande' : 'Plafond restant après demande'} : <strong>{fmtBal(balance.available - count.total)}</strong>
                    {insufficient && ' — solde insuffisant (signalé aux approbateurs)'}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted small">Sélectionnez des dates pour afficher le décompte.</p>
            )}
          </div>

          <div className="aside-card">
            <p className="aside-title">Circuit d’approbation</p>
            {exempt ? (
              <p className="small"><UserCheck size={15} aria-hidden className="inline-icon" /> Profil dispensé : la demande sera validée automatiquement.</p>
            ) : (
              <ol className="mini-steps">
                {profile?.approverIds.map((id, i) => {
                  const a = data.person(id);
                  return <li key={id}><span className="step-num">{i + 1}</span><Avatar employee={a} size={22} /> {a?.firstName} {a?.lastName}</li>;
                })}
              </ol>
            )}
            <p className="text-muted small mt-8">{circuit?.name}</p>
          </div>

          {conflicts.length > 0 && (
            <div className="aside-card">
              <p className="aside-title">Événements sur la période</p>
              <ul className="plain-list">
                {conflicts.map((c) => <li key={c.id}>{c.effect === 'block' && <Ban size={13} aria-hidden className="inline-icon text-danger" />}{c.name} <EffectBadge effect={c.effect} /></li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </Drawer>
  );
}
