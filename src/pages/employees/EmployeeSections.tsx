// Sections de la fiche employé : vue d'ensemble (RH-4), rémunération et primes (RH-8), historique (RH-10),
// mode horaire (RH-24) et circuit hérité du département (RH-23).
import { useEffect, useState } from 'react';
import {
  Ban, BadgePercent, CalendarClock, CalendarRange, CheckCircle2, ChevronRight, History, Plus, SkipForward, Trash2, UserCheck, Wallet,
} from 'lucide-react';
import { navigate, newId, useCompanyData, useStore } from '../../store';
import { Alert, Avatar, Badge, EmptyState, Field, Modal, Switch } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { Employee, EmployeeHistoryEntry, LeaveProfile, PrimePeriodicity, ScheduleMode } from '../../types';
import { formatDate, formatRange, TODAY } from '../../utils/dates';
import {
  circuitStepsFor, currentSalary, formatMoney, organisationalSchedule, uncoveredRanges,
} from '../../utils/org';

/** Circuit hérité du département avec l'approbateur de chaque niveau et les sauts automatiques (RH-23). */
export function CircuitChain({ employee, profile }: { employee: Employee; profile?: LeaveProfile }) {
  const { db } = useStore();
  const data = useCompanyData();
  const circuit = data.circuit(profile?.circuitId);
  if (!circuit) {
    return <Alert tone="danger" title="Aucun circuit">Le département « {data.departmentName(employee.departmentId)} » n’a pas de circuit d’approbation actif.</Alert>;
  }
  if (circuit.exempt) {
    return <Alert tone="success" title={circuit.name}><UserCheck size={13} aria-hidden className="inline-icon" /> Circuit dispensé : les demandes sont validées automatiquement à l’envoi.</Alert>;
  }
  const steps = circuitStepsFor(db, employee.id, circuit);
  const SKIP: Record<string, string> = {
    requester: 'Sauté : l’employé est l’approbateur de ce niveau',
    below: 'Sauté : niveau inférieur à celui de l’employé',
    duplicate: 'Sauté : approbateur déjà présent à un niveau précédent',
    undefined: 'Sauté : aucun approbateur défini pour cet employé',
  };
  const active = steps.filter((s) => !s.skipped);
  return (
    <>
      <p className="small text-muted">{circuit.name} · circuit du département « {data.departmentName(circuit.departmentId)} », appliqué automatiquement</p>
      <ol className="timeline mt-8">
        {steps.map((s, i) => {
          const p = data.person(s.approverId);
          return (
            <li key={i} className={`timeline-item ${s.skipped ? 'step-ignore' : 'step-en_attente'}`}>
              <span className="timeline-icon">{s.skipped ? <SkipForward size={14} /> : <CheckCircle2 size={14} />}</span>
              <div className="timeline-content">
                <div className="timeline-head">
                  <span className="step-num">{i + 1}</span>
                  {p && <Avatar employee={p} size={24} />}
                  <span className="person-name">{p ? `${p.firstName} ${p.lastName}` : '—'}</span>
                  {s.skipped ? <Badge tone="muted">Sauté</Badge> : <Badge tone="primary">{active.indexOf(s) === 0 ? '1re validation' : 'Validation'}</Badge>}
                </div>
                <p className="small text-muted">{s.label}{s.skipped ? ` · ${SKIP[s.skipped]}` : ''}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {active.length === 0 && <Alert tone="success" title="Validation automatique">L’employé est le dernier approbateur de son circuit : ses demandes sont approuvées à l’envoi.</Alert>}
    </>
  );
}

/** Salaire de base daté et primes (RH-8). */
export function RemunerationTab({ employee }: { employee: Employee }) {
  const { addSalary, setPrimesAllowed, assignPrime, removePrime, toast } = useStore();
  const data = useCompanyData();
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [primeOpen, setPrimeOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const current = currentSalary(employee);
  const salaries = [...employee.salaries].sort((a, b) => b.since.localeCompare(a.since));

  const togglePrimes = (allow: boolean) => {
    if (!allow && employee.primes.length > 0) { setConfirmRevoke(true); return; }
    setPrimesAllowed(employee.id, allow);
    toast(allow ? 'Primes autorisées pour cet employé' : 'Autorisation des primes retirée', 'info');
  };

  return (
    <div className="fstack">
      <FormCard icon={<Wallet size={16} />} title="Salaire de base"
        subtitle={current ? `En vigueur : ${formatMoney(current.amount, data.currency)} par mois depuis le ${formatDate(current.since)}` : 'Aucun salaire en vigueur'}
        actions={<button type="button" className="btn btn-sm btn-primary" onClick={() => setSalaryOpen(true)}><Plus size={14} aria-hidden /> Nouveau salaire</button>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Date d’effet</th><th scope="col" className="num">Montant</th><th scope="col">Motif</th><th scope="col">État</th></tr></thead>
            <tbody>
              {salaries.map((s) => (
                <tr key={s.id}>
                  <td className="nowrap">{formatDate(s.since)}</td>
                  <td className="num">{formatMoney(s.amount, data.currency)}</td>
                  <td>{s.reason}</td>
                  <td>{s === current ? <Badge tone="success">En vigueur</Badge> : s.since > TODAY ? <Badge tone="info">À venir</Badge> : <Badge tone="muted">Antérieur</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormCard>

      <FormCard icon={<BadgePercent size={16} />} title="Primes" subtitle="Attribuées depuis le catalogue de la société, si les primes sont autorisées pour l’employé."
        actions={employee.allowPrimes ? <button type="button" className="btn btn-sm btn-primary" onClick={() => setPrimeOpen(true)}><Plus size={14} aria-hidden /> Attribuer une prime</button> : undefined}>
        <Switch checked={employee.allowPrimes} onChange={togglePrimes} label="Autoriser les primes pour cet employé" />
        {!employee.allowPrimes ? (
          <p className="small text-muted mt-8">Les primes ne sont pas autorisées : la section est masquée sur la vue d’ensemble.</p>
        ) : employee.primes.length === 0 ? (
          <EmptyState title="Aucune prime attribuée" text="Attribuez une prime du catalogue de la société." />
        ) : (
          <div className="table-wrap mt-12">
            <table className="table">
              <thead><tr><th scope="col">Prime</th><th scope="col">Type</th><th scope="col">Périodicité</th><th scope="col" className="num">Montant</th><th scope="col">Depuis</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {employee.primes.map((ep) => {
                  const p = data.prime(ep.primeId);
                  return (
                    <tr key={ep.primeId}>
                      <td><span className="person-name">{p?.name}</span> {p?.archived && <Badge tone="muted">Désactivée au catalogue</Badge>}</td>
                      <td>{p && PRIME_TYPE[p.type]}</td>
                      <td>{p && PRIME_PERIODICITY[p.periodicity]}</td>
                      <td className="num">{p ? formatMoney(p.amount, data.currency) : '—'}</td>
                      <td className="nowrap">{formatDate(ep.since)}</td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { removePrime(employee.id, ep.primeId); toast('Prime retirée', 'info'); }}>
                          <Trash2 size={13} aria-hidden /> Retirer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormCard>

      <SalaryModal open={salaryOpen} onClose={() => setSalaryOpen(false)}
        onSubmit={(amount, since, reason) => { addSalary(employee.id, { id: newId('sal'), amount, since, reason }); toast('Salaire enregistré'); }} />
      <PrimeModal open={primeOpen} employee={employee} onClose={() => setPrimeOpen(false)}
        onSubmit={(primeId, since) => { assignPrime(employee.id, primeId, since); toast('Prime attribuée'); }} />
      <Modal open={confirmRevoke} onClose={() => setConfirmRevoke(false)} title="Retirer l’autorisation des primes ?" size="sm"
        footer={<>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmRevoke(false)}>Annuler</button>
          <button type="button" className="btn btn-danger" onClick={() => { setPrimesAllowed(employee.id, false); setConfirmRevoke(false); toast(`${employee.primes.length} prime(s) révoquée(s)`, 'info'); }}>
            <Ban size={14} aria-hidden /> Retirer et révoquer
          </button>
        </>}>
        <p>Les {employee.primes.length} prime(s) actives de {employee.firstName} {employee.lastName} seront révoquées. L’opération est tracée dans l’historique.</p>
      </Modal>
    </div>
  );
}

export const PRIME_TYPE = { fixe: 'Prime fixe', variable: 'Prime variable', exceptionnelle: 'Prime exceptionnelle' } as const;
export const PRIME_PERIODICITY: Record<PrimePeriodicity, string> = {
  mensuelle: 'Mensuelle', trimestrielle: 'Trimestrielle', semestrielle: 'Semestrielle', annuelle: 'Annuelle', ponctuelle: 'Ponctuelle (une fois)',
};

function SalaryModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (amount: number, since: string, reason: string) => void }) {
  const data = useCompanyData();
  const [f, setF] = useState({ amount: '', since: TODAY, reason: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { if (open) { setF({ amount: '', since: TODAY, reason: '' }); setSubmitted(false); } }, [open]);
  const errors = { amount: Number(f.amount) > 0 ? '' : 'Montant strictement positif.', since: f.since ? '' : 'Date d’effet requise.', reason: f.reason.trim() ? '' : 'Motif requis.' };
  const save = () => { setSubmitted(true); if (errors.amount || errors.since || errors.reason) return; onSubmit(Number(f.amount), f.since, f.reason.trim()); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title="Nouveau salaire de base"
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label={`Montant mensuel (${data.currency})`} required error={submitted ? errors.amount : undefined}>{(id) => <input id={id} type="number" min={0} step={100} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}</Field>
        <Field label="Date d’effet" required error={submitted ? errors.since : undefined}>{(id) => <input id={id} type="date" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />}</Field>
        <Field label="Motif" required className="span-2" error={submitted ? errors.reason : undefined}>{(id) => <input id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ex. : revalorisation annuelle" />}</Field>
      </div>
    </Modal>
  );
}

function PrimeModal({ open, employee, onClose, onSubmit }: { open: boolean; employee: Employee; onClose: () => void; onSubmit: (primeId: string, since: string) => void }) {
  const data = useCompanyData();
  const available = data.primes.filter((p) => !p.archived && !employee.primes.some((x) => x.primeId === p.id));
  const [f, setF] = useState({ primeId: '', since: TODAY });
  useEffect(() => { if (open) setF({ primeId: available[0]?.id ?? '', since: TODAY }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Attribuer une prime"
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" disabled={!f.primeId || !f.since} onClick={() => { onSubmit(f.primeId, f.since); onClose(); }}>Attribuer</button></>}>
      {available.length === 0 ? <EmptyState title="Aucune prime disponible" text="Toutes les primes actives du catalogue sont déjà attribuées, ou le catalogue est vide." /> : (
        <div className="form-grid">
          <Field label="Prime du catalogue" required>
            {(id) => (
              <select id={id} value={f.primeId} onChange={(e) => setF({ ...f, primeId: e.target.value })}>
                {available.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.amount, data.currency)} ({PRIME_PERIODICITY[p.periodicity].toLowerCase()})</option>)}
              </select>
            )}
          </Field>
          <Field label="Date d’effet" required>{(id) => <input id={id} type="date" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />}</Field>
        </div>
      )}
    </Modal>
  );
}

const KIND_LABEL: Record<EmployeeHistoryEntry['kind'], string> = {
  recrutement: 'Recrutement', information: 'Information générale', mutation: 'Rattachement', horaire: 'Mode horaire',
  planification: 'Tableau de chargement', primes: 'Primes', salaire: 'Salaire', statut: 'Statut', circuit: 'Circuit',
};

/** Historique chronologique, en lecture seule (RH-10). */
export function HistoryTab({ employee }: { employee: Employee }) {
  const data = useCompanyData();
  const [kind, setKind] = useState('');
  const list = [...employee.history].sort((a, b) => b.at.localeCompare(a.at)).filter((h) => !kind || h.kind === kind);
  return (
    <FormCard icon={<History size={16} />} title="Historique" subtitle="Chronologie inaltérable : les entrées sont ajoutées par l’application et ne peuvent être ni modifiées ni supprimées."
      actions={
        <select className="fx-input fx-select" aria-label="Filtrer par type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Tous les événements</option>
          {(Object.keys(KIND_LABEL) as EmployeeHistoryEntry['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      }>
      {list.length === 0 ? <EmptyState title="Aucun événement" /> : (
        <ol className="timeline">
          {list.map((h, i) => {
            const actor = data.person(h.actorId);
            return (
              <li key={i} className="timeline-item step-approuve">
                <span className="timeline-icon"><ChevronRight size={14} /></span>
                <div className="timeline-content">
                  <div className="timeline-head">
                    <span className="person-name">{formatDate(h.at)}</span>
                    <Badge tone="neutral">{KIND_LABEL[h.kind]}</Badge>
                  </div>
                  <p className="small">{h.label}</p>
                  {actor && <p className="small text-muted">Par {actor.firstName} {actor.lastName}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </FormCard>
  );
}

/** Bascule au tableau de chargement, ou retour à l'horaire du département (RH-24). */
export function ScheduleModeModal({ employee, open, onClose }: { employee: Employee; open: boolean; onClose: () => void }) {
  const { db, setScheduleMode, toast } = useStore();
  const target: ScheduleMode = employee.scheduleMode === 'organisation' ? 'chargement' : 'organisation';
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { if (open) { setDate(TODAY); setReason(''); setSubmitted(false); } }, [open]);
  const preview: Employee = { ...employee, scheduleMode: target, loadingSince: target === 'chargement' ? date : undefined };
  const gaps = target === 'chargement' && date ? uncoveredRanges(db, preview, date) : [];
  const org = organisationalSchedule(db, employee.departmentId, employee.subDepartmentId);
  const dateError = !date ? 'La date d’effet est obligatoire.' : '';

  const save = () => {
    setSubmitted(true);
    if (dateError) return;
    setScheduleMode(employee.id, target, date, reason);
    toast(target === 'chargement' ? 'Employé passé au tableau de chargement' : 'Retour à l’horaire organisationnel');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={target === 'chargement' ? 'Passer au tableau de chargement' : 'Revenir à l’horaire organisationnel'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}><CalendarClock size={14} aria-hidden /> Confirmer</button></>}>
      <div className="stack">
        {target === 'chargement' ? (
          <p className="small">À la date d’effet, {employee.firstName} ne suit plus l’horaire de son département : ses horaires sont planifiés par périodes dans le tableau de chargement. L’employé y reste tant qu’on ne le ramène pas manuellement à l’horaire organisationnel.</p>
        ) : (
          <p className="small">À la date d’effet, l’horaire du rattachement s’applique de nouveau : <strong>{org.schedule?.name ?? 'aucun horaire défini'}</strong> ({org.source}). Les périodes planifiées sont conservées dans l’historique.</p>
        )}
        <div className="form-grid">
          <Field label="Date d’effet" required error={submitted ? dateError : undefined}>{(id) => <input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Motif">{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : affectation aux équipes postées" />}</Field>
        </div>
        {gaps.length > 0 && (
          <Alert tone="warning" title="Périodes non couvertes">
            Aucune période planifiée pour {gaps.map((g) => formatRange(g.start, g.end)).join(' · ')} : l’employé sera « Non planifié » sur ces dates.
            Planifiez-le ensuite depuis le tableau de chargement.
          </Alert>
        )}
        {target === 'chargement' && (
          <button type="button" className="link-btn" onClick={() => { onClose(); navigate('chargement'); }}><CalendarRange size={13} aria-hidden className="inline-icon" /> Ouvrir le tableau de chargement</button>
        )}
      </div>
    </Modal>
  );
}
