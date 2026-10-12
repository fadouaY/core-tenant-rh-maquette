// Types de contrat de la société (RH-7) : proposés dans la fiche employé et l'onglet Contrats.
import { useEffect, useState } from 'react';
import { BellRing, Pencil, Save } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Badge, Field, Modal, Switch } from '../../components/ui';
import { ArchivableTable } from '../../components/settingsKit';
import type { ContractTypeDef } from '../../types';
import { contractsOf, effectiveEnd, expiringContracts, expiryAlertDays } from '../../utils/contracts';
import { formatDate } from '../../utils/dates';
import { FormCard } from '../../components/FormCard';

/** Code et intitulé uniques ; un type archivé n'est plus proposé, les contrats existants le conservent. */
export function ContractTypesSection() {
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ type?: ContractTypeDef }>();
  // Contrats (tous parcours confondus) utilisant chaque type.
  const usage = (code: string) => data.employees.reduce((n, e) => n + contractsOf(e).filter((c) => c.type === code).length, 0);

  return (
    <div className="fstack">
      <ExpiryAlertCard />
      <ArchivableTable
        title="Types de contrat" addLabel="Ajouter un type" collection="contractTypes" onAdd={() => setEditing({})}
        description="Types proposés à la création d’un employé et dans son parcours contractuel. Un type à durée déterminée exige une date de fin ; la période d’essai indiquée est proposée par défaut. Un type archivé n’est plus proposé, les contrats existants le conservent."
        rows={data.contractTypes} nameOf={(t) => t.name}
        archiveBlockedBy={(t) => (data.contractTypes.filter((x) => !x.archived).length <= 1 ? `Impossible d’archiver « ${t.name} » : au moins un type actif est nécessaire.` : undefined)}
        rowActions={(t) => (
          <button type="button" className="btn btn-sm btn-ghost" disabled={t.archived} onClick={() => setEditing({ type: t })} aria-label={`Modifier ${t.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
        )}
        columns={[
          { header: 'Code', render: (t) => <span className="mono"><strong>{t.code}</strong></span> },
          { header: 'Type de contrat', render: (t) => <span className="person-name">{t.name}</span> },
          { header: 'Durée', render: (t) => (t.fixedTerm ? <Badge tone="info">Déterminée</Badge> : <Badge tone="success">Indéterminée</Badge>) },
          { header: 'Renouvelable', render: (t) => (t.renewable ? <Badge tone="neutral">Oui</Badge> : <span className="text-muted">Non</span>) },
          { header: 'Période d’essai', render: (t) => (t.trialMonths ? `${t.trialMonths} mois` : <span className="text-muted">Aucune</span>) },
          { header: 'Contrats', className: 'num', render: (t) => <span className="num">{usage(t.code)}</span> },
        ]}
      />
      <ContractTypeModal state={editing} usage={usage} onClose={() => setEditing(undefined)} />
    </div>
  );
}

function ContractTypeModal({ state, usage, onClose }: { state?: { type?: ContractTypeDef }; usage: (code: string) => number; onClose: () => void }) {
  const { companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const type = state?.type;
  const [f, setF] = useState({ code: '', name: '', fixedTerm: true, renewable: true, trial: false, trialMonths: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    setF({ code: type?.code ?? '', name: type?.name ?? '', fixedTerm: type?.fixedTerm ?? true, renewable: type?.renewable ?? true, trial: !!type?.trialMonths, trialMonths: type?.trialMonths ? String(type.trialMonths) : '' });
  }, [state, type]);
  if (!state) return null;

  const used = type ? usage(type.code) : 0;
  const others = data.contractTypes.filter((t) => t.id !== type?.id);
  const code = f.code.trim().toUpperCase() === 'STAGE' ? 'Stage' : f.code.trim().toUpperCase();
  const errors: Record<string, string> = {};
  if (!/^[A-Za-z0-9_-]{2,12}$/.test(f.code.trim())) errors.code = 'De 2 à 12 lettres, chiffres, « - » ou « _ ».';
  else if (others.some((t) => t.code.toUpperCase() === code.toUpperCase())) errors.code = 'Ce code est déjà utilisé.';
  if (!f.name.trim()) errors.name = 'Intitulé requis.';
  else if (others.some((t) => t.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errors.name = 'Ce type existe déjà.';
  if (f.trial && !(Number.isInteger(Number(f.trialMonths)) && Number(f.trialMonths) >= 1 && Number(f.trialMonths) <= 12)) errors.trialMonths = 'Entre 1 et 12 mois.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const saved: ContractTypeDef = {
      ...(type ?? { id: newId('ct'), companyId }),
      code, name: f.name.trim(), fixedTerm: f.fixedTerm, renewable: f.renewable, trialMonths: f.trial ? Number(f.trialMonths) : undefined,
    };
    if (type) updateItem('contractTypes', saved); else addItem('contractTypes', saved);
    toast(`Type de contrat « ${saved.name} » ${type ? 'mis à jour' : 'ajouté'}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={type ? `Modifier « ${type.name} »` : 'Nouveau type de contrat'}
      footer={<><span className="spacer" /><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{type ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <div className="form-grid">
        <Field label="Code" required error={err('code')} hint={used ? `Utilisé par ${used} contrat(s) : non modifiable.` : 'Ex. : CDI, CDD, ANAPEC.'}>
          {(id) => <input id={id} className="mono" value={f.code} disabled={used > 0} maxLength={12} onChange={(e) => setF({ ...f, code: e.target.value })} />}
        </Field>
        <Field label="Intitulé" required error={err('name')}>
          {(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Contrat à durée déterminée" />}
        </Field>
      </div>
      <div className="fstack-sm mt-12">
        <Switch checked={f.fixedTerm} onChange={(v) => setF({ ...f, fixedTerm: v })} label="Contrat à durée déterminée (date de fin obligatoire)" />
        <Switch checked={f.renewable} onChange={(v) => setF({ ...f, renewable: v })} label="Renouvelable" />
        <Switch checked={f.trial} onChange={(v) => setF({ ...f, trial: v, trialMonths: v && !f.trialMonths ? '1' : f.trialMonths })} label="Ce contrat comporte une période d’essai" />
        {f.trial && (
          <div className="trial-months">
            <Field label="Durée de la période d’essai" required error={err('trialMonths')} hint="Proposée par défaut à chaque nouveau contrat de ce type.">
              {(id) => <span className="input-suffix"><input id={id} type="number" min={1} max={12} step={1} value={f.trialMonths} onChange={(e) => setF({ ...f, trialMonths: e.target.value })} /><span aria-hidden>mois</span></span>}
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Alerte d'expiration : délai (en jours) avant l'échéance d'un contrat où l'utilisateur est notifié. */
function ExpiryAlertCard() {
  const { companyId, setContractPolicy, toast } = useStore();
  const data = useCompanyData();
  const saved = expiryAlertDays(data.contractPolicies, companyId);
  const [days, setDays] = useState(String(saved));
  useEffect(() => setDays(String(saved)), [saved, companyId]);
  const value = Number(days);
  const valid = Number.isInteger(value) && value >= 1 && value <= 180;
  const soon = expiringContracts(data.employees, valid ? value : saved);

  return (
    <FormCard icon={<BellRing size={16} />} title="Alerte d’expiration des contrats"
      subtitle="Une notification est envoyée lorsqu’un contrat à durée déterminée arrive à échéance dans ce délai.">
      <div className="exp-alert">
        <Field label="Notifier avant l’échéance" required error={valid ? undefined : 'Entre 1 et 180 jours.'}>
          {(id) => <span className="input-suffix"><input id={id} type="number" min={1} max={180} step={1} value={days} onChange={(e) => setDays(e.target.value)} /><span aria-hidden>jours</span></span>}
        </Field>
        <button type="button" className="btn btn-primary exp-alert-btn" disabled={!valid || value === saved}
          onClick={() => { setContractPolicy({ companyId, expiryAlertDays: value }); toast(`Alerte fixée à ${value} jours avant l’échéance`); }}>
          <Save size={14} aria-hidden /> Enregistrer
        </button>
        <p className="exp-alert-count">
          {soon.length === 0 ? 'Aucun contrat n’arrive à échéance dans ce délai.' : <><strong>{soon.length}</strong> contrat{soon.length > 1 ? 's' : ''} concerné{soon.length > 1 ? 's' : ''} actuellement :</>}
        </p>
      </div>
      {soon.length > 0 && (
        <ul className="exp-list">
          {soon.map(({ employee, contract, left }) => (
            <li key={contract.id}>
              <a className="link" href={`#/employes/${employee.id}`}>{employee.firstName} {employee.lastName}</a>
              <span className="text-muted small">{contract.type} · fin le {formatDate(effectiveEnd(contract)!)}</span>
              <Badge tone={left <= 7 ? 'danger' : 'warning'}>{left === 0 ? 'Aujourd’hui' : `Dans ${left} j`}</Badge>
            </li>
          ))}
        </ul>
      )}
    </FormCard>
  );
}
