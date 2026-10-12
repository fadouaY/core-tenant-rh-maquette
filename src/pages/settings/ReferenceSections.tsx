// Référentiels congés : horaires, règles, jours fériés (types de congé : LeaveTypesSection.tsx).
import { useState } from 'react';
import { newId, useCompanyData, useStore } from '../../store';
import { Badge } from '../../components/ui';
import { Pencil } from 'lucide-react';
import type { Schedule } from '../../types';
import { formatDate, formatRange, formatWeekdayShort, TODAY } from '../../utils/dates';
import { scheduleDays, scheduleDayTypes, weeklyMinutes } from '../../utils/hours';
import { scheduleUsage } from '../../utils/org';
import { ArchivableTable, QuickAddModal } from '../../components/settingsKit';
import { ScheduleEditor } from './ScheduleEditor';

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
/** « Lun–Ven », « Sam », « Lun, Mer ». */
const daysLabel = (days: number[]) => {
  const d = [...days].sort();
  return d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1] + 1) ? `${DAY_NAMES[d[0] - 1]}–${DAY_NAMES[d[d.length - 1] - 1]}` : d.map((x) => DAY_NAMES[x - 1]).join(', ');
};

/** Scénarios d'horaires (RH-21) : création et modification dans ScheduleEditor. */
export function SchedulesSection() {
  const { db } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ schedule?: Schedule }>();
  return (
    <>
      <ArchivableTable
        title="Scénarios d’horaires" addLabel="Nouveau scénario" collection="schedules" onAdd={() => setEditing({})}
        description="Chaque scénario définit ses journées types (jours et créneaux), sa période et son volume hebdomadaire. Il s’affecte aux départements ou aux périodes du tableau de chargement ; un scénario utilisé ne peut pas être archivé."
        rows={data.schedules} nameOf={(s) => s.name}
        rowActions={(s) => (
          <button type="button" className="btn btn-sm btn-ghost" disabled={s.archived} onClick={() => setEditing({ schedule: s })} aria-label={`Modifier ${s.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
        )}
        columns={[
          { header: 'Scénario', render: (s) => {
            const state = !s.startDate || !s.endDate ? undefined : s.endDate < TODAY ? 'past' : s.startDate > TODAY ? 'next' : 'now';
            return (
              <span className="sc-name">
                <span className="person-name">{s.name}</span>
                {s.startDate && s.endDate && <span className="small text-muted">{formatRange(s.startDate, s.endDate)}</span>}
                <span className="sc-tags">
                  {state && <Badge tone={state === 'now' ? 'success' : state === 'next' ? 'info' : 'muted'}>{state === 'now' ? 'En cours' : state === 'next' ? 'À venir' : 'Terminé'}</Badge>}
                  {!!s.exceptionalOffDays?.length && <Badge tone="neutral">{s.exceptionalOffDays.length} jour{s.exceptionalOffDays.length > 1 ? 's' : ''} except.</Badge>}
                </span>
              </span>
            );
          } },
          { header: 'Journées et créneaux', render: (s) => (
            <span className="sc-days">
              <span className="day-pills">{DAY_NAMES.map((d, i) => { const on = scheduleDays(s).includes(i + 1); return <span key={d} className={`day-pill ${on ? 'on' : ''}`} aria-label={`${d} ${on ? 'travaillé' : 'repos'}`}>{d[0]}</span>; })}</span>
              {scheduleDayTypes(s).map((g) => (
                <span key={g.days.join()} className="sc-type">
                  <strong>{daysLabel(g.days)}</strong>
                  <span>{g.slots.map((sl) => `${sl.start}–${sl.end}`).join(' · ')}</span>
                </span>
              ))}
            </span>
          ) },
          { header: 'Volume', render: (s) => {
            const computed = Math.round(weeklyMinutes(s) / 6) / 10;
            const gap = s.weeklyHours ? Math.round((computed - s.weeklyHours) * 10) / 10 : 0;
            return (
              <span className="sc-vol">
                <strong>{(s.weeklyHours ?? computed).toLocaleString('fr-FR')} h</strong>
                <span className="small text-muted">créneaux : {computed.toLocaleString('fr-FR')} h</span>
                {Math.abs(gap) >= 0.1 && <Badge tone={gap > 0 ? 'warning' : 'info'}>{gap > 0 ? '+' : ''}{gap.toLocaleString('fr-FR')} h</Badge>}
              </span>
            );
          } },
          { header: 'Affecté à', render: (s) => {
            const u = scheduleUsage(db, s.id);
            if (!u.inUse) return <span className="text-muted small">Non utilisé</span>;
            return (
              <span className="sc-usage">
                {u.departments.map((d) => <span key={d.id} className="sc-chip">{d.name}</span>)}
                {u.periods.length > 0 && <span className="small text-muted">{u.periods.length} période(s) du tableau de chargement</span>}
              </span>
            );
          } },
          { header: 'Employés', className: 'num', render: (s) => <strong className="num">{data.profiles.filter((p) => p.scheduleId === s.id).length}</strong> },
        ]}
        archiveBlockedBy={(s) => {
          const u = scheduleUsage(db, s.id);
          if (!u.inUse) return undefined;
          return `« ${s.name} » est encore utilisé (${[u.departments.length ? `${u.departments.length} département(s)` : '', u.periods.length ? `${u.periods.length} période(s) planifiée(s)` : ''].filter(Boolean).join(', ')}) : affectez un autre horaire avant de l’archiver.`;
        }}
      />
      {editing && <ScheduleEditor schedule={editing.schedule} onClose={() => setEditing(undefined)} />}
    </>
  );
}

export function RulesSection() {
  const { companyId, addItem, toast } = useStore();
  const data = useCompanyData();
  const [open, setOpen] = useState(false);
  const types = data.leaveTypes.filter((t) => !t.archived);
  return (
    <>
      <ArchivableTable
        title="Règles et quotas" addLabel="Ajouter une règle" collection="leaveRules" onAdd={() => setOpen(true)}
        description="Valeurs d’exemple pour la démonstration — elles ne constituent pas des règles légales ou contractuelles."
        rows={data.leaveRules} nameOf={(r) => r.label}
        columns={[
          { header: 'Règle', render: (r) => <span className="person-name">{r.label}</span> },
          { header: 'Type', render: (r) => data.leaveType(r.leaveTypeId)?.name },
          { header: 'Quota annuel', className: 'num', render: (r) => (r.annualQuota == null ? <Badge tone="neutral">Sans plafond</Badge> : `${String(r.annualQuota).replace('.', ',')} j`) },
          { header: 'Acquisition', render: (r) => <span className="small">{r.accrual}</span> },
          { header: 'Report max', className: 'num', render: (r) => `${r.maxCarryOver} j` },
          { header: 'Prévenance', className: 'num', render: (r) => `${r.minNoticeDays} j` },
          { header: 'Portée', render: (r) => <span className="small">{r.scope}</span> },
        ]}
      />
      <QuickAddModal open={open} onClose={() => setOpen(false)} title="Nouvelle règle"
        initial={{ label: '', leaveTypeId: types[0]?.id ?? '', annualQuota: '0', accrual: 'Annuel', maxCarryOver: '0', minNoticeDays: '0', scope: 'Tous les employés' }}
        fields={[
          { key: 'label', label: 'Libellé', type: 'text', required: true },
          { key: 'leaveTypeId', label: 'Type de congé', type: 'select', options: types.map((t) => ({ value: t.id, label: t.name })) },
          { key: 'annualQuota', label: 'Quota annuel (jours)', type: 'number' },
          { key: 'maxCarryOver', label: 'Report maximum (jours)', type: 'number' },
          { key: 'minNoticeDays', label: 'Délai de prévenance (jours)', type: 'number' },
          { key: 'accrual', label: 'Mode d’acquisition', type: 'text' },
          { key: 'scope', label: 'Portée', type: 'text' },
        ]}
        onSubmit={(v) => {
          addItem('leaveRules', {
            id: newId('r'), companyId, label: String(v.label), leaveTypeId: String(v.leaveTypeId), annualQuota: Number(v.annualQuota),
            accrual: String(v.accrual), maxCarryOver: Number(v.maxCarryOver), minNoticeDays: Number(v.minNoticeDays), scope: String(v.scope),
          });
          toast('Règle ajoutée');
        }}
      />
    </>
  );
}

export function HolidaysSection() {
  const { companyId, addItem, toast } = useStore();
  const data = useCompanyData();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ArchivableTable
        title="Jours fériés" addLabel="Ajouter un jour férié" collection="holidays" onAdd={() => setOpen(true)}
        description={`Calendrier propre à ${data.company.name} (${data.company.city}). Les jours fériés actifs sont exclus du décompte.`}
        rows={[...data.holidays].sort((a, b) => a.date.localeCompare(b.date))} nameOf={(h) => h.name}
        columns={[
          { header: 'Date', className: 'nowrap', render: (h) => <><span className="text-muted small">{formatWeekdayShort(h.date)}</span> {formatDate(h.date)}</> },
          { header: 'Nom', render: (h) => <span className="person-name">{h.name}</span> },
          { header: 'Récurrence', render: (h) => (h.recurring ? <Badge tone="info">Chaque année</Badge> : <Badge tone="neutral">Ponctuel</Badge>) },
        ]}
      />
      <QuickAddModal open={open} onClose={() => setOpen(false)} title="Nouveau jour férié"
        initial={{ name: '', date: '', recurring: false }}
        fields={[
          { key: 'name', label: 'Nom', type: 'text', required: true },
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'recurring', label: 'Se répète chaque année', type: 'checkbox' },
        ]}
        onSubmit={(v) => { addItem('holidays', { id: newId('h'), companyId, name: String(v.name), date: String(v.date), recurring: !!v.recurring }); toast('Jour férié ajouté'); }}
      />
    </>
  );
}
