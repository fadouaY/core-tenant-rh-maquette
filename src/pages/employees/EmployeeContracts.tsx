// Onglet « Contrats » de la fiche employé (RH-7) : synthèse du parcours, liste des contrats,
// ajout, renouvellement, modification, clôture anticipée et suppression, chaque action étant historisée.
import { useEffect, useState } from 'react';
import { Ban, BellRing, CalendarClock, FilePlus2, FileSignature, GitCommitHorizontal, Pencil, RefreshCw, Save, Trash2, UserCog } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import type { ContractKind, Employee, EmployeeContract, HrStatus } from '../../types';
import { addDays, diffDays, formatDate, TODAY } from '../../utils/dates';
import {
  activeContract, CONTRACT_KIND_LABEL, CONTRACT_STATUS, contractsOf, contractStatus, contractTypeDef, contractTypeName, effectiveEnd, expiryAlertDays, isFixedTerm, overlappingContract, trialEndOf,
} from '../../utils/contracts';
import { Badge, Field, Modal } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import { Workflow } from '../../components/Workflow';
import { DEPARTURE_TYPES, HR_STATUS, HR_STATUS_ORDER, hrStatusOf, statusTimeline } from '../../utils/status';

const describe = (c: EmployeeContract) =>
  `${c.type} du ${formatDate(c.start)}${c.end ? ` au ${formatDate(c.end)}` : ' (durée indéterminée)'}`;

type Draft = { mode: 'new' | 'renew' | 'edit'; contract: EmployeeContract; /** Renouvellement : contrat renouvelé, qui prend fin la veille du nouveau. */ renewOf?: EmployeeContract };

export function ContractsTab({ employee }: { employee: Employee }) {
  const { saveContracts, toast } = useStore();
  const { contractTypes: types, contractPolicies } = useCompanyData();
  const alertDays = expiryAlertDays(contractPolicies, employee.companyId);
  const list = contractsOf(employee);
  const current = activeContract(list);
  const renewals = list.filter((c) => c.kind === 'renouvellement').length;
  const amendments = list.filter((c) => c.kind === 'avenant').length;
  const [draft, setDraft] = useState<Draft>();
  const [closing, setClosing] = useState<EmployeeContract>();
  const [removing, setRemoving] = useState<EmployeeContract>();

  // Le dernier contrat du parcours se renouvelle tant qu'il n'est pas clôturé (CDI compris : il prend fin la veille du nouveau).
  const latest = list[0];
  const canRenew = !!latest && !latest.closedAt;

  const commit = (next: EmployeeContract[], label: string, message: string) => {
    saveContracts(employee.id, next, label);
    toast(message);
  };

  const firstType = types.find((t) => !t.archived);
  const openNew = () => setDraft({ mode: 'new', contract: { id: newId('ctr'), kind: 'nouveau', type: firstType?.code ?? 'CDI', trialMonths: firstType?.trialMonths, start: current?.end ? addDays(current.end, 1) : TODAY } });
  const openRenew = () => canRenew && setDraft({
    mode: 'renew',
    renewOf: latest,
    contract: { id: newId('ctr'), kind: 'renouvellement', type: latest.type, start: latest.end ? addDays(latest.end, 1) : TODAY },
  });

  return (
    <div className="fstack">
      {/* Parcours des contrats en workflow, du premier au plus récent */}
      <FormCard icon={<GitCommitHorizontal size={16} />} title="Parcours des contrats"
        subtitle={`${list.length} contrat${list.length > 1 ? 's' : ''} · ${renewals} renouvellement${renewals > 1 ? 's' : ''} · ${amendments} avenant${amendments > 1 ? 's' : ''}`}>
        <Workflow label="Parcours des contrats" steps={[...list].reverse().map((c) => {
          const st = contractStatus(c);
          const end = effectiveEnd(c);
          const days = st === 'actif' && end ? diffDays(TODAY, end) : undefined;
          return {
            id: c.id,
            state: st === 'actif' ? 'current' : st === 'a_venir' ? 'next' : st === 'cloture' ? 'stopped' : 'past',
            content: (
              <>
                <div className="wf-card-top"><span className={`ct-kind ct-kind-${c.kind}`}>{CONTRACT_KIND_LABEL[c.kind ?? 'nouveau']}</span><Badge tone={CONTRACT_STATUS[st].tone}>{CONTRACT_STATUS[st].label}</Badge></div>
                <p className="wf-title">{c.type} <span>{contractTypeName(types, c.type)}</span></p>
                <p className="wf-dates">{formatDate(c.start)} <span aria-hidden>→</span> {end ? formatDate(end) : 'Indéterminée'}</p>
                {days !== undefined && days >= 0 && <p className={`wf-meta ${days <= alertDays ? 'warn' : ''}`}>{days <= alertDays && <BellRing size={11} aria-hidden className="inline-icon" />} Échéance dans {days} jour{days > 1 ? 's' : ''}</p>}
                {c.trialEnd && <p className="wf-meta">Essai{c.trialMonths ? ` de ${c.trialMonths} mois` : ""} jusqu’au {formatDate(c.trialEnd)}</p>}
                {c.closeReason && <p className="wf-meta danger">Clôturé : {c.closeReason}</p>}
                {c.note && <p className="wf-meta">{c.note}</p>}
              </>
            ),
          };
        })} />
      </FormCard>

      <FormCard icon={<FileSignature size={16} />} title="Parcours contractuel"
        subtitle="Tous les contrats signés par l’employé. Chaque ajout, renouvellement ou clôture est inscrit dans l’historique."
        actions={<>
          <button type="button" className="btn btn-sm btn-ghost" disabled={!canRenew} onClick={openRenew}
            title={canRenew ? `Renouveler le contrat ${describe(latest)}` : 'Le dernier contrat est clôturé : ajoutez un nouveau contrat.'}><RefreshCw size={13} aria-hidden /> Renouveler</button>
          <button type="button" className="btn btn-sm btn-ghost ct-danger" disabled={!current || contractStatus(current) !== 'actif'} onClick={() => current && setClosing(current)}>
            <Ban size={13} aria-hidden /> Clôturer
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={openNew}><FilePlus2 size={13} aria-hidden /> Nouveau contrat</button>
        </>}>
        <div className="table-wrap">
          <table className="table ct-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Nature</th>
                <th scope="col">Début</th>
                <th scope="col">Fin</th>
                <th scope="col">Période d’essai</th>
                <th scope="col">Statut</th>
                <th scope="col">Note</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const st = contractStatus(c);
                return (
                  <tr key={c.id} className={c.id === current?.id ? 'ct-current' : ''}>
                    <td><strong>{c.type}</strong><span className="block small text-muted">{contractTypeName(types, c.type)}</span></td>
                    <td><span className={`ct-kind ct-kind-${c.kind}`}>{CONTRACT_KIND_LABEL[c.kind ?? 'nouveau']}</span></td>
                    <td className="nowrap">{formatDate(c.start)}</td>
                    <td className="nowrap">
                      {c.closedAt ? <>{formatDate(c.closedAt)}<span className="block small text-danger">Clôture anticipée</span></>
                        : c.end ? formatDate(c.end) : <span className="text-muted">Indéterminée</span>}
                    </td>
                    <td className="nowrap">{c.trialEnd ? <>{c.trialMonths ? `${c.trialMonths} mois` : formatDate(c.trialEnd)}{c.trialMonths && <span className="block small text-muted">jusqu’au {formatDate(c.trialEnd)}</span>}</> : <span className="text-muted">Aucune</span>}</td>
                    <td><Badge tone={CONTRACT_STATUS[st].tone}>{CONTRACT_STATUS[st].label}</Badge></td>
                    <td className="ct-note">{c.closeReason ? <>{c.note && <>{c.note}<br /></>}<span className="text-muted">Motif de clôture : {c.closeReason}</span></> : c.note || <span className="text-muted">—</span>}</td>
                    <td className="actions">
                      {canRenew && c.id === latest.id && (
                        <button type="button" className="btn btn-sm btn-ghost ct-renew" title={c.end ? `Renouveler à partir du ${formatDate(addDays(c.end, 1))}` : "Renouveler ce contrat"}
                          aria-label={`Renouveler le contrat ${describe(c)}`} onClick={openRenew}><RefreshCw size={13} aria-hidden /> Renouveler</button>
                      )}
                      <button type="button" className="icon-btn icon-btn-sm" title="Modifier" aria-label={`Modifier le contrat ${describe(c)}`}
                        onClick={() => setDraft({ mode: 'edit', contract: c })}><Pencil size={14} /></button>
                      {st === 'actif' && (
                        <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" title="Clôturer" aria-label={`Clôturer le contrat ${describe(c)}`}
                          onClick={() => setClosing(c)}><Ban size={14} /></button>
                      )}
                      {c.kind !== 'initial' && (
                        <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" title="Supprimer" aria-label={`Supprimer le contrat ${describe(c)}`}
                          onClick={() => setRemoving(c)}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormCard>

      <StatusCard employee={employee} />

      <ContractModal draft={draft} list={list} onClose={() => setDraft(undefined)} onSave={(c, mode) => {
        // Renouvellement : le contrat renouvelé prend fin la veille du nouveau s'il courait au-delà.
        const prev = draft?.renewOf;
        const cut = (x: EmployeeContract) => (prev && x.id === prev.id && (!x.end || x.end >= c.start) ? { ...x, end: addDays(c.start, -1) } : x);
        const next = mode === 'edit' ? list.map((x) => (x.id === c.id ? c : x)) : [...list.map(cut), c];
        const label = mode === 'edit' ? `Contrat modifié : ${describe(c)}`
          : `${mode === 'renew' ? 'Renouvellement' : CONTRACT_KIND_LABEL[c.kind ?? 'nouveau']} : ${describe(c)}`;
        commit(next, label, mode === 'edit' ? 'Contrat mis à jour' : mode === 'renew' ? 'Contrat renouvelé' : 'Contrat ajouté');
        setDraft(undefined);
      }} />

      <CloseModal contract={closing} onClose={() => setClosing(undefined)} onConfirm={(date, reason) => {
        const c = closing!;
        commit(list.map((x) => (x.id === c.id ? { ...x, closedAt: date, closeReason: reason } : x)),
          `Clôture du contrat ${c.type} au ${formatDate(date)} — motif : ${reason}`, 'Contrat clôturé');
        setClosing(undefined);
      }} />

      <Modal open={!!removing} onClose={() => setRemoving(undefined)} title="Supprimer ce contrat ?" size="sm"
        footer={<>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={() => setRemoving(undefined)}>Annuler</button>
          <button type="button" className="btn btn-danger" onClick={() => {
            const c = removing!;
            commit(list.filter((x) => x.id !== c.id), `Contrat supprimé : ${describe(c)}`, 'Contrat supprimé');
            setRemoving(undefined);
          }}><Trash2 size={14} aria-hidden /> Supprimer</button>
        </>}>
        {removing && <p>Le contrat <strong>{describe(removing)}</strong> sera retiré du parcours. La suppression reste tracée dans l’historique de l’employé.</p>}
      </Modal>
    </div>
  );
}

// ------------------------------------------------------------------ Ajout, renouvellement, modification

function ContractModal({ draft, list, onClose, onSave }: {
  draft?: Draft; list: EmployeeContract[]; onClose: () => void; onSave: (c: EmployeeContract, mode: Draft['mode']) => void;
}) {
  const types = useCompanyData().contractTypes;
  const [c, setC] = useState<EmployeeContract>();
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    const x = draft?.contract;
    // Ancienne saisie (date de fin d'essai sans durée) : durée déduite, arrondie au mois.
    setC(x && x.trialEnd && !x.trialMonths ? { ...x, trialMonths: Math.max(1, Math.round((diffDays(x.start, x.trialEnd) + 1) / 30)) } : x);
    setSubmitted(false);
  }, [draft]);
  if (!draft || !c) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const set = <K extends keyof EmployeeContract>(k: K, v: EmployeeContract[K]) => setC((x) => (x ? { ...x, [k]: v } : x));
  const cdi = !isFixedTerm(types, c.type);
  // Un CDI terminé par un renouvellement garde sa date de fin.
  const noEnd = cdi && !draft.contract.end;
  const errors: Record<string, string> = {};
  if (!c.start) errors.start = 'Date de début requise.';
  if (!cdi && !c.end) errors.end = `Date de fin requise pour un ${c.type}.`;
  else if (!noEnd && c.end && c.start && c.end <= c.start) errors.end = 'La fin doit suivre le début.';
  const trialOn = c.trialMonths !== undefined;
  const trialEnd = trialOn && c.start && Number(c.trialMonths) > 0 ? trialEndOf(c.start, Number(c.trialMonths)) : undefined;
  if (trialOn && !(Number.isInteger(c.trialMonths) && c.trialMonths! >= 1 && c.trialMonths! <= 12)) errors.trialMonths = 'Entre 1 et 12 mois.';
  else if (trialEnd && !noEnd && c.end && trialEnd > c.end) errors.trialMonths = `La période d’essai (jusqu’au ${formatDate(trialEnd)}) dépasse la fin du contrat.`;
  const renewed = draft.renewOf;
  const overlap = c.start ? overlappingContract(list.filter((x) => x.id !== renewed?.id), c.start, noEnd ? undefined : c.end, c.id) : undefined;
  if (renewed && c.start && c.start <= renewed.start) errors.start = `Doit suivre le début du contrat renouvelé (${formatDate(renewed.start)}).`;
  if (overlap && !errors.start && !errors.end) errors.start = `Chevauche le contrat ${describe(overlap)}${overlap.closedAt ? '' : ' : clôturez-le ou ajustez les dates'}.`;
  const err = (k: string) => (submitted ? errors[k] : undefined);
  const title = draft.mode === 'renew' ? 'Renouveler le contrat' : draft.mode === 'edit' ? 'Modifier le contrat' : 'Nouveau contrat';

  return (
    <Modal open onClose={onClose} title={title} size="md"
      footer={<>
        {submitted && Object.keys(errors).length > 0 && <span className="footer-note text-danger">{Object.keys(errors).length} champ(s) à corriger</span>}
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button type="button" className="btn btn-primary" onClick={() => {
          setSubmitted(true);
          if (Object.keys(errors).length) return;
          onSave({ ...c, end: noEnd ? undefined : c.end, trialMonths: trialOn ? c.trialMonths : undefined, trialEnd, note: c.note?.trim() || undefined }, draft.mode);
        }}>{draft.mode === 'renew' ? <><RefreshCw size={14} aria-hidden /> Renouveler</> : 'Enregistrer'}</button>
      </>}>
      {draft.mode === 'renew' && (
        <p className="fnote mb-12"><CalendarClock size={13} aria-hidden /> {draft.renewOf?.end ? 'Le renouvellement démarre le lendemain de l’échéance du contrat actuel.' : `Le contrat ${draft.renewOf?.type ?? ''} actuel prendra fin la veille du début du renouvellement.`}</p>
      )}
      <div className="form-grid">
        <Field label="Type de contrat" required>
          {(id) => (
            <select id={id} value={c.type} onChange={(e) => { const type = e.target.value; setC((x) => (x ? { ...x, type, trialMonths: draft.mode === 'edit' ? x.trialMonths : contractTypeDef(types, type)?.trialMonths } : x)); }}>
              {types.filter((t) => !t.archived || t.code === c.type).map((t) => <option key={t.id} value={t.code}>{t.name} ({t.code})</option>)}
            </select>
          )}
        </Field>
        <Field label="Nature" required>
          {(id) => (
            <select id={id} value={c.kind ?? 'nouveau'} disabled={c.kind === 'initial' || draft.mode === 'renew'} onChange={(e) => set('kind', e.target.value as ContractKind)}>
              {(Object.keys(CONTRACT_KIND_LABEL) as ContractKind[]).filter((k) => k !== 'initial' || c.kind === 'initial').map((k) => <option key={k} value={k}>{CONTRACT_KIND_LABEL[k]}</option>)}
            </select>
          )}
        </Field>
        <Field label="Date de début" required error={err('start')}>{(id) => <input id={id} type="date" value={c.start} onChange={(e) => set('start', e.target.value)} />}</Field>
        <Field label="Date de fin" required={!cdi} error={err('end')} hint={noEnd ? 'Sans objet : contrat à durée indéterminée.' : undefined}>
          {(id) => <input id={id} type="date" value={noEnd ? '' : c.end ?? ''} disabled={noEnd} min={c.start} onChange={(e) => set('end', e.target.value || undefined)} />}
        </Field>
        <div className="span-2 trial-box">
          <label className="fcheck">
            <input type="checkbox" checked={trialOn} onChange={(e) => set('trialMonths', e.target.checked ? contractTypeDef(types, c.type)?.trialMonths ?? 1 : undefined)} />
            Ce contrat comporte une période d’essai
          </label>
          {trialOn && (
            <div className="trial-row">
              <Field label="Durée de la période d’essai" required error={err('trialMonths')}>
                {(id) => <span className="input-suffix"><input id={id} type="number" min={1} max={12} step={1} value={c.trialMonths ?? ''} onChange={(e) => set('trialMonths', e.target.value === '' ? 0 : Number(e.target.value))} /><span aria-hidden>mois</span></span>}
              </Field>
              {trialEnd && <p className="trial-end">Fin de la période d’essai : <strong>{formatDate(trialEnd)}</strong></p>}
            </div>
          )}
        </div>
        <Field label="Note / objet" className="span-2">
          {(id) => <textarea id={id} rows={2} value={c.note ?? ''} placeholder="Ex. : avenant de passage à temps plein, renouvellement pour surcroît d’activité…" onChange={(e) => set('note', e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Clôture anticipée

function CloseModal({ contract, onClose, onConfirm }: { contract?: EmployeeContract; onClose: () => void; onConfirm: (date: string, reason: string) => void }) {
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { setDate(TODAY); setReason(''); setSubmitted(false); }, [contract]);

  const errors: Record<string, string> = {};
  if (contract) {
    if (!date) errors.date = 'Date requise.';
    else if (date < contract.start) errors.date = 'Postérieure au début du contrat.';
    else if (contract.end && date > contract.end) errors.date = 'Antérieure à l’échéance prévue.';
  }
  if (!reason.trim()) errors.reason = 'Motif requis.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  return (
    <Modal open={!!contract} onClose={onClose} title="Clôturer le contrat" size="sm"
      footer={<>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button type="button" className="btn btn-danger" onClick={() => { setSubmitted(true); if (!Object.keys(errors).length) onConfirm(date, reason.trim()); }}>
          <Ban size={14} aria-hidden /> Clôturer
        </button>
      </>}>
      {contract && (
        <div className="fstack-sm">
          <p className="small">Contrat <strong>{describe(contract)}</strong>. La date saisie devient sa date de fin effective.</p>
          <Field label="Date de fin effective" required error={err('date')}>
            {(id) => <input id={id} type="date" value={date} min={contract.start} max={contract.end} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Motif" required error={err('reason')}>
            {(id) => (
              <select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Sélectionner…</option>
                {['Démission', 'Rupture conventionnelle', 'Licenciement', 'Fin de période d’essai', 'Remplacé par un nouveau contrat', 'Autre'].map((m) => <option key={m}>{m}</option>)}
              </select>
            )}
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ Statut de l'employé (RH-12)

function StatusCard({ employee }: { employee: Employee }) {
  const { setHrStatus, toast } = useStore();
  const current = hrStatusOf(employee);
  const timeline = statusTimeline(employee);
  const [f, setF] = useState({ status: current, since: TODAY, departureType: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { setF({ status: hrStatusOf(employee), since: TODAY, departureType: '', reason: '' }); setSubmitted(false); }, [employee.id, employee.hrStatus]);

  const departure = !!HR_STATUS[f.status].departure;
  const errors: Record<string, string> = {};
  if (f.status === current) errors.status = 'Choisissez un statut différent du statut actuel.';
  if (!f.since) errors.since = 'Date d’effet requise.';
  else if (f.since < employee.hireDate) errors.since = 'Postérieure à la date d’embauche.';
  if (departure && !f.departureType) errors.departureType = 'Type de départ requis.';
  if (!f.reason.trim() && (departure || f.status === 'suspendu')) errors.reason = 'Motif requis pour ce statut.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    setHrStatus(employee.id, { id: newId('st'), status: f.status, since: f.since, departureType: departure ? f.departureType : undefined, reason: f.reason.trim() || undefined });
    toast(`Statut : ${HR_STATUS[f.status].label}${f.since > TODAY ? ` à compter du ${formatDate(f.since)}` : ''}`);
  };

  return (
    <FormCard icon={<UserCog size={16} />} title="Statut de l’employé"
      subtitle="Chaque changement est daté et inscrit dans l’historique ; un statut de départ effectif ferme l’accès aux demandes."
      actions={<Badge tone={HR_STATUS[current].tone}>{HR_STATUS[current].label}</Badge>}>
      <Workflow label="Parcours du statut" steps={timeline.map((s, i) => {
        const next = timeline[i + 1];
        return {
          id: s.id,
          state: s.since > TODAY ? 'next' : next && next.since <= TODAY ? 'past' : 'current',
          content: (
            <>
              <div className="wf-card-top"><Badge tone={HR_STATUS[s.status].tone}>{HR_STATUS[s.status].label}</Badge></div>
              <p className="wf-dates">{s.since > TODAY ? 'À compter du' : 'Depuis le'} {formatDate(s.since)}</p>
              {s.departureType && <p className="wf-meta">{s.departureType}</p>}
              {s.reason && <p className="wf-meta">{s.reason}</p>}
            </>
          ),
        };
      })} />

      <div className="st-form">
        <Field label="Nouveau statut" required error={err('status')}>
          {(id) => (
            <select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as HrStatus, departureType: '' })}>
              {HR_STATUS_ORDER.map((k) => <option key={k} value={k}>{HR_STATUS[k].label}{k === current ? ' (actuel)' : ''}</option>)}
            </select>
          )}
        </Field>
        <Field label="Date d’effet" required error={err('since')} hint="Pré-remplie à aujourd’hui, modifiable.">
          {(id) => <input id={id} type="date" value={f.since} min={employee.hireDate} onChange={(e) => setF({ ...f, since: e.target.value })} />}
        </Field>
        <Field label="Type de départ" required={departure} error={err('departureType')} hint={departure ? undefined : 'Uniquement pour un préavis ou un départ.'}>
          {(id) => (
            <select id={id} value={f.departureType} disabled={!departure} onChange={(e) => setF({ ...f, departureType: e.target.value })}>
              <option value="">{departure ? 'Sélectionner…' : '—'}</option>
              {DEPARTURE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          )}
        </Field>
        <Field label="Motif" required={departure || f.status === 'suspendu'} error={err('reason')} className="st-reason">
          {(id) => <input id={id} value={f.reason} placeholder="Précisions…" onChange={(e) => setF({ ...f, reason: e.target.value })} />}
        </Field>
        <button type="button" className="btn btn-primary st-save" onClick={save}><Save size={14} aria-hidden /> Enregistrer le statut</button>
      </div>
    </FormCard>
  );
}
