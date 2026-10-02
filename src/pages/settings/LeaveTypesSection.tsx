// Types de congé : imputés sur le solde annuel ou hors solde annuel.
import { useEffect, useState } from 'react';
import { Pencil, Star, Wallet, WalletCards } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, Badge, ColorField, Field, Modal } from '../../components/ui';
import { ArchivableTable, yesNo, type Column } from '../../components/settingsKit';
import type { LeaveType } from '../../types';
import { annualReferenceType } from '../../utils/leave';

export function LeaveTypesSection() {
  const { db, companyId } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ type?: LeaveType; deducts: boolean }>();
  const ref = annualReferenceType(db, companyId);
  const annualQuota = data.leaveRules.find((r) => r.leaveTypeId === ref?.id && !r.archived)?.annualQuota;
  const quotaOf = (t: LeaveType) => data.leaveRules.find((r) => r.leaveTypeId === t.id && !r.archived)?.annualQuota;
  const count = (t: LeaveType) => data.requests.filter((r) => r.leaveTypeId === t.id).length;

  const nameCol: Column<LeaveType> = {
    header: 'Type',
    render: (t) => (
      <span className="type-tag">
        <span className="type-dot" style={{ background: t.color }} aria-hidden />
        <span className="person-name">{t.name}</span>
        {t.annualReference && <Badge tone="primary" icon={<Star size={11} aria-hidden />}>Référence du solde</Badge>}
      </span>
    ),
  };
  const common: Column<LeaveType>[] = [
    { header: 'Code', render: (t) => <span className="mono">{t.code}</span> },
    { header: 'Unité', render: (t) => (t.unit === 'heure' ? <span className="unit-chip hours">Heures</span> : <span className="unit-chip">Jours</span>) },
    { header: 'Rémunéré', render: (t) => yesNo(t.paid) },
    { header: 'Justificatif conseillé', render: (t) => yesNo(t.requiresProof) },
    { header: 'Demi-journée', render: (t) => yesNo(t.allowHalfDay) },
    { header: 'Demandes', className: 'num', render: count },
  ];
  const edit = (t: LeaveType) => (
    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ type: t, deducts: t.deductsFromAnnual })} aria-label={`Modifier ${t.name}`}>
      <Pencil size={13} aria-hidden /> Modifier
    </button>
  );

  return (
    <div className="stack">
      <div className="balance-explainer">
        <span className="balance-explainer-icon" aria-hidden><Wallet size={18} /></span>
        <p>
          Le <strong>solde annuel</strong> ({annualQuota != null ? `${String(annualQuota).replace('.', ',')} j/an` : 'quota à définir'} + report) est porté par
          « {ref?.name ?? '—'} ». Les types cochés « Déduit du solde annuel » consomment ce même solde :
          avec 21 jours disponibles, un congé imputé de 5 jours laisse 16 jours. Les types hors solde ne le modifient pas.
        </p>
      </div>

      <ArchivableTable
        title="Imputés sur le solde annuel" addLabel="Ajouter un type imputé" collection="leaveTypes"
        onAdd={() => setEditing({ deducts: true })}
        description="Chaque jour posé est déduit du solde annuel de l’employé."
        rows={data.leaveTypes.filter((t) => t.deductsFromAnnual)} nameOf={(t) => t.name} rowActions={edit}
        emptyText="Aucun type imputé sur le solde annuel."
        columns={[nameCol, ...common]}
      />

      <ArchivableTable
        title="Hors solde annuel" addLabel="Ajouter un type hors solde" collection="leaveTypes"
        onAdd={() => setEditing({ deducts: false })}
        description="Ces absences n’entament pas le solde annuel. Elles peuvent avoir leur propre plafond (Règles et quotas)."
        rows={data.leaveTypes.filter((t) => !t.deductsFromAnnual)} nameOf={(t) => t.name} rowActions={edit}
        emptyText="Aucun type hors solde."
        columns={[nameCol,
          { header: 'Plafond propre', render: (t) => (t.tracked && quotaOf(t) != null ? `${String(quotaOf(t)).replace('.', ',')} j/an` : <span className="text-muted">Sans plafond</span>) },
          ...common]}
      />

      <LeaveTypeModal state={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
}

interface FormState {
  name: string; code: string; color: string;
  deductsFromAnnual: boolean; paid: boolean; requiresProof: boolean; allowHalfDay: boolean; hours: boolean;
  ownCap: boolean; capDays: string;
}

function LeaveTypeModal({ state, onClose }: { state?: { type?: LeaveType; deducts: boolean }; onClose: () => void }) {
  const { db, companyId, addItem, updateItem, toast } = useStore();
  const type = state?.type;
  const rule = type ? db.leaveRules.find((r) => r.leaveTypeId === type.id && !r.archived) : undefined;
  const [f, setF] = useState<FormState>();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    setF({
      name: type?.name ?? '', code: type?.code ?? '', color: type?.color ?? '#b45309',
      deductsFromAnnual: type?.deductsFromAnnual ?? state.deducts,
      paid: type?.paid ?? true, requiresProof: type?.requiresProof ?? false, allowHalfDay: type?.allowHalfDay ?? true, hours: type?.unit === 'heure',
      ownCap: !!type?.tracked, capDays: rule?.annualQuota != null ? String(rule.annualQuota) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state || !f) return null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const isRef = !!type?.annualReference;
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Libellé requis.';
  if (!f.code.trim()) errors.code = 'Code requis.';
  if (!f.deductsFromAnnual && f.ownCap && !(Number(f.capDays) > 0)) errors.cap = 'Indiquez un nombre de jours.';

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const ownCap = !f.deductsFromAnnual && f.ownCap;
    const saved: LeaveType = {
      ...(type ?? { id: newId('lt'), companyId }),
      name: f.name.trim(), code: f.code.trim().toUpperCase(), color: f.color,
      paid: f.paid, requiresProof: f.requiresProof, allowHalfDay: f.hours ? false : f.allowHalfDay, unit: f.hours ? 'heure' : 'jour',
      deductsFromAnnual: isRef ? true : f.deductsFromAnnual, tracked: ownCap,
    };
    if (type) updateItem('leaveTypes', saved); else addItem('leaveTypes', saved);
    // Plafond propre : crée ou met à jour la règle correspondante.
    if (ownCap) {
      if (rule) updateItem('leaveRules', { ...rule, annualQuota: Number(f.capDays) });
      else addItem('leaveRules', { id: newId('r'), companyId, leaveTypeId: saved.id, label: `${saved.name} — plafond`, annualQuota: Number(f.capDays), accrual: 'Annuel', maxCarryOver: 0, minNoticeDays: 0, scope: 'Tous les employés' });
    }
    toast(`${saved.name} : ${saved.deductsFromAnnual ? 'déduit du solde annuel' : 'hors solde annuel'}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={type ? `Modifier « ${type.name} »` : 'Nouveau type de congé'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{type ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <div className="form-grid">
        <Field label="Libellé" required className="span-2" error={submitted ? errors.name : undefined}>
          {(id) => <input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. : Congé maladie" />}
        </Field>
        <Field label="Code" required error={submitted ? errors.code : undefined}>{(id) => <input id={id} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="MAL" />}</Field>
        <Field label="Couleur">{(id) => <ColorField id={id} value={f.color} onChange={(v) => set('color', v)} />}</Field>
      </div>

      <fieldset className="form-section mt-16">
        <legend>Impact sur le solde</legend>
        <div className="deduct-choice" role="radiogroup" aria-label="Impact sur le solde annuel">
          <label className={`deduct-option ${f.deductsFromAnnual ? 'checked' : ''}`}>
            <input type="radio" name="deduct" checked={f.deductsFromAnnual} onChange={() => set('deductsFromAnnual', true)} />
            <Wallet size={18} aria-hidden />
            <span><span className="person-name">Déduit du solde annuel</span><span className="block small text-muted">Ex. : solde de 21 j, congé de 5 j → il reste 16 j.</span></span>
          </label>
          <label className={`deduct-option ${!f.deductsFromAnnual ? 'checked' : ''} ${isRef ? 'disabled' : ''}`}>
            <input type="radio" name="deduct" checked={!f.deductsFromAnnual} disabled={isRef} onChange={() => set('deductsFromAnnual', false)} />
            <WalletCards size={18} aria-hidden />
            <span><span className="person-name">Hors solde annuel</span><span className="block small text-muted">Ex. : solde de 21 j, congé de 5 j → le solde reste 21 j.</span></span>
          </label>
        </div>
        {isRef && <p className="small text-muted mt-8">Ce type porte le solde annuel : il est forcément imputé.</p>}
        {!f.deductsFromAnnual && (
          <div className="cap-row">
            <label className="check"><input type="checkbox" checked={f.ownCap} onChange={(e) => set('ownCap', e.target.checked)} /> Limiter avec un plafond propre</label>
            {f.ownCap && (
              <Field label="Jours par an" error={submitted ? errors.cap : undefined}>
                {(id) => <input id={id} type="number" min={0.5} step={0.5} value={f.capDays} onChange={(e) => set('capDays', e.target.value)} />}
              </Field>
            )}
          </div>
        )}
        {type && type.deductsFromAnnual !== f.deductsFromAnnual && (
          <Alert tone="warning" title="Changement d’imputation">Les soldes seront recalculés, y compris pour les demandes déjà posées avec ce type (démonstration).</Alert>
        )}
      </fieldset>

      <fieldset className="form-section">
        <legend>Options</legend>
        <div className="check-col">
          <label className="check"><input type="checkbox" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} /> Congé rémunéré</label>
          <label className="check"><input type="checkbox" checked={f.requiresProof} onChange={(e) => set('requiresProof', e.target.checked)} /> Justificatif conseillé (jamais bloquant)</label>
          <label className="check"><input type="checkbox" checked={f.hours} onChange={(e) => set('hours', e.target.checked)} /> Autorisation en heures (décomptée selon les créneaux de l’horaire)</label>
          {!f.hours && <label className="check"><input type="checkbox" checked={f.allowHalfDay} onChange={(e) => set('allowHalfDay', e.target.checked)} /> Autoriser les demi-journées</label>}
        </div>
      </fieldset>
    </Modal>
  );
}
