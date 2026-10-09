import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarCheck, CalendarClock, GitBranch, Pencil, Plus, Undo2 } from 'lucide-react';
import { navigate, useCompanyData } from '../../store';
import { EmptyState, Tabs } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { ID } from '../../types';
import { LeaveDetail } from '../leave/LeaveDetail';
import { LeaveForm } from '../leave/LeaveForm';
import { LeaveTable } from '../leave/LeaveTable';
import { EmployeeForm } from './EmployeeForm';
import { AccessTab, ProfileTab } from './EmployeeLeaveTabs';
import { EmployeeHero, OverviewTab, WorkTimeTab, type EmployeeTab } from './EmployeeOverview';
import { CircuitChain, HistoryTab, RemunerationTab, ScheduleModeModal } from './EmployeeSections';

/**
 * Fiche employé. En-tête : identité, statuts, quatre repères et alertes du moment.
 * Onglets par thème : vue d'ensemble, temps de travail, congés (soldes, demandes et circuit d'approbation),
 * rémunération, accès, historique.
 */
export function EmployeeDetail({ employeeId }: { employeeId: ID }) {
  const data = useCompanyData();
  const employee = data.employee(employeeId);
  const profile = data.profile(employeeId);
  const [tab, setTab] = useState<EmployeeTab>('apercu');
  const [editOpen, setEditOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [openReq, setOpenReq] = useState<ID>();
  const [modeOpen, setModeOpen] = useState(false);

  useEffect(() => setTab('apercu'), [employeeId]);

  if (!employee || !profile || employee.companyId !== data.company.id) {
    return (
      <EmptyState title="Employé introuvable" text="Cette fiche n’appartient pas à la société active."
        action={<button type="button" className="btn btn-primary" onClick={() => navigate('employes')}>Retour à la liste</button>} />
    );
  }

  const inactive = employee.status === 'inactif';
  const requests = data.requests.filter((r) => r.employeeId === employee.id).sort((a, b) => b.start.localeCompare(a.start));
  const pending = requests.filter((r) => r.status === 'en_attente').length;
  const goTo = (t: EmployeeTab) => { setTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <>
      <div className="breadcrumb">
        <button type="button" className="back-link" onClick={() => navigate('employes')}><ArrowLeft size={14} aria-hidden /> Employés</button>
        <span aria-hidden>/</span>
        <span>{employee.firstName} {employee.lastName}</span>
      </div>

      <EmployeeHero employee={employee} profile={profile} onTab={goTo} actions={<>
        <button type="button" className="btn btn-ghost" disabled={inactive} onClick={() => setModeOpen(true)}
          title={employee.scheduleMode === 'organisation' ? 'Passer au tableau de chargement' : 'Revenir à l’horaire du département'}>
          {employee.scheduleMode === 'organisation' ? <><CalendarClock size={14} aria-hidden /> Tableau de chargement</> : <><Undo2 size={14} aria-hidden /> Horaire du département</>}
        </button>
        <button type="button" className="btn btn-ghost" disabled={inactive} onClick={() => setLeaveOpen(true)}><CalendarCheck size={14} aria-hidden /> Saisir un congé</button>
        <button type="button" className="btn btn-primary" onClick={() => setEditOpen(true)}><Pencil size={14} aria-hidden /> Modifier</button>
      </>} />

      <Tabs<EmployeeTab> label="Sections de la fiche" value={tab} onChange={setTab} tabs={[
        { id: 'apercu', label: 'Vue d’ensemble' },
        { id: 'temps', label: 'Temps de travail' },
        { id: 'conges', label: 'Congés', count: pending || undefined },
        { id: 'remuneration', label: 'Rémunération' },
        { id: 'acces', label: 'Accès' },
        { id: 'historique', label: 'Historique', count: employee.history.length },
      ]} />

      <div className="emp-tab">
        {tab === 'apercu' && <OverviewTab employee={employee} profile={profile} onTab={goTo} />}
        {tab === 'temps' && <WorkTimeTab employee={employee} onSwitch={() => setModeOpen(true)} />}
        {tab === 'conges' && (
          <div className="fstack">
            <ProfileTab profile={profile} key={`p-${employee.id}`} />
            <FormCard icon={<CalendarCheck size={16} />} title="Demandes de congé" subtitle={`${requests.length} demande${requests.length > 1 ? 's' : ''}${pending ? ` · ${pending} en attente` : ''}`}
              actions={<button type="button" className="btn btn-sm btn-primary" disabled={inactive} onClick={() => setLeaveOpen(true)}><Plus size={14} aria-hidden /> Nouvelle demande</button>}>
              <LeaveTable requests={requests} onOpen={setOpenReq} hideEmployee emptyText="Aucune demande pour cet employé." />
            </FormCard>
            <FormCard icon={<GitBranch size={16} />} title="Circuit d’approbation" subtitle="Hérité du département, appliqué automatiquement à chaque demande.">
              <CircuitChain employee={employee} profile={profile} />
            </FormCard>
          </div>
        )}
        {tab === 'remuneration' && <RemunerationTab employee={employee} />}
        {tab === 'acces' && <AccessTab profile={profile} key={`a-${employee.id}`} />}
        {tab === 'historique' && <HistoryTab employee={employee} />}
      </div>

      <EmployeeForm open={editOpen} employee={employee} onClose={() => setEditOpen(false)} />
      <ScheduleModeModal employee={employee} open={modeOpen} onClose={() => setModeOpen(false)} />
      <LeaveForm open={leaveOpen} onClose={() => setLeaveOpen(false)} defaultEmployeeId={employee.id} onCreated={setOpenReq} />
      {openReq && <LeaveDetail requestId={openReq} onClose={() => setOpenReq(undefined)} />}
    </>
  );
}
