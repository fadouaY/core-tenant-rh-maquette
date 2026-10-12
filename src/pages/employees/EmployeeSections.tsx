// Sections de la fiche employé : vue d'ensemble (RH-4), rémunération et primes (RH-8), historique (RH-10),
// mode horaire (RH-24) et circuit hérité du département (RH-23).
import { useEffect, useState } from 'react';
import {
  Ban, BadgePercent, CalendarClock, CalendarRange, CheckCircle2, ChevronRight, GitCommitHorizontal, History, Pencil, Plus, SkipForward, Trash2, TrendingDown, TrendingUp, UserCheck, Wallet,
} from 'lucide-react';
import { navigate, newId, useCompanyData, useStore } from '../../store';
import { Alert, Avatar, Badge, EmptyState, Field, Modal, Switch } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import { Workflow } from '../../components/Workflow';
import type { Employee, EmployeeHistoryEntry, LeaveProfile, PrimePeriodicity, Salary, ScheduleMode } from '../../types';
import { addDays, formatDate, formatRange, TODAY } from '../../utils/dates';
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
  const { addSalary, updateSalary, removeSalary, setPrimesAllowed, assignPrime, removePrime, toast } = useStore();
  const data = useCompanyData();
  const [salaryEdit, setSalaryEdit] = useState<Salary | 'new'>();
  const [removing, setRemoving] = useState<Salary>();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [primeId, setPrimeId] = useState('');
  const [primeSince, setPrimeSince] = useState(TODAY);
  const money = (n: number) => formatMoney(n, data.currency);

  const current = currentSalary(employee);
  // Du plus ancien au plus récent pour calculer fin de période et progression, affiché du plus récent au plus ancien.
  const asc = [...employee.salaries].sort((a, b) => a.since.localeCompare(b.since));
  const initial = asc[0];
  const rows = asc.map((s, i) => {
    const prev = asc[i - 1];
    const next = asc[i + 1];
    const diff = prev ? s.amount - prev.amount : 0;
    return {
      s, prev, diff,
      pct: prev && prev.amount ? (diff / prev.amount) * 100 : 0,
      end: next ? addDays(next.since, -1) : undefined,
      state: s === current ? 'actuel' : s.since > TODAY ? 'avenir' : 'archive',
      nature: !prev ? 'Salaire initial' : diff > 0 ? 'Revalorisation' : diff < 0 ? 'Ajustement à la baisse' : 'Reconduction',
    };
  }).reverse();
  const totalGain = current && initial && current !== initial ? current.amount - initial.amount : 0;
  const available = data.primes.filter((p) => !p.archived && !employee.primes.some((x) => x.primeId === p.id));

  const togglePrimes = (allow: boolean) => {
    if (!allow && employee.primes.length > 0) { setConfirmRevoke(true); return; }
    setPrimesAllowed(employee.id, allow);
    toast(allow ? 'Primes autorisées pour cet employé' : 'Autorisation des primes retirée', 'info');
  };
  const attribute = () => {
    if (!primeId || !primeSince) return;
    assignPrime(employee.id, primeId, primeSince);
    toast('Prime attribuée');
    setPrimeId('');
    setPrimeSince(TODAY);
  };

  return (
    <div className="fstack">
      {/* Évolution du salaire en workflow, de l'embauche au salaire le plus récent */}
      <FormCard icon={<GitCommitHorizontal size={16} />} title="Évolution du salaire"
        subtitle={current ? `Salaire actuel : ${money(current.amount)} brut / mois depuis le ${formatDate(current.since)}` : 'Aucun salaire en vigueur.'}>
        {asc.length === 0 ? <p className="fempty">Aucun salaire enregistré.</p> : (
          <Workflow label="Évolution du salaire" steps={[...rows].reverse().map(({ s, prev, diff, pct, end, state, nature }) => ({
            id: s.id,
            state: state === 'actuel' ? 'current' : state === 'avenir' ? 'next' : 'past',
            content: (
              <>
                <div className="wf-card-top">
                  <span className={`ct-kind ${!prev ? 'ct-kind-initial' : diff > 0 ? 'ct-kind-renouvellement' : ''}`}>{nature}</span>
                  <Badge tone={state === 'actuel' ? 'success' : state === 'avenir' ? 'info' : 'muted'}>{state === 'actuel' ? 'Actuel' : state === 'avenir' ? 'À venir' : 'Archivé'}</Badge>
                </div>
                <p className="wf-amount">{money(s.amount)}<small> / mois</small></p>
                <p className="wf-dates">{formatDate(s.since)} <span aria-hidden>→</span> {end ? formatDate(end) : 'en cours'}</p>
                {prev ? (
                  <span className={`sal-delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
                    {diff > 0 ? <TrendingUp size={12} aria-hidden /> : diff < 0 ? <TrendingDown size={12} aria-hidden /> : null}
                    {diff > 0 ? '+' : ''}{money(diff)} <small>{diff > 0 ? '+' : ''}{pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</small>
                  </span>
                ) : <p className="wf-meta">Salaire d’embauche</p>}
                {prev && <p className="wf-meta">{s.reason}</p>}
              </>
            ),
          }))} />
        )}
      </FormCard>

      <FormCard icon={<Wallet size={16} />} title="Historique des salaires de base"
        subtitle={totalGain ? `Progression depuis l’embauche : ${totalGain > 0 ? '+' : ''}${money(totalGain)} (${totalGain > 0 ? '+' : ''}${((totalGain / initial!.amount) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %)` : 'Chaque salaire s’applique de sa date d’effet jusqu’à la veille du suivant.'}
        actions={<button type="button" className="btn btn-sm btn-primary" onClick={() => setSalaryEdit('new')}><Plus size={14} aria-hidden /> Nouveau salaire</button>}>
        <div className="table-wrap">
          <table className="table sal-table">
            <thead>
              <tr>
                <th scope="col" className="num">Montant</th>
                <th scope="col">Nature</th>
                <th scope="col">Date de début</th>
                <th scope="col">Date de fin</th>
                <th scope="col">Progression</th>
                <th scope="col">Motif</th>
                <th scope="col">Situation</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, prev, diff, pct, end, state, nature }) => (
                <tr key={s.id} className={state === 'actuel' ? 'ct-current' : ''}>
                  <td className="num"><strong className="sal-cell-amount">{money(s.amount)}</strong></td>
                  <td><span className={`ct-kind ${!prev ? 'ct-kind-initial' : diff > 0 ? 'ct-kind-renouvellement' : ''}`}>{nature}</span></td>
                  <td className="nowrap">{formatDate(s.since)}</td>
                  <td className="nowrap">{end ? formatDate(end) : <span className="text-muted">En cours</span>}</td>
                  <td className="nowrap">
                    {!prev ? <span className="text-muted">Base</span> : (
                      <span className={`sal-delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
                        {diff > 0 ? <TrendingUp size={12} aria-hidden /> : diff < 0 ? <TrendingDown size={12} aria-hidden /> : null}
                        {diff > 0 ? '+' : ''}{money(diff)}
                        <small>{diff > 0 ? '+' : ''}{pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</small>
                      </span>
                    )}
                  </td>
                  <td className="ct-note">{s.reason}</td>
                  <td><Badge tone={state === 'actuel' ? 'success' : state === 'avenir' ? 'info' : 'muted'}>{state === 'actuel' ? 'Actuel' : state === 'avenir' ? 'À venir' : 'Archivé'}</Badge></td>
                  <td className="actions">
                    <button type="button" className="icon-btn icon-btn-sm" title="Modifier" aria-label={`Modifier le salaire du ${formatDate(s.since)}`} onClick={() => setSalaryEdit(s)}><Pencil size={14} /></button>
                    {prev && <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" title="Supprimer" aria-label={`Supprimer le salaire du ${formatDate(s.since)}`} onClick={() => setRemoving(s)}><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormCard>

      <FormCard icon={<BadgePercent size={16} />} title="Primes de l’employé" subtitle="Attribuées depuis le catalogue de la société, si les primes sont autorisées pour l’employé."
        actions={<Switch checked={employee.allowPrimes} onChange={togglePrimes} label="Autoriser les primes" />}>
        {!employee.allowPrimes ? (
          <p className="fnote"><Ban size={13} aria-hidden /> Les primes ne sont pas autorisées pour cet employé.</p>
        ) : (
          <>
            <div className="prime-add">
              <Field label="Prime du catalogue">
                {(id) => (
                  <select id={id} value={primeId} onChange={(e) => setPrimeId(e.target.value)} disabled={available.length === 0}>
                    <option value="">{available.length ? 'Choisir une prime…' : 'Toutes les primes actives sont attribuées'}</option>
                    {available.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.amount)} ({PRIME_PERIODICITY[p.periodicity].toLowerCase()})</option>)}
                  </select>
                )}
              </Field>
              <Field label="Date d’effet" hint="Pré-remplie à aujourd’hui, modifiable.">
                {(id) => <input id={id} type="date" value={primeSince} onChange={(e) => setPrimeSince(e.target.value)} />}
              </Field>
              <button type="button" className="btn btn-primary prime-add-btn" disabled={!primeId || !primeSince} onClick={attribute}><Plus size={14} aria-hidden /> Attribuer</button>
            </div>
            {employee.primes.length === 0 ? <p className="fempty mt-12">Aucune prime attribuée.</p> : (
              <div className="table-wrap mt-12">
                <table className="table">
                  <thead><tr><th scope="col">Intitulé de la prime</th><th scope="col">Type</th><th scope="col">Périodicité</th><th scope="col" className="num">Montant</th><th scope="col">Date d’effet</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {employee.primes.map((ep) => {
                      const p = data.prime(ep.primeId);
                      return (
                        <tr key={ep.primeId}>
                          <td><span className="person-name">{p?.name}</span> {p?.archived && <Badge tone="muted">Désactivée au catalogue</Badge>}</td>
                          <td>{p && <span className={`prime-type ${p.type}`}>{PRIME_TYPE[p.type]}</span>}</td>
                          <td>{p && PRIME_PERIODICITY[p.periodicity]}</td>
                          <td className="num">{p ? <span className="sal-delta up">+{money(p.amount)}</span> : '—'}</td>
                          <td className="nowrap">{formatDate(ep.since)}</td>
                          <td className="actions">
                            <button type="button" className="btn btn-sm btn-ghost ct-danger" onClick={() => { removePrime(employee.id, ep.primeId); toast('Prime retirée', 'info'); }}>
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
          </>
        )}
      </FormCard>

      <SalaryModal open={!!salaryEdit} salary={salaryEdit === 'new' ? undefined : salaryEdit} salaries={employee.salaries} current={current}
        onClose={() => setSalaryEdit(undefined)}
        onSubmit={(s) => {
          if (salaryEdit === 'new') { addSalary(employee.id, s); toast('Salaire enregistré'); } else { updateSalary(employee.id, s); toast('Salaire mis à jour'); }
        }} />
      <Modal open={!!removing} onClose={() => setRemoving(undefined)} title="Supprimer ce salaire ?" size="sm"
        footer={<>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={() => setRemoving(undefined)}>Annuler</button>
          <button type="button" className="btn btn-danger" onClick={() => { removeSalary(employee.id, removing!.id); setRemoving(undefined); toast('Salaire supprimé', 'info'); }}><Trash2 size={14} aria-hidden /> Supprimer</button>
        </>}>
        {removing && <p>Le salaire de <strong>{money(removing.amount)}</strong> du {formatDate(removing.since)} sera retiré. La suppression reste tracée dans l’historique.</p>}
      </Modal>
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

export const PRIME_TYPE = { fixe: 'Prime ponctuelle', variable: 'Prime variable', exceptionnelle: 'Prime exceptionnelle' } as const;
export const PRIME_PERIODICITY: Record<PrimePeriodicity, string> = {
  mensuelle: 'Mensuelle', trimestrielle: 'Trimestrielle', semestrielle: 'Semestrielle', annuelle: 'Annuelle', ponctuelle: 'Ponctuelle (une fois)',
};

/** Nouveau salaire ou modification : date d'effet pré-remplie (aujourd'hui), modifiable ; progression affichée en direct. */
function SalaryModal({ open, salary, salaries, current, onClose, onSubmit }: {
  open: boolean; salary?: Salary; salaries: Salary[]; current?: Salary; onClose: () => void; onSubmit: (s: Salary) => void;
}) {
  const data = useCompanyData();
  const [f, setF] = useState({ amount: '', since: TODAY, reason: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (open) { setF(salary ? { amount: String(salary.amount), since: salary.since, reason: salary.reason } : { amount: '', since: TODAY, reason: '' }); setSubmitted(false); }
  }, [open, salary]);
  const amount = Number(f.amount);
  // Salaire de référence : celui qui précède la date d'effet saisie.
  const before = [...salaries].filter((s) => s.id !== salary?.id && s.since < f.since).sort((a, b) => b.since.localeCompare(a.since))[0] ?? (salary ? undefined : current);
  const diff = before && amount > 0 ? amount - before.amount : undefined;
  const errors = {
    amount: amount > 0 ? '' : 'Montant strictement positif.',
    since: !f.since ? 'Date d’effet requise.' : salaries.some((s) => s.id !== salary?.id && s.since === f.since) ? 'Un salaire existe déjà à cette date.' : '',
    reason: f.reason.trim() ? '' : 'Motif requis.',
  };
  const save = () => {
    setSubmitted(true);
    if (errors.amount || errors.since || errors.reason) return;
    onSubmit({ id: salary?.id ?? newId('sal'), amount, since: f.since, reason: f.reason.trim() });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={salary ? 'Modifier le salaire' : 'Nouveau salaire de base'}
      footer={<><span className="spacer" /><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label={`Montant mensuel brut (${data.currency})`} required error={submitted ? errors.amount : undefined}>
          {(id) => <span className="input-suffix"><input id={id} type="number" min={0} step={100} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><span aria-hidden>{data.currency}</span></span>}
        </Field>
        <Field label="Date d’effet" required error={submitted ? errors.since : undefined} hint={salary ? undefined : 'Pré-remplie à aujourd’hui, modifiable.'}>
          {(id) => <input id={id} type="date" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />}
        </Field>
        <Field label="Motif" required className="span-2" error={submitted ? errors.reason : undefined}>
          {(id) => <input id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ex. : revalorisation annuelle" />}
        </Field>
      </div>
      {diff !== undefined && before && (
        <p className={`sal-preview ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
          {diff > 0 ? <TrendingUp size={14} aria-hidden /> : diff < 0 ? <TrendingDown size={14} aria-hidden /> : null}
          Progression par rapport au salaire du {formatDate(before.since)} ({formatMoney(before.amount, data.currency)}) :
          <strong> {diff > 0 ? '+' : ''}{formatMoney(diff, data.currency)} ({diff > 0 ? '+' : ''}{((diff / before.amount) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %)</strong>
        </p>
      )}
    </Modal>
  );
}

const KIND_LABEL: Record<EmployeeHistoryEntry['kind'], string> = {
  recrutement: 'Recrutement', information: 'Information générale', mutation: 'Rattachement', horaire: 'Mode horaire',
  planification: 'Tableau de chargement', primes: 'Primes', salaire: 'Salaire', statut: 'Statut', circuit: 'Circuit', contrat: 'Contrat', document: 'Document',
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
