import { useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Search, Users } from 'lucide-react';
import { navigate, useCompanyData } from '../../store';
import { Badge, EmployeeStatusBadge, employeeStatusOptions, EmptyState, PageHeader, PersonCell, SelectFilter } from '../../components/ui';
import { formatDate, formatDayMonth, TODAY } from '../../utils/dates';
import type { Employee } from '../../types';
import { EmployeeForm } from './EmployeeForm';

export function EmployeeList({ addOpen }: { addOpen: boolean }) {
  const data = useCompanyData();
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [functionId, setFunctionId] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Employee>();

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.employees
      .filter((e) => !s || `${e.firstName} ${e.lastName} ${e.matricule} ${e.email}`.toLowerCase().includes(s))
      .filter((e) => !departmentId || e.departmentId === departmentId)
      .filter((e) => !functionId || e.functionId === functionId)
      .filter((e) => !status || e.status === status)
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));
  }, [data, q, departmentId, functionId, status]);

  const hasFilters = q || departmentId || functionId || status;
  const reset = () => { setQ(''); setDepartmentId(''); setFunctionId(''); setStatus(''); };
  const absenceToday = (id: string) => data.requests.find((r) => r.employeeId === id && r.status === 'approuve' && r.start <= TODAY && r.end >= TODAY);

  return (
    <>
      <PageHeader eyebrow="Application RH · Collaborateurs" icon={<Users size={20} strokeWidth={1.8} />}
        title="Employés"
        subtitle={`${data.employees.length} collaborateurs · ${data.company.name}`}
        actions={<button type="button" className="btn btn-primary" onClick={() => navigate('employes/nouveau')}><Plus size={15} aria-hidden /> Ajouter un employé</button>}
      />
      <div className="filters">
        <div className="filter filter-search">
          <label htmlFor="emp-q">Recherche</label>
          <div className="input-icon">
            <Search size={14} aria-hidden />
            <input id="emp-q" type="search" placeholder="Nom, matricule, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <SelectFilter label="Département" value={departmentId} onChange={setDepartmentId}
          options={data.departments.map((d) => ({ value: d.id, label: d.name + (d.archived ? ' (archivé)' : '') }))} />
        <SelectFilter label="Fonction" value={functionId} onChange={setFunctionId} allLabel="Toutes"
          options={data.functions.filter((f) => !departmentId || f.departmentId === departmentId).map((f) => ({ value: f.id, label: f.name + (f.archived ? ' (archivée)' : '') }))} />
        <SelectFilter label="Statut" value={status} onChange={setStatus} options={employeeStatusOptions} />
        {hasFilters && <button type="button" className="btn btn-sm btn-ghost filter-reset" onClick={reset}><RotateCcw size={13} aria-hidden /> Réinitialiser</button>}
      </div>
      <p className="result-count">{list.length} employé{list.length > 1 ? 's' : ''}</p>
      {list.length === 0 ? (
        <EmptyState title="Aucun employé trouvé" text="Modifiez la recherche ou les filtres." action={<button type="button" className="btn btn-sm btn-ghost" onClick={reset}>Effacer les filtres</button>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Matricule</th>
                <th scope="col">Département</th>
                <th scope="col">Fonction</th>
                <th scope="col">Embauche</th>
                <th scope="col">Statut</th>
                <th scope="col">Présence</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const abs = absenceToday(e.id);
                return (
                  <tr key={e.id} className="row-click" onClick={() => navigate(`employes/${e.id}`)}>
                    <td><PersonCell employee={e} sub={e.email} link /></td>
                    <td className="mono">{e.matricule}</td>
                    <td>{data.department(e.departmentId)?.name}</td>
                    <td>{data.fn(e.functionId)?.name}</td>
                    <td className="nowrap">{formatDate(e.hireDate)}</td>
                    <td><EmployeeStatusBadge status={e.status} /></td>
                    <td>{abs ? <Badge tone="warning">En congé jusqu’au {formatDayMonth(abs.end)}</Badge> : <span className="text-muted">—</span>}</td>
                    <td className="actions">
                      <button type="button" className="icon-btn icon-btn-sm" aria-label={`Modifier ${e.firstName} ${e.lastName}`} title="Modifier"
                        onClick={(ev) => { ev.stopPropagation(); setEditing(e); }}><Pencil size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <EmployeeForm open={addOpen} onClose={() => navigate('employes')} onSaved={(e) => window.setTimeout(() => navigate(`employes/${e.id}`), 0)} />
      <EmployeeForm open={!!editing} employee={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}
