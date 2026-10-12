import { useMemo, useState } from 'react';
import { Eye, Link2, Plus, RotateCcw, Search, Users } from 'lucide-react';
import { navigate, useCompanyData, useStore } from '../../store';
import { Avatar, Badge, EmployeeStatusBadge, employeeStatusOptions, EmptyState, PageHeader, SelectFilter } from '../../components/ui';
import { profileRoleIds } from '../../utils/leave';
import type { Employee } from '../../types';
import { EmployeeForm } from './EmployeeForm';

export function EmployeeList({ addOpen }: { addOpen: boolean }) {
  const { db, companyId } = useStore();
  const data = useCompanyData();
  const [q, setQ] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [functionId, setFunctionId] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.employees
      .filter((e) => !s || `${e.firstName} ${e.lastName} ${e.matricule} ${e.companyMatricule ?? ""} ${e.email}`.toLowerCase().includes(s))
      .filter((e) => !departmentId || e.departmentId === departmentId)
      .filter((e) => !functionId || e.functionId === functionId)
      .filter((e) => !status || e.status === status)
      .filter((e) => !mode || (mode === 'non-planifie' ? e.scheduleMode === 'chargement' && !data.profile(e.id)?.scheduleId : e.scheduleMode === mode))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));
  }, [data, q, departmentId, functionId, status, mode]);

  const hasFilters = q || departmentId || functionId || status || mode;
  const reset = () => { setQ(''); setDepartmentId(''); setFunctionId(''); setStatus(''); setMode(''); };
  // Compte du core tenant associé à la fiche (lien explicite ou lien porté par l'utilisateur).
  const userOf = (e: Employee) => db.users.find((u) => u.id === e.account.userId) ?? db.users.find((u) => u.employeeLinks[companyId] === e.id);

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
        <SelectFilter label="Mode horaire" value={mode} onChange={setMode}
          options={[{ value: 'organisation', label: 'Organisationnel' }, { value: 'chargement', label: 'Tableau de chargement' }, { value: 'non-planifie', label: 'Non planifié' }]} />
        {hasFilters && <button type="button" className="btn btn-sm btn-ghost filter-reset" onClick={reset}><RotateCcw size={13} aria-hidden /> Réinitialiser</button>}
      </div>
      <p className="result-count">{list.length} employé{list.length > 1 ? 's' : ''}</p>
      {list.length === 0 ? (
        <EmptyState title="Aucun employé trouvé" text="Modifiez la recherche ou les filtres." action={<button type="button" className="btn btn-sm btn-ghost" onClick={reset}>Effacer les filtres</button>} />
      ) : (
        <div className="table-wrap">
          <table className="table emp-table">
            <thead>
              <tr>
                <th scope="col" className="col-xs" title="Matricule application">Mat.</th>
                <th scope="col">Nom et prénom</th>
                <th scope="col">Matricule société</th>
                <th scope="col">Fonction</th>
                <th scope="col">Département</th>
                <th scope="col">Horaire</th>
                <th scope="col">Compte utilisateur</th>
                <th scope="col">Statut</th>
                <th scope="col" className="col-roles">Rôles</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const user = userOf(e);
                const profile = data.profile(e.id);
                return (
                  <tr key={e.id} className="row-click" onClick={() => navigate(`employes/${e.id}`)}>
                    <td className="col-xs"><span className="emp-id"><Avatar employee={e} size={26} /><span className="mono">{e.matricule}</span></span></td>
                    <td className="emp-name"><span className="person-name person-link">{e.firstName} {e.lastName}</span><span className="person-sub" title={e.email}>{e.email}</span></td>
                    <td className="mono nowrap">{e.companyMatricule || <span className="text-muted">—</span>}</td>
                    <td>{data.fn(e.functionId)?.name}</td>
                    <td>{data.department(e.departmentId)?.name}{e.subDepartmentId && <span className="block small text-muted">{data.department(e.subDepartmentId)?.name}</span>}</td>
                    <td>{e.scheduleMode === 'organisation'
                      ? <span className="small">{data.schedule(profile?.scheduleId)?.name ?? '—'}</span>
                      : profile?.scheduleId ? <Badge tone="warning">Tableau de chargement</Badge> : <Badge tone="danger">Non planifié</Badge>}</td>
                    <td>{user
                      ? <span className="emp-account"><Link2 size={12} aria-hidden /><span><span className="mono">{user.login}</span>{user.status === 'invite' && <span className="block small text-warning">Invitation envoyée</span>}</span></span>
                      : <span className="small text-muted">Non associé</span>}</td>
                    <td><EmployeeStatusBadge status={e.status} /></td>
                    <td className="col-roles">
                      {profile && <span className="role-tags">{profileRoleIds(profile).map((id, i) => <span key={id} className={`role-tag ${i === 0 ? 'primary' : ''}`}>{data.role(id)?.name}</span>)}</span>}
                    </td>
                    <td className="actions">
                      <button type="button" className="icon-btn icon-btn-sm" aria-label={`Voir le détail de ${e.firstName} ${e.lastName}`} title="Voir le détail"
                        onClick={(ev) => { ev.stopPropagation(); navigate(`employes/${e.id}`); }}><Eye size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <EmployeeForm open={addOpen} onClose={() => navigate('employes')} onSaved={(e) => window.setTimeout(() => navigate(`employes/${e.id}`), 0)} />
    </>
  );
}
