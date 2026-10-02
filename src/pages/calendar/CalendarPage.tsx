import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { navigate, useCompanyData, useStore } from '../../store';
import { LeaveDetail } from '../leave/LeaveDetail';
import { WeekBoard } from './WeekBoard';
import { Segmented, SelectFilter } from '../../components/ui';
import type { HrEvent, LeaveRequest } from '../../types';
import {
  addDays, addMonths, eachDay, endOfMonth, formatDate, formatDayMonth, formatMonth, isoWeekday, overlaps, startOfMonth, startOfWeek, TODAY,
} from '../../utils/dates';
import { eventTargets } from '../../utils/leave';

type Mode = 'mois' | 'semaine';
type Scope = 'equipe' | 'perso';

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

export function CalendarPage({ param }: { param?: string }) {
  const { currentUser } = useStore();
  const data = useCompanyData();
  const [mode, setMode] = useState<Mode>('semaine');
  const scope: Scope = param === 'perso' ? 'perso' : 'equipe';
  const [cursor, setCursor] = useState(TODAY);
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [showPending, setShowPending] = useState(true);
  const [openId, setOpenId] = useState<string>();

  const weekStart = startOfWeek(cursor);
  const range = mode === 'mois'
    ? { start: startOfWeek(startOfMonth(cursor)), end: addDays(startOfWeek(endOfMonth(cursor)), 6) }
    : { start: weekStart, end: addDays(weekStart, 6) };
  const days = eachDay(range.start, range.end);

  const me = data.person(currentUser.id);
  const people = useMemo(() => (scope === 'perso'
    ? data.people.filter((e) => e.id === currentUser.id)
    : data.activePeople.filter((e) => !employeeId || e.id === employeeId).filter((e) => !departmentId || e.departmentId === departmentId)
  ), [data, scope, currentUser.id, employeeId, departmentId]);
  const ids = new Set(people.map((e) => e.id));

  const leaves = data.requests.filter((r) =>
    ids.has(r.employeeId) && (r.status === 'approuve' || (showPending && r.status === 'en_attente')) &&
    (!typeId || r.leaveTypeId === typeId) && overlaps(r.start, r.end, range.start, range.end));
  const events = data.events.filter((e) => !e.archived && overlaps(e.start, e.end, range.start, range.end) &&
    (scope === 'perso' ? !!me && eventTargets(e, me) : !departmentId || e.allCompany || e.departmentIds.includes(departmentId)));

  const step = (n: number) => setCursor(mode === 'mois' ? addMonths(cursor, n) : addDays(cursor, 7 * n));
  const title = mode === 'mois' ? formatMonth(cursor) : `${formatDayMonth(range.start)} au ${formatDate(range.end)}`;

  return (
    <>
      <div className="page-header">
        <div className="page-header-top">
          <div className="ph-main">
            <span className="ph-icon" aria-hidden><CalendarDays size={20} strokeWidth={1.8} /></span>
            <div className="ph-text">
              <p className="ph-eyebrow">Application RH · Planning</p>
              <h1>{scope === 'perso' ? 'Mon calendrier' : 'Calendrier des absences'}</h1>
              <p className="page-subtitle">{scope === 'perso' ? 'Vos absences, les jours fériés et les événements qui vous concernent.' : 'Absences de l’équipe, jours fériés et événements sur la période.'}</p>
            </div>
          </div>
          <div className="page-actions">
            <Segmented<Scope> label="Portée" value={scope} onChange={(s) => navigate(s === 'perso' ? 'calendrier/perso' : 'calendrier')}
              options={[{ value: 'equipe', label: 'Équipe' }, { value: 'perso', label: 'Moi' }]} />
            <button type="button" className="btn btn-primary" onClick={() => navigate('conges/demandes/nouvelle')}><Plus size={15} aria-hidden /> Demander un congé</button>
          </div>
        </div>
      </div>

      <div className="cal-toolbar">
        <button type="button" className="btn btn-pill" onClick={() => setCursor(TODAY)}>Aujourd’hui</button>
        <button type="button" className="icon-btn icon-btn-round" onClick={() => step(-1)} aria-label={mode === 'mois' ? 'Mois précédent' : 'Semaine précédente'}><ChevronLeft size={16} /></button>
        <button type="button" className="icon-btn icon-btn-round" onClick={() => step(1)} aria-label={mode === 'mois' ? 'Mois suivant' : 'Semaine suivante'}><ChevronRight size={16} /></button>
        <h2 className="cal-title" aria-live="polite">{title}</h2>
        <span className="spacer" />
        <label htmlFor="cal-mode" className="sr-only">Affichage</label>
        <select id="cal-mode" className="select-pill" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="semaine">Semaine</option>
          <option value="mois">Mois</option>
        </select>
      </div>

      <div className="filters filters-inline">
        {scope === 'equipe' && (
          <>
            <SelectFilter label="Collaborateur" value={employeeId} onChange={setEmployeeId}
              options={data.activePeople.filter((e) => !departmentId || e.departmentId === departmentId).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))} />
            <SelectFilter label="Département" value={departmentId} onChange={(v) => { setDepartmentId(v); setEmployeeId(''); }}
              options={data.activeDepartments.map((d) => ({ value: d.id, label: d.name }))} />
          </>
        )}
        <SelectFilter label="Type d’absence" value={typeId} onChange={setTypeId}
          options={data.leaveTypes.filter((t) => !t.archived).map((t) => ({ value: t.id, label: t.name }))} />
        <label className="check filter-check"><input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} /> Inclure les demandes soumises</label>
      </div>

      {mode === 'semaine'
        ? <WeekBoard days={days} people={people} requests={leaves} events={events} onOpen={setOpenId} />
        : <MonthGrid days={days} cursor={cursor} leaves={leaves} events={events} onOpen={setOpenId} showNames={scope === 'equipe'} />}

      <div className="legend">
        <span><span className="legend-swatch approved" /> Approuvé</span>
        <span><span className="legend-swatch pending" /> Soumis</span>
        <span><span className="legend-swatch holiday" /> Jour férié</span>
        <span><span className="legend-swatch ev-info" /> Informatif</span>
        <span><span className="legend-swatch ev-warning" /> Avertissement</span>
        <span><span className="legend-swatch ev-block" /> Bloquant</span>
      </div>

      {openId && <LeaveDetail requestId={openId} onClose={() => setOpenId(undefined)} />}
    </>
  );
}

function MonthGrid({ days, cursor, leaves, events, onOpen, showNames }: {
  days: string[]; cursor: string; leaves: LeaveRequest[]; events: HrEvent[]; onOpen: (id: string) => void; showNames: boolean;
}) {
  const data = useCompanyData();
  const month = cursor.slice(0, 7);
  const holidays = new Map(data.holidays.filter((h) => !h.archived).map((h) => [h.date, h.name]));
  return (
    <div className="month-wrap">
      <div className="month-grid" role="grid" aria-label={formatMonth(cursor)}>
        {WEEKDAYS.map((d) => <div key={d} className="month-head" role="columnheader">{d}</div>)}
        {days.map((d) => {
          const dayLeaves = leaves.filter((r) => r.start <= d && r.end >= d);
          const dayEvents = events.filter((e) => e.start <= d && e.end >= d);
          const holiday = holidays.get(d);
          const weekend = isoWeekday(d) >= 6;
          return (
            <div key={d} role="gridcell" className={`month-cell ${d.slice(0, 7) !== month ? 'other' : ''} ${weekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''} ${d === TODAY ? 'today' : ''}`}>
              <div className="month-cell-head">
                <span className="month-day">{Number(d.slice(8))}</span>
                {holiday && <span className="holiday-label" title={holiday}>{holiday}</span>}
              </div>
              {dayEvents.map((e) => <a key={e.id} href="#/evenements" className={`cal-chip event effect-${e.effect}`} title={e.description}>{e.name}</a>)}
              {!weekend && !holiday && dayLeaves.slice(0, 3).map((r) => {
                const p = data.person(r.employeeId);
                const pending = r.status === 'en_attente';
                return (
                  <button key={r.id} type="button" className={`cal-chip leave ${pending ? 'pending' : ''}`} onClick={() => onOpen(r.id)}
                    aria-label={`${p?.firstName} ${p?.lastName}, ${data.leaveType(r.leaveTypeId)?.name}, ${pending ? 'soumis' : 'approuvé'}`}>
                    {showNames ? `${p?.firstName} ${p?.lastName[0]}.` : data.leaveType(r.leaveTypeId)?.name}
                  </button>
                );
              })}
              {!weekend && !holiday && dayLeaves.length > 3 && <span className="more">+{dayLeaves.length - 3}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
