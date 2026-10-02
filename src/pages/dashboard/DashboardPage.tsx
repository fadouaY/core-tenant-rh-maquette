import { useState } from 'react';
import { ArrowRight, CalendarRange, Check, Hourglass, LayoutGrid, Plane, Plus, Users, X } from 'lucide-react';
import { navigate, useCompanyData, useStore } from '../../store';
import { LeaveDetail } from '../leave/LeaveDetail';
import { WeekBoard } from '../calendar/WeekBoard';
import { EffectBadge, EmptyState, LeaveTypeTag, PageHeader, PersonCell, SelectFilter, Segmented } from '../../components/ui';
import { addDays, eachDay, formatDayMonth, formatLong, formatRange, overlaps, startOfWeek, TODAY } from '../../utils/dates';
import { currentStep } from '../../utils/leave';
import { formatRequestDuration } from '../../utils/hours';

type Period = '7' | '14' | '30';

export function DashboardPage() {
  const { currentUser, decide } = useStore();
  const data = useCompanyData();
  const [period, setPeriod] = useState<Period>('14');
  const [departmentId, setDepartmentId] = useState('');
  const [openId, setOpenId] = useState<string>();

  const periodEnd = addDays(TODAY, Number(period) - 1);
  const inDept = (id: string) => !departmentId || data.person(id)?.departmentId === departmentId;
  const active = data.activePeople.filter((e) => inDept(e.id));
  const absentToday = data.requests.filter((r) => r.status === 'approuve' && r.start <= TODAY && r.end >= TODAY && inDept(r.employeeId));
  const pending = data.requests.filter((r) => r.status === 'en_attente' && inDept(r.employeeId));
  const mine = pending.filter((r) => currentStep(r)?.approverId === currentUser.id);
  const upcoming = data.events
    .filter((e) => !e.archived && overlaps(e.start, e.end, TODAY, periodEnd))
    .filter((e) => !departmentId || e.allCompany || e.departmentIds.includes(departmentId))
    .sort((a, b) => a.start.localeCompare(b.start));
  const list = [...mine, ...pending.filter((r) => !mine.includes(r))].slice(0, 6);

  const week = eachDay(startOfWeek(TODAY), addDays(startOfWeek(TODAY), 6));
  const weekReqs = data.requests.filter((r) => (r.status === 'approuve' || r.status === 'en_attente') && overlaps(r.start, r.end, week[0], week[6]));
  const weekPeople = active.filter((p) => weekReqs.some((r) => r.employeeId === p.id));

  const stats = [
    { label: 'Effectif actif', value: active.length, sub: `${data.activeDepartments.length} départements`, to: 'employes', icon: <Users size={16} />, tone: 'blue' },
    { label: 'Absents aujourd’hui', value: absentToday.length, sub: active.length ? `${Math.round((absentToday.length / active.length) * 100)} % de l’effectif` : undefined, to: 'calendrier', icon: <Plane size={16} />, tone: 'teal' },
    { label: 'Demandes en attente', value: pending.length, sub: `dont ${mine.length} pour vous`, to: 'conges/demandes', icon: <Hourglass size={16} />, tone: 'amber' },
    { label: 'Événements à venir', value: upcoming.length, sub: `sur ${period} jours`, to: 'evenements', icon: <CalendarRange size={16} />, tone: 'violet' },
  ];

  return (
    <>
      <PageHeader eyebrow="Application RH · Vue d’ensemble" icon={<LayoutGrid size={20} strokeWidth={1.8} />}
        title={`Bonjour ${currentUser.firstName}`}
        subtitle={<>{data.company.name} · {formatLong(TODAY)}</>}
        actions={<button type="button" className="btn btn-primary" onClick={() => navigate('conges/demandes/nouvelle')}><Plus size={15} aria-hidden /> Demander un congé</button>}
        toolbar={
          <>
            <Segmented<Period> label="Période" value={period} onChange={setPeriod}
              options={[{ value: '7', label: '7 jours' }, { value: '14', label: '14 jours' }, { value: '30', label: '30 jours' }]} />
            <SelectFilter label="Département" value={departmentId} onChange={setDepartmentId} allLabel="Tous les départements"
              options={data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))} />
          </>
        }
      />

      <div className="stat-strip">
        {stats.map((s) => (
          <a key={s.label} href={`#/${s.to}`} className={`stat stat-${s.tone}`}>
            <span className="stat-top">
              <span className="stat-label">{s.label}</span>
              <span className="stat-icon" aria-hidden>{s.icon}</span>
            </span>
            <span className="stat-value">{s.value}</span>
            {s.sub && <span className="stat-sub">{s.sub}</span>}
          </a>
        ))}
      </div>

      <div className="dash-grid dash-refined">
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Demandes à traiter</h2>
            <a href="#/conges/demandes" className="link">Toutes <ArrowRight size={12} aria-hidden /></a>
          </div>
          {list.length === 0 ? <EmptyState title="Aucune demande en attente" /> : (
            <ul className="request-list">
              {list.map((r) => {
                const p = data.person(r.employeeId);
                const step = currentStep(r)!;
                const isMine = step.approverId === currentUser.id;
                const approver = data.person(step.approverId);
                return (
                  <li key={r.id}>
                    <button type="button" className="request-main" onClick={() => setOpenId(r.id)}>
                      <PersonCell employee={p} link sub={<><LeaveTypeTag type={data.leaveType(r.leaveTypeId)} /> · {formatRange(r.start, r.end)}{r.startTime ? ` · ${r.startTime}–${r.endTime}` : ''} · {formatRequestDuration(r)}</>} />
                    </button>
                    <div className="request-side">
                      {isMine ? (
                        <>
                          <span className="decision-pill">Votre décision · {step.order}/{r.steps.length}</span>
                          <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" aria-label={`Refuser la demande de ${p?.firstName}`} title="Refuser (motif requis)" onClick={() => setOpenId(r.id)}><X size={14} /></button>
                          <button type="button" className="icon-btn icon-btn-sm icon-btn-success" aria-label={`Approuver la demande de ${p?.firstName}`} title="Approuver" onClick={() => decide(r.id, 'approve', '')}><Check size={14} /></button>
                        </>
                      ) : <span className="waiting-at">Chez {approver?.firstName} {approver?.lastName} <span className="step-count">{step.order}/{r.steps.length}</span></span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Événements à venir</h2>
            <a href="#/evenements" className="link">Tous <ArrowRight size={12} aria-hidden /></a>
          </div>
          {upcoming.length === 0 ? <EmptyState title="Aucun événement" text="Rien de prévu sur la période." /> : (
            <ul className="event-list">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <span className="date-tile" aria-label={formatDayMonth(e.start)}><span className="date-tile-day">{Number(e.start.slice(8))}</span><span className="date-tile-month">{formatDayMonth(e.start).split(' ')[1]}</span></span>
                  <span className="event-body">
                    <span className="person-name">{e.name}</span>
                    <span className="person-sub">{e.allCompany ? 'Toute la société' : e.departmentIds.map((d) => data.departmentName(d)).join(', ')}</span>
                  </span>
                  <EffectBadge effect={e.effect} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <div className="section-head">
          <h2 className="section-title">Absences de la semaine</h2>
          <a href="#/calendrier" className="link">Ouvrir le calendrier <ArrowRight size={12} aria-hidden /></a>
        </div>
        <WeekBoard days={week} people={weekPeople} requests={weekReqs} events={[]} onOpen={setOpenId} emptyText="Personne n’est absent cette semaine." />
      </section>

      {openId && <LeaveDetail requestId={openId} onClose={() => setOpenId(undefined)} />}
    </>
  );
}
