import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarCheck, Pencil } from 'lucide-react';
import { navigate, useCompanyData } from '../../store';
import { Avatar, Badge, EmployeeStatusBadge, EmptyState, Tabs } from '../../components/ui';
import type { ID } from '../../types';
import { formatDate, formatDateTime, formatDayMonth, TODAY } from '../../utils/dates';
import { LeaveDetail } from '../leave/LeaveDetail';
import { LeaveForm } from '../leave/LeaveForm';
import { LeaveTable } from '../leave/LeaveTable';
import { EmployeeForm } from './EmployeeForm';
import { formatPhone } from '../../utils/phone';
import { AccessTab, ApproversTab, ProfileTab } from './EmployeeLeaveTabs';

type Tab = 'infos' | 'conges' | 'acces' | 'approbateurs';

export function EmployeeDetail({ employeeId }: { employeeId: ID }) {
  const data = useCompanyData();
  const employee = data.employee(employeeId);
  const profile = data.profile(employeeId);
  const [tab, setTab] = useState<Tab>('infos');
  const [editOpen, setEditOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [openReq, setOpenReq] = useState<ID>();

  useEffect(() => setTab('infos'), [employeeId]);

  if (!employee || !profile || employee.companyId !== data.company.id) {
    return (
      <EmptyState title="Employé introuvable" text="Cette fiche n’appartient pas à la société active."
        action={<button type="button" className="btn btn-primary" onClick={() => navigate('employes')}>Retour à la liste</button>} />
    );
  }

  const manager = data.employee(employee.managerId);
  const requests = data.requests.filter((r) => r.employeeId === employee.id).sort((a, b) => b.start.localeCompare(a.start));
  const absentNow = requests.find((r) => r.status === 'approuve' && r.start <= TODAY && r.end >= TODAY);

  return (
    <>
      <div className="breadcrumb">
        <button type="button" className="back-link" onClick={() => navigate('employes')}><ArrowLeft size={14} aria-hidden /> Employés</button>
        <span aria-hidden>/</span>
        <span>{employee.firstName} {employee.lastName}</span>
      </div>
      <div className="profile-header">
        <Avatar employee={employee} size={56} />
        <div className="grow">
          <h1>{employee.firstName} {employee.lastName}</h1>
          <p className="text-muted">{data.fn(employee.functionId)?.name} · {data.department(employee.departmentId)?.name} · <span className="mono">{employee.matricule}</span></p>
          <div className="row-gap mt-8">
            <EmployeeStatusBadge status={employee.status} />
            <Badge tone="neutral">{employee.contract}</Badge>
            <Badge tone="primary">{data.role(profile.roleId)?.name}</Badge>
            {absentNow && <Badge tone="warning">En congé jusqu’au {formatDayMonth(absentNow.end)}</Badge>}
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" disabled={employee.status === 'inactif'} onClick={() => setLeaveOpen(true)}><CalendarCheck size={14} aria-hidden /> Saisir un congé</button>
          <button type="button" className="btn btn-primary" onClick={() => setEditOpen(true)}><Pencil size={14} aria-hidden /> Modifier</button>
        </div>
      </div>

      <Tabs<Tab> label="Sections de la fiche" value={tab} onChange={setTab} tabs={[
        { id: 'infos', label: 'Informations' },
        { id: 'conges', label: 'Congés', count: requests.length },
        { id: 'acces', label: 'Accès' },
        { id: 'approbateurs', label: 'Approbateurs', count: profile.approverIds.length },
      ]} />

      {tab === 'infos' && (
        <div className="two-col">
          <section className="panel">
            <h2 className="panel-title">Informations personnelles</h2>
            <dl className="detail-list">
              <div><dt>E-mail</dt><dd>{employee.email}</dd></div>
              <div><dt>Téléphone</dt><dd>{formatPhone(data.country(employee.phoneCountryId), employee.phone) || '—'}</dd></div>
              <div><dt>Date de naissance</dt><dd>{employee.birthDate ? formatDate(employee.birthDate) : '—'}</dd></div>
              <div><dt>Adresse</dt><dd>{employee.address || '—'}</dd></div>
            </dl>
          </section>
          <section className="panel">
            <h2 className="panel-title">Informations professionnelles</h2>
            <dl className="detail-list">
              <div><dt>Société</dt><dd>{data.company.name}</dd></div>
              <div><dt>Département</dt><dd>{data.department(employee.departmentId)?.name}</dd></div>
              <div><dt>Fonction</dt><dd>{data.fn(employee.functionId)?.name}</dd></div>
              <div><dt>Responsable (N+1)</dt><dd>{manager ? <a href={`#/employes/${manager.id}`} className="link">{manager.firstName} {manager.lastName}</a> : '—'}</dd></div>
              <div><dt>Date d’embauche</dt><dd>{formatDate(employee.hireDate)}</dd></div>
              <div><dt>Horaire</dt><dd>{data.schedule(profile.scheduleId)?.name}</dd></div>
            </dl>
          </section>
          <section className="panel">
            <h2 className="panel-title">Compte utilisateur</h2>
            <dl className="detail-list">
              <div><dt>Accès</dt><dd>{employee.account.active ? <Badge tone="success">Actif</Badge> : <Badge tone="muted">Désactivé</Badge>}</dd></div>
              <div><dt>Identifiant</dt><dd className="mono">{employee.account.login || '—'}</dd></div>
              <div><dt>Dernière connexion</dt><dd>{employee.account.lastLogin ? formatDateTime(employee.account.lastLogin) : 'Jamais'}</dd></div>
            </dl>
          </section>
        </div>
      )}

      {tab === 'conges' && (
        <>
          <ProfileTab profile={profile} key={`p-${employee.id}`} />
          <section>
            <div className="section-head">
              <h2 className="section-title">Demandes de congé</h2>
              <button type="button" className="btn btn-sm btn-ghost" disabled={employee.status === 'inactif'} onClick={() => setLeaveOpen(true)}>Nouvelle demande</button>
            </div>
            <LeaveTable requests={requests} onOpen={setOpenReq} hideEmployee emptyText="Aucune demande pour cet employé." />
          </section>
        </>
      )}
      {tab === 'acces' && <AccessTab profile={profile} key={`a-${employee.id}`} />}
      {tab === 'approbateurs' && <ApproversTab profile={profile} key={`ap-${employee.id}`} />}

      <EmployeeForm open={editOpen} employee={employee} onClose={() => setEditOpen(false)} />
      <LeaveForm open={leaveOpen} onClose={() => setLeaveOpen(false)} defaultEmployeeId={employee.id} onCreated={setOpenReq} />
      {openReq && <LeaveDetail requestId={openReq} onClose={() => setOpenReq(undefined)} />}
    </>
  );
}
