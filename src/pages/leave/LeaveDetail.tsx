import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Circle, Clock, Paperclip, UserCheck, X, XCircle, Ban, MinusCircle } from 'lucide-react';
import { useCompanyData, useStore } from '../../store';
import type { ID, StepStatus } from '../../types';
import { formatDate, formatDateTime, formatDays, formatLong, formatRange, TODAY } from '../../utils/dates';
import { currentStep, findEventConflicts, getBalance } from '../../utils/leave';
import { findPresenceConflicts } from '../../utils/presence';
import { Alert, Avatar, Badge, Drawer, EffectBadge, Field, LeaveStatusBadge, LeaveTypeTag, Modal, PersonCell, StepStatusBadge } from '../../components/ui';
import { dayHours, formatDaysHours, formatRequestDuration, scheduleOf } from '../../utils/hours';

const STEP_ICON: Record<StepStatus, JSX.Element> = {
  approuve: <CheckCircle2 size={20} aria-hidden />,
  refuse: <XCircle size={20} aria-hidden />,
  en_attente: <Clock size={20} aria-hidden />,
  a_venir: <Circle size={20} aria-hidden />,
  ignore: <MinusCircle size={20} aria-hidden />,
};

const PART_LABEL = { full: '', am: ' (matin)', pm: ' (après-midi)' };

export function LeaveDetail({ requestId, onClose }: { requestId?: ID; onClose: () => void }) {
  const { db, currentUser, decide, cancelLeave } = useStore();
  const data = useCompanyData();
  const req = data.requests.find((r) => r.id === requestId);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => { setComment(''); setError(''); }, [requestId, req?.status, req?.steps.length]);

  if (!req) return <Drawer open={!!requestId} onClose={onClose} title="Demande introuvable"><p>Cette demande n’existe pas dans la société active.</p></Drawer>;

  const employee = data.person(req.employeeId)!;
  const type = data.leaveType(req.leaveTypeId);
  const step = currentStep(req);
  const approver = data.person(step?.approverId);
  const balance = getBalance(db, employee.id, req.leaveTypeId, req.id);
  const perDay = dayHours(scheduleOf(db, req.employeeId));
  const fmtBal = (d: number) => (balance.scope === 'annuel' ? formatDaysHours(d, perDay) : formatDays(d));
  const conflicts = findEventConflicts(db, employee.id, req.start, req.end);
  const presence = req.status === 'en_attente' || req.status === 'approuve' ? findPresenceConflicts(db, employee.id, req.leaveTypeId, req.start, req.end, req.id) : [];
  const canDecide = req.status === 'en_attente' && !!step;
  const isMyTurn = step?.approverId === currentUser.id;
  const canCancel = req.status === 'en_attente' || (req.status === 'approuve' && req.end >= TODAY);

  const single = req.start === req.end;
  const period = single
    ? `${formatLong(req.start)}${PART_LABEL[req.startPart]}`
    : `Du ${formatLong(req.start)}${req.startPart === 'pm' ? ' (après-midi)' : ''} au ${formatLong(req.end)}${req.endPart === 'am' ? ' (matin)' : ''}`;

  const onDecide = (d: 'approve' | 'refuse') => {
    if (d === 'refuse' && !comment.trim()) { setError('Un commentaire est requis pour motiver un refus.'); return; }
    decide(req.id, d, comment.trim());
  };

  return (
    <Drawer
      open={!!requestId}
      onClose={onClose}
      wide
      title={`Demande de ${employee.firstName} ${employee.lastName}`}
      subtitle={<span className="row-gap"><LeaveStatusBadge status={req.status} /> <span className="text-muted">Réf. {req.id.toUpperCase()} · envoyée le {formatDateTime(req.createdAt)}</span></span>}
      footer={
        <>
          {canCancel && <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmCancel(true)}><Ban size={16} aria-hidden /> Annuler la demande</button>}
          <span className="spacer" />
          {canDecide && (
            <>
              <button type="button" className="btn btn-danger" onClick={() => onDecide('refuse')}><X size={16} aria-hidden /> Refuser</button>
              <button type="button" className="btn btn-success" onClick={() => onDecide('approve')}><Check size={16} aria-hidden /> Approuver l’étape {step!.order}</button>
            </>
          )}
          {!canDecide && !canCancel && <button type="button" className="btn btn-ghost" onClick={onClose}>Fermer</button>}
        </>
      }
    >
      <div className="detail-grid">
        <div className="stack">
          <dl className="detail-list">
            <div><dt>Employé</dt><dd><PersonCell employee={employee} sub={`${employee.functionName} · ${data.departmentName(employee.departmentId)}`} /></dd></div>
            <div><dt>Type</dt><dd><LeaveTypeTag type={type} /></dd></div>
            <div><dt>Période</dt><dd>{period}{req.startTime && ` · de ${req.startTime} à ${req.endTime}`}</dd></div>
            <div><dt>Durée décomptée</dt><dd><strong>{formatRequestDuration(req)}</strong>{req.hours != null && <span className="text-muted small"> · soit {req.days.toFixed(2).replace('.', ',')} j de solde</span>}</dd></div>
            <div><dt>Impact sur le solde</dt><dd>{type?.deductsFromAnnual ? <Badge tone="primary">Déduit du solde annuel</Badge> : <Badge tone="neutral">Hors solde annuel</Badge>}</dd></div>
            {balance.tracked && <div><dt>{balance.scope === 'annuel' ? 'Solde annuel' : 'Plafond restant'} (hors cette demande → après)</dt><dd>{fmtBal(balance.available)} → {fmtBal(balance.available - (req.status === 'annule' || req.status === 'refuse' ? 0 : req.days))}</dd></div>}
            <div><dt>Commentaire</dt><dd>{req.comment || <span className="text-muted">Aucun commentaire</span>}</dd></div>
            <div><dt>Justificatif</dt><dd>{req.attachment ? <span className="file-chip"><Paperclip size={14} aria-hidden /> {req.attachment}</span> : <span className="text-muted">Aucun</span>}</dd></div>
          </dl>

          {conflicts.length > 0 && req.status !== 'annule' && (
            <Alert tone={conflicts.some((c) => c.effect === 'block') ? 'danger' : 'warning'} title="Événements sur la période">
              <ul className="plain-list">
                {conflicts.map((c) => <li key={c.id}>{c.name} ({formatRange(c.start, c.end)}) <EffectBadge effect={c.effect} /></li>)}
              </ul>
            </Alert>
          )}

          {presence.map((c) => (
            <Alert key={c.rule} tone="warning" title={`Règle de présence — ${c.kind === 'solo' ? 'fonction liée' : 'présence minimale'} : ${c.rule}`}>
              <p>{c.message}</p>
              <p className="small mt-4">Jours concernés : {c.days.slice(0, 6).map((d) => formatDate(d)).join(', ')}{c.days.length > 6 ? ` et ${c.days.length - 6} autre(s)` : ''}</p>
            </Alert>
          ))}

          {canDecide && (
            <div className="decision-box">
              <p className="label">Décision pour l’étape {step!.order}</p>
              {!isMyTurn && (
                <p className="small text-muted">
                  L’étape courante revient à <strong>{approver?.firstName} {approver?.lastName}</strong>. En tant qu’administrateur RH, vous pouvez simuler sa décision.
                </p>
              )}
              <Field label="Commentaire de décision" error={error} hint="Obligatoire en cas de refus.">
                {(id) => <textarea id={id} rows={2} value={comment} onChange={(e) => { setComment(e.target.value); setError(''); }} placeholder="Ex. : OK, passation prévue avec l’équipe." />}
              </Field>
            </div>
          )}
        </div>

        <div className="stack">
          <section>
            <h3 className="section-title">Étapes d’approbation</h3>
            {req.exempt || req.steps.length === 0 ? (
              <Alert tone="success" title="Dispensé d’approbation">
                <UserCheck size={14} aria-hidden className="inline-icon" /> Le profil de l’employé est dispensé : la demande a été validée automatiquement.
              </Alert>
            ) : (
              <ol className="timeline">
                {req.steps.map((s) => {
                  const a = data.person(s.approverId);
                  return (
                    <li key={s.order} className={`timeline-item step-${s.status}`}>
                      <span className="timeline-icon">{STEP_ICON[s.status]}</span>
                      <div className="timeline-content">
                        <div className="timeline-head">
                          <span className="step-num">{s.order}</span>
                          <Avatar employee={a} size={24} />
                          <span className="person-name">{a?.firstName} {a?.lastName}</span>
                          <StepStatusBadge status={s.status} />
                        </div>
                        <p className="small text-muted">{a?.functionName}{s.decidedAt && ` · ${formatDateTime(s.decidedAt)}`}</p>
                        {s.comment && <blockquote className="quote">{s.comment}</blockquote>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section>
            <h3 className="section-title">Historique</h3>
            <ul className="history">
              {[...req.history].reverse().map((h, i) => {
                const actor = data.person(h.actorId);
                return (
                  <li key={i}>
                    <span className="history-time">{formatDateTime(h.at)}</span>
                    <span>{h.label}{actor && <span className="text-muted"> — {actor.firstName} {actor.lastName}</span>}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Annuler cette demande ?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>Retour</button>
            <button type="button" className="btn btn-danger" onClick={() => { cancelLeave(req.id, cancelReason.trim()); setConfirmCancel(false); setCancelReason(''); }}>
              Confirmer l’annulation
            </button>
          </>
        }
      >
        <p className="mb-12">La demande restera visible dans l’historique avec le statut « Annulée ». Les étapes en attente seront clôturées.</p>
        <Field label="Motif (facultatif)">
          {(id) => <input id={id} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex. : changement de planning" />}
        </Field>
      </Modal>
    </Drawer>
  );
}
