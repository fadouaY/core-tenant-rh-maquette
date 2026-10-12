// Paramètres d'organisation : départements et sous-départements (RH-14), fonctions.
import { useEffect, useState } from 'react';
import { Clock, CornerDownRight, Hash, Link2, Lock, Pencil, Plus, UserRound, Users } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Avatar, Badge, Field, Modal, PersonCell, Switch } from '../../components/ui';
import type { Department, JobFunction, Schedule } from '../../types';
import { ArchivableTable } from '../../components/settingsKit';
import { circuitForDepartment, codeForName } from '../../utils/org';
import { dayHours } from '../../utils/hours';

/** Départements et sous-départements (RH-14) : responsable, horaire organisationnel, circuit obligatoire. */
export function DepartmentsSection() {
  const { db } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ dep?: Department; parentId?: string }>();
  // Arborescence : chaque département suivi de ses sous-départements.
  const rows = data.departments.flatMap((d) => [d, ...data.subDepartments(d.id)]);
  const staff = (d: Department) => data.employees.filter((e) => (d.parentId ? e.subDepartmentId === d.id : e.departmentId === d.id) && e.status !== 'inactif');
  const noCircuit = data.activeDepartments.filter((d) => !circuitForDepartment(db, d.id));

  return (
    <>
      {noCircuit.length > 0 && (
        <Alert tone="warning" title="Département sans circuit d’approbation">
          {noCircuit.map((d) => d.name).join(', ')} : aucun employé ne peut y être créé ni muté tant qu’un circuit actif ne lui est pas affecté (Paramètres › Circuits d’approbation).
        </Alert>
      )}
      <ArchivableTable
        title="Départements" addLabel="Ajouter un département" collection="departments" onAdd={() => setEditing({})}
        description="Arborescence de la société. Chaque département a un circuit d’approbation unique, hérité par ses sous-départements ; l’horaire d’un sous-département remplace celui de son département."
        rows={rows} nameOf={(d) => d.name}
        rowClassName={(d) => (d.parentId ? 'row-sub' : '')}
        archiveBlockedBy={(d) => {
          const n = staff(d).length;
          if (n > 0) return `« ${d.name} » compte encore ${n} employé(s) actif(s) : réaffectez-les avant de l’archiver.`;
          if (!d.parentId && data.subDepartments(d.id).some((s) => !s.archived)) return `Archivez d’abord les sous-départements de « ${d.name} ».`;
          return undefined;
        }}
        rowActions={(d) => (
          <>
            {!d.parentId && !d.archived && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ parentId: d.id })} aria-label={`Ajouter un sous-département à ${d.name}`}><Plus size={13} aria-hidden /> Sous-département</button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ dep: d })} aria-label={`Modifier ${d.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
          </>
        )}
        columns={[
          { header: 'Nom', render: (d) => d.parentId
            ? <span className="sub-dep"><CornerDownRight size={13} aria-hidden /> {d.name}</span>
            : <span className="person-name">{d.name}</span> },
          { header: 'Code', render: (d) => <span className="mono">{d.code}</span> },
          { header: 'Responsable', render: (d) => <PersonCell employee={data.employee(d.headId)} /> },
          { header: 'Horaire', render: (d) => {
            const own = data.schedule(d.scheduleId);
            if (own) return <span className="small">{own.name}<span className="block sched-mini">{scheduleSummary(own)}</span></span>;
            const parent = data.schedule(data.department(d.parentId)?.scheduleId);
            return d.parentId && parent ? <span className="small text-muted">Hérité : {parent.name}<span className="block sched-mini">{scheduleSummary(parent)}</span></span> : <Badge tone="warning">Aucun</Badge>;
          } },
          { header: 'Circuit', render: (d) => {
            const c = circuitForDepartment(db, d.id);
            if (d.parentId) return <span className="small text-muted">{c ? `Hérité : ${c.name}` : 'Hérité : aucun'}</span>;
            return c ? <span className="small">{c.name}</span> : d.archived ? <span className="text-muted">—</span> : <Badge tone="danger">Aucun circuit</Badge>;
          } },
          { header: 'Effectif', className: 'num', render: (d) => staff(d).length },
        ]}
      />
      <DepartmentModal state={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

/** Résumé d'un horaire : volume hebdomadaire, jours travaillés et créneaux. */
export function scheduleSummary(s: Schedule) {
  const perDay = dayHours(s);
  const weekly = s.weeklyHours ?? Math.round(perDay * s.workDays.length * 10) / 10;
  return `${weekly.toLocaleString('fr-FR')} h / sem. · ${s.workDays.length} j · ${s.slots.map((x) => `${x.start}–${x.end}`).join(', ')}`;
}

function DepartmentModal({ state, onClose }: { state?: { dep?: Department; parentId?: string }; onClose: () => void }) {
  const { db, companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const dep = state?.dep;
  const [f, setF] = useState({ name: '', code: '', headId: '', sub: false, parentId: '', scheduleId: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    const parentId = dep?.parentId ?? state.parentId ?? '';
    setF({ name: dep?.name ?? '', code: dep?.code ?? '', headId: dep?.headId ?? '', sub: !!parentId, parentId, scheduleId: dep?.scheduleId ?? '' });
  }, [state, dep]);
  if (!state) return null;

  const isSub = f.sub;
  const hasSubs = !!dep && data.subDepartments(dep.id).length > 0;
  const siblings = isSub ? data.subDepartments(f.parentId) : data.departments.filter((d) => !d.parentId);
  // Création : code proposé d'après le nom (préfixe + premières lettres, Paramètres › Numéro de souche).
  const code = (dep ? f.code : codeForName(db, companyId, 'departement', f.name)).trim().toUpperCase();
  const schedule = data.schedule(f.scheduleId);
  const parentSchedule = isSub ? data.schedule(data.department(f.parentId)?.scheduleId) : undefined;
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Nom requis.';
  else if (siblings.some((d) => d.id !== dep?.id && d.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errors.name = 'Ce nom existe déjà à ce niveau.';
  if (!code) errors.code = dep ? 'Code requis.' : 'Saisissez le nom : le code en est déduit.';
  else if (data.departments.some((d) => d.id !== dep?.id && d.code.toUpperCase() === code)) errors.code = 'Ce code est déjà utilisé.';
  if (isSub && !f.parentId) errors.parentId = 'Choisissez le département parent.';
  if (!isSub && !f.scheduleId) errors.scheduleId = 'Un département doit avoir un horaire organisationnel.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const saved: Department = {
      ...(dep ?? { id: newId('d'), companyId }),
      name: f.name.trim(), code, headId: f.headId || undefined,
      parentId: isSub ? f.parentId : undefined, scheduleId: f.scheduleId || undefined,
    };
    if (dep) updateItem('departments', saved); else addItem('departments', saved);
    toast(`${isSub ? 'Sous-département' : 'Département'} « ${saved.name} » ${dep ? 'mis à jour' : 'ajouté'} — code ${code}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={dep ? `Modifier « ${dep.name} »` : isSub ? 'Nouveau sous-département' : 'Nouveau département'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{dep ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <label className={`dep-sub-toggle ${isSub ? 'on' : ''} ${hasSubs || dep ? 'disabled' : ''}`} title={dep ? 'Le niveau ne se modifie pas après la création.' : 'Rattacher cette entité à un département existant.'}>
        <input type="checkbox" checked={isSub} disabled={hasSubs || !!dep} onChange={(e) => setF({ ...f, sub: e.target.checked, parentId: e.target.checked ? f.parentId : '' })} />
        <CornerDownRight size={13} aria-hidden />
        <span>Sous-département</span>
      </label>
      <div className="form-grid mt-12">
        {isSub && (
          <Field label="Département parent" required error={err('parentId')} className="span-2">
            {(id) => (
              <select id={id} value={f.parentId} disabled={!!dep} onChange={(e) => setF({ ...f, parentId: e.target.value })}>
                <option value="">Sélectionner le département parent…</option>
                {data.activeDepartments.filter((d) => d.id !== dep?.id && !d.parentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="Nom" required error={err('name')}>{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Financier" />}</Field>
        <Field label="Code" required error={err('code')} hint={dep ? 'Unique dans la société.' : 'Déduit du nom (Paramètres › Numéro de souche).'}>
          {(id) => dep
            ? <input id={id} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            : <span className="input-locked"><Hash size={13} aria-hidden /><input id={id} value={code} readOnly aria-readonly placeholder="—" /><Lock size={12} aria-hidden /></span>}
        </Field>
        <Field label="Responsable">
          {(id) => (
            <select id={id} value={f.headId} onChange={(e) => setF({ ...f, headId: e.target.value })}>
              <option value="">À définir</option>
              {data.employees.filter((e) => e.status !== 'inactif').map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          )}
        </Field>
        <Field label="Horaire organisationnel" required={!isSub} error={err('scheduleId')}
          hint={isSub ? 'Facultatif : sans horaire propre, le sous-département hérite de celui de son département.' : 'Appliqué aux employés en mode organisationnel.'}>
          {(id) => (
            <select id={id} value={f.scheduleId} onChange={(e) => setF({ ...f, scheduleId: e.target.value })}>
              <option value="">{isSub ? 'Hériter du département' : 'Sélectionner…'}</option>
              {data.schedules.filter((s) => !s.archived || s.id === f.scheduleId).map((s) => <option key={s.id} value={s.id}>{s.name} — {scheduleSummary(s)}</option>)}
            </select>
          )}
        </Field>
      </div>
      {(schedule || parentSchedule) && (
        <p className="dep-sched"><Clock size={13} aria-hidden /> <strong>{(schedule ?? parentSchedule)!.name}</strong>{!schedule && ' (hérité)'} · {scheduleSummary((schedule ?? parentSchedule)!)}</p>
      )}
      {!isSub && !dep && <p className="small text-muted mt-12">Affectez ensuite un circuit d’approbation à ce département (Paramètres › Circuits d’approbation) : la création d’employés y est bloquée sans circuit.</p>}
    </Modal>
  );
}

export function FunctionsSection() {
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ fn?: JobFunction }>();
  const holders = (f: JobFunction) => data.employees.filter((e) => e.functionId === f.id && e.status !== 'inactif');

  return (
    <>
      <ArchivableTable
        title="Fonctions" addLabel="Ajouter une fonction" collection="functions" onAdd={() => setEditing({})}
        description="Les règles d’intérim ne s’appliquent qu’aux fonctions qui les activent : solo (une seule personne, suppléance par une fonction liée) ou groupe (présence minimale). Les règles de présence se paramètrent dans « Règles et quotas »."
        rows={data.functions} nameOf={(f) => f.name}
        rowActions={(f) => (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ fn: f })} aria-label={`Modifier ${f.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
        )}
        columns={[
          { header: 'Code', render: (f) => <span className="mono">{f.code ?? '—'}</span> },
          { header: 'Fonction', render: (f) => <span className="person-name">{f.name}</span> },
          { header: 'Intérim', render: (f) => (f.interim ? <FunctionKindBadge kind={f.kind} /> : <span className="text-muted small">Sans règle</span>) },
          { header: 'Département', render: (f) => <>{data.department(f.departmentId)?.name ?? 'Transverse'} {data.department(f.departmentId)?.archived && <ArchivedBadge />}</> },
          { header: 'Titulaires', render: (f) => {
            const h = holders(f);
            return (
              <span className="holders">
                <span className="avatar-stack">{h.slice(0, 4).map((e) => <Avatar key={e.id} employee={e} size={22} />)}</span>
                <span className="small">{h.length === 0 ? <span className="text-muted">Aucun</span> : h.length === 1 ? `${h[0].firstName} ${h[0].lastName}` : `${h.length} personnes`}</span>
                {f.interim && f.kind === 'solo' && h.length > 1 && <Badge tone="warning">{h.length} titulaires pour une fonction solo</Badge>}
              </span>
            );
          } },
          { header: 'Présence min.', render: (f) => (f.interim && f.kind === 'groupe' && f.minPresent != null
            ? <span className="small">{f.minPresent} sur {holders(f).length}</span>
            : <span className="text-muted small">—</span>) },
        ]}
      />
      <FunctionModal state={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

export function FunctionKindBadge({ kind }: { kind: JobFunction['kind'] }) {
  return kind === 'solo'
    ? <Badge tone="neutral" icon={<UserRound size={11} aria-hidden />}>Solo</Badge>
    : <Badge tone="info" icon={<Users size={11} aria-hidden />}>Groupe</Badge>;
}

function FunctionModal({ state, onClose }: { state?: { fn?: JobFunction }; onClose: () => void }) {
  const { db, companyId, addItem, updateItem, setArchived, toast } = useStore();
  const data = useCompanyData();
  const fn = state?.fn;
  const [f, setF] = useState({ name: '', code: '', departmentId: '', interim: false, kind: 'solo' as JobFunction['kind'], minPresent: '', linkTo: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    const linked = fn ? data.functionLinks.find((l) => !l.archived && l.functionIds.includes(fn.id))?.functionIds.find((x) => x !== fn.id) ?? '' : '';
    setF({ name: fn?.name ?? '', code: fn?.code ?? '', departmentId: fn?.departmentId ?? (data.activeDepartments[0]?.id ?? ''), interim: fn?.interim ?? false, kind: fn?.kind ?? 'solo', minPresent: fn?.minPresent != null ? String(fn.minPresent) : '', linkTo: linked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  if (!state) return null;

  const count = fn ? data.employees.filter((e) => e.functionId === fn.id && e.status !== 'inactif').length : 0;
  // Création : code proposé d'après l'intitulé (préfixe + premières lettres, Paramètres › Numéro de souche).
  const code = (fn ? f.code : codeForName(db, companyId, 'fonction', f.name)).trim().toUpperCase();
  const nameError = !f.name.trim() ? 'Intitulé requis.' : '';
  const codeError = code && data.functions.some((x) => x.id !== fn?.id && (x.code ?? '').toUpperCase() === code) ? 'Ce code est déjà utilisé.' : '';
  // Fonctions solo (intérim) configurées, avec lesquelles celle-ci peut être liée pour la suppléance.
  const soloFns = data.functions.filter((x) => !x.archived && x.id !== fn?.id && x.interim && x.kind === 'solo');

  /** Liaison de suppléance : rejoint la liaison existante de la fonction choisie, ou en crée une. */
  const syncLink = (saved: JobFunction) => {
    const target = saved.interim && saved.kind === 'solo' ? f.linkTo : '';
    for (const l of data.functionLinks.filter((x) => !x.archived && x.functionIds.includes(saved.id) && !x.functionIds.includes(target))) {
      const ids = l.functionIds.filter((x) => x !== saved.id);
      updateItem('functionLinks', { ...l, functionIds: ids });
      if (ids.length < 2) setArchived('functionLinks', l.id, true);
    }
    if (!target || data.functionLinks.some((x) => !x.archived && x.functionIds.includes(saved.id) && x.functionIds.includes(target))) return;
    const existing = data.functionLinks.find((x) => !x.archived && x.functionIds.includes(target));
    if (existing) updateItem('functionLinks', { ...existing, functionIds: [...existing.functionIds, saved.id] });
    else addItem('functionLinks', { id: newId('fl'), companyId, name: `${data.fn(target)?.name} ↔ ${saved.name}`, functionIds: [target, saved.id] });
  };
  const save = () => {
    setSubmitted(true);
    if (nameError || codeError) return;
    const saved: JobFunction = {
      ...(fn ?? { id: newId('f'), companyId }),
      name: f.name.trim(), code: code || undefined, departmentId: f.departmentId || undefined, interim: f.interim, kind: f.kind,
      minPresent: f.interim && f.kind === 'groupe' && f.minPresent !== '' ? Number(f.minPresent) : undefined,
    };
    if (fn) updateItem('functions', saved);
    else addItem('functions', saved);
    syncLink(saved);
    toast(`Fonction « ${saved.name} » ${fn ? 'mise à jour' : 'ajoutée'}${saved.interim ? ` — intérim ${saved.kind}` : ''}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={fn ? `Modifier « ${fn.name} »` : 'Nouvelle fonction'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{fn ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <div className="form-grid">
        <Field label="Intitulé" required error={submitted ? nameError : undefined}>{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Financier" />}</Field>
        <Field label="Code" error={submitted ? codeError : undefined} hint={fn ? 'Unique dans la société.' : 'Déduit de l’intitulé (Paramètres › Numéro de souche).'}>
          {(id) => !fn
            ? <span className="input-locked"><Hash size={13} aria-hidden /><input id={id} value={code} readOnly aria-readonly placeholder="—" /><Lock size={12} aria-hidden /></span>
            : <input id={id} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}
        </Field>
        <Field label="Département">
          {(id) => (
            <select id={id} value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
              <option value="">Transverse</option>
              {data.activeDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </Field>
      </div>
      <fieldset className="form-section mt-16">
        <legend>Règles d’intérim</legend>
        <Switch checked={f.interim} onChange={(v) => setF({ ...f, interim: v })} label="Appliquer les règles d’intérim à cette fonction" />
        {!f.interim ? (
          <p className="small text-muted mt-8">Aucune contrainte de suppléance ni de présence minimale : les absences des titulaires ne sont pas contrôlées.</p>
        ) : (<>
        <div className="deduct-choice mt-12" role="radiogroup" aria-label="Type de fonction">
          <label className={`deduct-option ${f.kind === 'solo' ? 'checked' : ''}`}>
            <input type="radio" name="fn-kind" checked={f.kind === 'solo'} onChange={() => setF({ ...f, kind: 'solo' })} />
            <UserRound size={18} aria-hidden />
            <span><span className="person-name">Fonction solo</span><span className="block small text-muted">Une seule personne. Peut être liée à d’autres fonctions solo pour la suppléance.</span></span>
          </label>
          <label className={`deduct-option ${f.kind === 'groupe' ? 'checked' : ''}`}>
            <input type="radio" name="fn-kind" checked={f.kind === 'groupe'} onChange={() => setF({ ...f, kind: 'groupe' })} />
            <Users size={18} aria-hidden />
            <span><span className="person-name">Fonction groupe</span><span className="block small text-muted">Plusieurs personnes. On fixe le nombre minimum de présents.</span></span>
          </label>
        </div>
        {f.kind === 'solo' && count > 1 && <Alert tone="warning" title="Plusieurs titulaires">{count} personnes occupent cette fonction : le type « groupe » serait plus adapté.</Alert>}
        {f.kind === 'solo' && (
          <div className="fn-link">
            <Field label="Fonction solo liée (suppléance)" hint={soloFns.length ? 'Facultatif : les titulaires des fonctions liées ne peuvent pas être absents en même temps.' : 'Aucune autre fonction solo configurée dans la société.'}>
              {(id) => (
                <select id={id} value={f.linkTo} disabled={soloFns.length === 0} onChange={(e) => setF({ ...f, linkTo: e.target.value })}>
                  <option value="">Aucune liaison</option>
                  {soloFns.map((x) => <option key={x.id} value={x.id}>{x.name}{x.code ? ` (${x.code})` : ''}</option>)}
                </select>
              )}
            </Field>
            {f.linkTo && <p className="small text-muted"><Link2 size={12} aria-hidden className="inline-icon" /> Liée à <strong>{data.fn(f.linkTo)?.name}</strong> : gérable aussi dans Règles et quotas › Fonctions liées.</p>}
          </div>
        )}
        {f.kind === 'groupe' && (
          <div className="cap-row">
            <Field label="Présence minimale (personnes)" hint={fn ? `Effectif actif : ${count}. Exemple : 3 personnes et 2 requises → 1 absence possible à la fois.` : 'Peut aussi être réglée dans « Règles et quotas ».'}>
              {(id) => <input id={id} type="number" min={0} step={1} value={f.minPresent} onChange={(e) => setF({ ...f, minPresent: e.target.value })} placeholder="Non défini" />}
            </Field>
          </div>
        )}
        </>)}
      </fieldset>
    </Modal>
  );
}
