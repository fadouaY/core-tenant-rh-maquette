// Référentiels congés : horaires, règles, jours fériés (types de congé : LeaveTypesSection.tsx).
import { useState } from 'react';
import { newId, useCompanyData, useStore } from '../../store';
import { Badge } from '../../components/ui';
import { formatDate, formatWeekdayShort } from '../../utils/dates';
import { ArchivableTable, QuickAddModal } from '../../components/settingsKit';

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function minutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }


export function SchedulesSection() {
  const { companyId, addItem, toast } = useStore();
  const data = useCompanyData();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ArchivableTable
        title="Horaires et créneaux" addLabel="Ajouter un horaire" collection="schedules" onAdd={() => setOpen(true)}
        description="Jours travaillés et créneaux. Les jours non travaillés sont exclus du décompte des congés (exemple)."
        rows={data.schedules} nameOf={(s) => s.name}
        columns={[
          { header: 'Horaire', render: (s) => <span className="person-name">{s.name}</span> },
          { header: 'Jours travaillés', render: (s) => (
            <span className="day-pills">{DAY_NAMES.map((d, i) => <span key={d} className={`day-pill ${s.workDays.includes(i + 1) ? 'on' : ''}`} aria-label={`${d} ${s.workDays.includes(i + 1) ? 'travaillé' : 'non travaillé'}`}>{d[0]}</span>)}</span>
          ) },
          { header: 'Créneaux', render: (s) => <span className="small">{s.slots.map((sl) => `${sl.label} ${sl.start}–${sl.end}`).join(' · ')}</span> },
          { header: 'Heures / semaine', className: 'num', render: (s) => {
            const perDay = s.slots.reduce((sum, sl) => sum + minutes(sl.end) - minutes(sl.start), 0) / 60;
            return `${(perDay * s.workDays.length).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
          } },
          { header: 'Profils', className: 'num', render: (s) => data.profiles.filter((p) => p.scheduleId === s.id).length },
        ]}
      />
      <QuickAddModal open={open} onClose={() => setOpen(false)} title="Nouvel horaire"
        initial={{ name: '', days: '5', amStart: '09:00', amEnd: '12:30', pmStart: '14:00', pmEnd: '18:00' }}
        fields={[
          { key: 'name', label: 'Nom', type: 'text', required: true },
          { key: 'days', label: 'Jours travaillés', type: 'select', options: [{ value: '5', label: 'Du lundi au vendredi' }, { value: '6', label: 'Du lundi au samedi' }, { value: '4', label: 'Du lundi au jeudi' }] },
          { key: 'amStart', label: 'Matin — début', type: 'text', placeholder: '09:00' },
          { key: 'amEnd', label: 'Matin — fin', type: 'text', placeholder: '12:30' },
          { key: 'pmStart', label: 'Après-midi — début', type: 'text', placeholder: '14:00' },
          { key: 'pmEnd', label: 'Après-midi — fin', type: 'text', placeholder: '18:00' },
        ]}
        onSubmit={(v) => {
          addItem('schedules', {
            id: newId('s'), companyId, name: String(v.name),
            workDays: Array.from({ length: Number(v.days) }, (_, i) => i + 1),
            slots: [{ label: 'Matin', start: String(v.amStart), end: String(v.amEnd) }, { label: 'Après-midi', start: String(v.pmStart), end: String(v.pmEnd) }],
          });
          toast('Horaire ajouté');
        }}
      />
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
