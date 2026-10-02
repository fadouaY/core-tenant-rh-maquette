import { useMemo, useState } from 'react';
import { ClipboardList, Plus, RotateCcw } from 'lucide-react';
import { navigate, useCompanyData, useStore } from '../../store';
import { LeaveDetail } from './LeaveDetail';
import { LeaveForm } from './LeaveForm';
import { LeaveTable } from './LeaveTable';
import { Card, PageHeader, SelectFilter, Tabs } from '../../components/ui';
import { overlaps } from '../../utils/dates';
import type { LeaveStatus } from '../../types';

type View = 'a_traiter' | 'toutes' | 'miennes';

export function RequestsPage({ param }: { param?: string }) {
  const { currentUser } = useStore();
  const data = useCompanyData();
  const [view, setView] = useState<View>('toutes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');

  const formOpen = param === 'nouvelle';
  const detailId = param && param !== 'nouvelle' ? param : undefined;

  const mine = (r: { steps: { status: string; approverId: string }[] }) =>
    r.steps.some((s) => s.status === 'en_attente' && s.approverId === currentUser.id);
  const toProcess = data.requests.filter((r) => r.status === 'en_attente' && mine(r));

  const filtered = useMemo(() => {
    let list = data.requests;
    if (view === 'a_traiter') list = list.filter((r) => r.status === 'en_attente' && mine(r));
    if (view === 'miennes') list = list.filter((r) => r.employeeId === currentUser.id);
    return list
      .filter((r) => (!from && !to) || overlaps(r.start, r.end, from || '0000-01-01', to || '9999-12-31'))
      .filter((r) => !employeeId || r.employeeId === employeeId)
      .filter((r) => !departmentId || data.person(r.employeeId)?.departmentId === departmentId)
      .filter((r) => !typeId || r.leaveTypeId === typeId)
      .filter((r) => !status || r.status === (status as LeaveStatus))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, from, to, employeeId, departmentId, typeId, status, currentUser.id]);

  const hasFilters = from || to || employeeId || departmentId || typeId || status;
  const reset = () => { setFrom(''); setTo(''); setEmployeeId(''); setDepartmentId(''); setTypeId(''); setStatus(''); };

  return (
    <>
      <PageHeader eyebrow="Application RH · Congés" icon={<ClipboardList size={20} strokeWidth={1.8} />}
        title="Congés"
        subtitle="Suivi des demandes, décisions et circuits d’approbation."
        actions={<button type="button" className="btn btn-primary" onClick={() => navigate('conges/demandes/nouvelle')}><Plus size={16} aria-hidden /> Nouvelle demande</button>}
      />

      <Card flush>
        <Tabs
          label="Vues des demandes"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'toutes', label: 'Toutes les demandes', count: data.requests.length },
            { id: 'a_traiter', label: 'À traiter par moi', count: toProcess.length },
            { id: 'miennes', label: 'Mes demandes', count: data.requests.filter((r) => r.employeeId === currentUser.id).length },
          ]}
        />
        <div className="filters">
          <div className="filter">
            <label htmlFor="lf-from">Du</label>
            <input id="lf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="filter">
            <label htmlFor="lf-to">Au</label>
            <input id="lf-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <SelectFilter label="Employé" value={employeeId} onChange={setEmployeeId}
            options={data.people.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))} />
          <SelectFilter label="Département" value={departmentId} onChange={setDepartmentId}
            options={data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))} />
          <SelectFilter label="Type" value={typeId} onChange={setTypeId}
            options={data.leaveTypes.map((t) => ({ value: t.id, label: t.name + (t.archived ? ' (archivé)' : '') }))} />
          <SelectFilter label="Statut" value={status} onChange={setStatus}
            options={[{ value: 'en_attente', label: 'En attente' }, { value: 'approuve', label: 'Approuvée' }, { value: 'refuse', label: 'Refusée' }, { value: 'annule', label: 'Annulée' }]} />
          {hasFilters && <button type="button" className="btn btn-sm btn-ghost filter-reset" onClick={reset}><RotateCcw size={14} aria-hidden /> Réinitialiser</button>}
        </div>
        <p className="result-count">{filtered.length} demande{filtered.length > 1 ? 's' : ''}</p>
        <LeaveTable
          requests={filtered}
          onOpen={(id) => navigate(`conges/demandes/${id}`)}
          emptyText={view === 'a_traiter' && !hasFilters ? 'Rien à traiter pour le moment : toutes vos validations sont à jour.' : undefined}
        />
      </Card>

      <LeaveForm open={formOpen} onClose={() => navigate('conges/demandes')} onCreated={(id) => navigate(`conges/demandes/${id}`)} />
      {detailId && <LeaveDetail requestId={detailId} onClose={() => navigate('conges/demandes')} />}
    </>
  );
}
