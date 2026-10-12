// Onglet « Contrats » de la fiche employé (RH-7) : synthèse du parcours, liste des contrats,
// ajout, renouvellement, modification, clôture anticipée et suppression, chaque action étant historisée.
import { useEffect, useState } from 'react';
import { Ban, CalendarClock, FilePlus2, FileSignature, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { newId, useStore } from '../../store';
import type { ContractKind, ContractType, Employee, EmployeeContract } from '../../types';
import { addDays, diffDays, formatDate, TODAY } from '../../utils/dates';
import {
  activeContract, CONTRACT_KIND_LABEL, CONTRACT_STATUS, CONTRACT_TYPE_LABEL, contractsOf, contractStatus, effectiveEnd, overlappingContract,
} from '../../utils/contracts';
import { Badge, Field, Modal } from '../../components/ui';
import { FormCard } from '../../components/FormCard';

const describe = (c: EmployeeContract) =>
  `${c.type} du ${formatDate(c.start)}${c.end ? ` au ${formatDate(c.end)}` : ' (durée indéterminée)'}`;

type Draft = { mode: 'new' | 'renew' | 'edit'; contract: EmployeeContract; /** Renouvellement : contrat renouvelé, qui prend fin la veille du nouveau. */ renewOf?: EmployeeContract };

export function ContractsTab({ employee }: { employee: Employee }) {
  const { saveContracts, toast } = useStore();
  const list = contractsOf(employee);
  const current = activeContract(list);
  const initial = list.find((c) => c.kind === 'initial');
  const renewals = list.filter((c) => c.kind === 'renouvellement').length;
  const amendments = list.filter((c) => c.kind === 'avenant').length;
  const lastChange = list.find((c) => c.kind !== 'initial');
  const [draft, setDraft] = useState<Draft>();
  const [closing, setClosing] = useState<EmployeeContract>();
  const [removing, setRemoving] = useState<EmployeeContract>();

  const left = current && effectiveEnd(current) ? diffDays(TODAY, effectiveEnd(current)!) : undefined;
  // Le dernier contrat du parcours se renouvelle tant qu'il n'est pas clôturé (CDI compris : il prend fin la veille du nouveau).
  const latest = list[0];
  const canRenew = !!latest && !latest.closedAt;

  const commit = (next: EmployeeContract[], label: string, message: string) => {
    saveContracts(employee.id, next, label);
    toast(message);
  };

  const openNew = () => setDraft({ mode: 'new', contract: { id: newId('ctr'), kind: 'nouveau', type: 'CDI', start: current?.end ? addDays(current.end, 1) : TODAY } });
  const openRenew = () => canRenew && setDraft({
    mode: 'renew',
    renewOf: latest,
    contract: { id: newId('ctr'), kind: 'renouvellement', type: latest.type, start: latest.end ? addDays(latest.end, 1) : TODAY },
  });

  return (
    <div className="fstack">
      {/* Synthèse : premier contrat, renouvellements, contrat actif */}
      <div className="ct-summary">
        <section className="ct-card">
          <header><span>Premier contrat</span><Badge tone="primary">Contrat initial</Badge></header>
          {initial ? (
            <>
              <p className="ct-card-title">{CONTRACT_TYPE_LABEL[initial.type]} <span>({initial.type})</span></p>
              <dl className="ct-card-list">
                <div><dt>Date d’effet</dt><dd>{formatDate(initial.start)}</dd></div>
                <div><dt>Date de fin</dt><dd>{initial.end ? formatDate(initial.end) : 'Indéterminée'}</dd></div>
                <div><dt>Période d’essai</dt><dd>{initial.trialEnd ? `Jusqu’au ${formatDate(initial.trialEnd)}` : '—'}</dd></div>
                <div><dt>Statut</dt><dd><Badge tone={CONTRACT_STATUS[contractStatus(initial)].tone}>{CONTRACT_STATUS[contractStatus(initial)].label}</Badge></dd></div>
              </dl>
            </>
          ) : <p className="ct-card-empty">Aucun contrat initial.</p>}
        </section>

        <section className="ct-card">
          <header><span>Renouvellements et avenants</span><Badge tone={renewals + amendments ? 'info' : 'muted'}>{renewals + amendments ? 'Évolutions' : 'Aucune évolution'}</Badge></header>
          <p className="ct-card-figure">{renewals + amendments}<small>évolution{renewals + amendments > 1 ? 's' : ''} du contrat</small></p>
          <dl className="ct-card-list">
            <div><dt>Renouvellements</dt><dd>{renewals}</dd></div>
            <div><dt>Avenants</dt><dd>{amendments}</dd></div>
            <div><dt>Dernière évolution</dt><dd>{lastChange ? `${CONTRACT_KIND_LABEL[lastChange.kind ?? 'nouveau']} — ${formatDate(lastChange.start)}` : 'Contrat initial non renouvelé'}</dd></div>
          </dl>
        </section>

        <section className={`ct-card ${current && contractStatus(current) === 'actif' ? 'is-active' : 'is-none'}`}>
          <header><span>Contrat actif</span>{current && <Badge tone={CONTRACT_STATUS[contractStatus(current)].tone}>{CONTRACT_STATUS[contractStatus(current)].label}</Badge>}</header>
          {current ? (
            <>
              <p className="ct-card-title">{CONTRACT_TYPE_LABEL[current.type]} <span>({current.type})</span></p>
              <dl className="ct-card-list">
                <div><dt>Date de début</dt><dd>{formatDate(current.start)}</dd></div>
                <div><dt>Date de fin</dt><dd>{effectiveEnd(current) ? formatDate(effectiveEnd(current)!) : 'Indéterminée'}</dd></div>
                {left !== undefined && left >= 0 && (
                  <div><dt>Échéance</dt><dd className={left <= 30 ? 'warn' : ''}>{left === 0 ? 'Aujourd’hui' : `Dans ${left} jour${left > 1 ? 's' : ''}`}</dd></div>
                )}
                <div><dt>Note</dt><dd>{current.note || <span className="text-muted">—</span>}</dd></div>
              </dl>
            </>
          ) : <p className="ct-card-empty">Aucun contrat actif.</p>}
        </section>
      </div>

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
                    <td><strong>{c.type}</strong><span className="block small text-muted">{CONTRACT_TYPE_LABEL[c.type]}</span></td>
                    <td><span className={`ct-kind ct-kind-${c.kind}`}>{CONTRACT_KIND_LABEL[c.kind ?? 'nouveau']}</span></td>
                    <td className="nowrap">{formatDate(c.start)}</td>
                    <td className="nowrap">
                      {c.closedAt ? <>{formatDate(c.closedAt)}<span className="block small text-danger">Clôture anticipée</span></>
                        : c.end ? formatDate(c.end) : <span className="text-muted">Indéterminée</span>}
                    </td>
                    <td className="nowrap">{c.trialEnd ? formatDate(c.trialEnd) : <span className="text-muted">—</span>}</td>
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
  const [c, setC] = useState<EmployeeContract>();
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { setC(draft?.contract); setSubmitted(false); }, [draft]);
  if (!draft || !c) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const set = <K extends keyof EmployeeContract>(k: K, v: EmployeeContract[K]) => setC((x) => (x ? { ...x, [k]: v } : x));
  const cdi = c.type === 'CDI';
  // Un CDI terminé par un renouvellement garde sa date de fin.
  const noEnd = cdi && !draft.contract.end;
  const errors: Record<string, string> = {};
  if (!c.start) errors.start = 'Date de début requise.';
  if (!cdi && !c.end) errors.end = `Date de fin requise pour un ${c.type}.`;
  else if (!noEnd && c.end && c.start && c.end <= c.start) errors.end = 'La fin doit suivre le début.';
  if (c.trialEnd && (c.trialEnd <= c.start || (!cdi && c.end && c.trialEnd > c.end))) errors.trialEnd = 'Comprise dans la durée du contrat.';
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
          onSave({ ...c, end: noEnd ? undefined : c.end, note: c.note?.trim() || undefined }, draft.mode);
        }}>{draft.mode === 'renew' ? <><RefreshCw size={14} aria-hidden /> Renouveler</> : 'Enregistrer'}</button>
      </>}>
      {draft.mode === 'renew' && (
        <p className="fnote mb-12"><CalendarClock size={13} aria-hidden /> {draft.renewOf?.end ? 'Le renouvellement démarre le lendemain de l’échéance du contrat actuel.' : `Le contrat ${draft.renewOf?.type ?? ''} actuel prendra fin la veille du début du renouvellement.`}</p>
      )}
      <div className="form-grid">
        <Field label="Type de contrat" required>
          {(id) => (
            <select id={id} value={c.type} onChange={(e) => set('type', e.target.value as ContractType)}>
              {(Object.keys(CONTRACT_TYPE_LABEL) as ContractType[]).map((k) => <option key={k} value={k}>{CONTRACT_TYPE_LABEL[k]} ({k})</option>)}
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
        <Field label="Date de fin" required={!cdi} error={err('end')} hint={noEnd ? 'Sans objet pour un CDI.' : undefined}>
          {(id) => <input id={id} type="date" value={noEnd ? '' : c.end ?? ''} disabled={noEnd} min={c.start} onChange={(e) => set('end', e.target.value || undefined)} />}
        </Field>
        <Field label="Fin de la période d’essai" error={err('trialEnd')} hint="Facultatif.">
          {(id) => <input id={id} type="date" value={c.trialEnd ?? ''} min={c.start} onChange={(e) => set('trialEnd', e.target.value || undefined)} />}
        </Field>
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
