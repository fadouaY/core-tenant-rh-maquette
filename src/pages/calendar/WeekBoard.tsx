// Planning hebdomadaire par collaborateur : une ligne par personne, des blocs d'absence sur plusieurs jours.
import { Check, Clock } from 'lucide-react';
import { useCompanyData } from '../../store';
import { Avatar, EmptyState } from '../../components/ui';
import type { PersonView, HrEvent, LeaveRequest } from '../../types';
import { formatRange, formatWeekdayShort, isoWeekday, TODAY } from '../../utils/dates';
import { eventTargets } from '../../utils/leave';
import { formatRequestDuration } from '../../utils/hours';

interface Props {
  days: string[];
  people: PersonView[];
  requests: LeaveRequest[];
  events: HrEvent[];
  onOpen: (id: string) => void;
  emptyText?: string;
}

const plural = (n: number) => `${String(n).replace('.', ',')} jour${n > 1 ? 's' : ''}`;

export function WeekBoard({ days, people, requests, events, onOpen, emptyText }: Props) {
  const data = useCompanyData();
  const first = days[0];
  const last = days[days.length - 1];
  const holidays = new Map(data.holidays.filter((h) => !h.archived).map((h) => [h.date, h.name]));
  const cols = `minmax(150px, 190px) repeat(${days.length}, minmax(84px, 1fr))`;
  const span = (start: string, end: string) => {
    const a = Math.max(0, days.indexOf(start < first ? first : start));
    const b = days.indexOf(end > last ? last : end);
    return `${a + 2} / ${b + 3}`;
  };
  const dayClass = (d: string) => `${isoWeekday(d) >= 6 ? 'off' : ''} ${holidays.has(d) ? 'holiday' : ''} ${d === TODAY ? 'today' : ''}`;
  const weekEvents = events.filter((e) => e.start <= last && e.end >= first);

  return (
    <div className="wb-scroll">
      <div className="wb" role="table" aria-label={`Planning du ${formatRange(first, last)}`} style={{ ['--wb-cols' as string]: cols }}>
        <div className="wb-row wb-head" role="row">
          <span className="wb-name" role="columnheader"><span className="sr-only">Collaborateur</span></span>
          {days.map((d) => (
            <span key={d} role="columnheader" className={`wb-day ${dayClass(d)}`} title={holidays.get(d)}>
              <span className="wb-dow">{formatWeekdayShort(d)}</span>
              <span className="wb-date">{Number(d.slice(8))}</span>
              {holidays.has(d) && <span className="wb-holiday">{holidays.get(d)}</span>}
            </span>
          ))}
        </div>

        {weekEvents.length > 0 && (
          <div className="wb-row wb-events" role="row">
            <span className="wb-name wb-muted" role="rowheader" style={{ gridRow: `1 / ${weekEvents.length + 1}` }}>Événements</span>
            {days.map((d, i) => <span key={d} className={`wb-cell ${dayClass(d)}`} style={{ gridColumn: i + 2, gridRow: `1 / ${weekEvents.length + 1}` }} />)}
            {weekEvents.map((e, i) => (
              <a key={e.id} href="#/evenements" className={`wb-event effect-${e.effect}`}
                style={{ gridColumn: span(e.start, e.end), gridRow: i + 1 }} title={`${e.name} — ${e.description}`}>
                {e.name}
              </a>
            ))}
          </div>
        )}

        {people.length === 0 && <div className="wb-empty"><EmptyState title="Aucune absence" text={emptyText ?? 'Aucun collaborateur ne correspond aux filtres.'} /></div>}

        {people.map((p) => {
          const reqs = requests.filter((r) => r.employeeId === p.id && r.start <= last && r.end >= first);
          return (
            <div key={p.id} className="wb-row" role="row">
              <span className="wb-name" role="rowheader">
                <Avatar employee={p} size={26} />
                <span className="wb-person-text">
                  <a href={`#/employes/${p.id}`} className="wb-person">{p.firstName} {p.lastName}</a>
                  <span className="wb-person-sub">{p.departmentName}</span>
                </span>
              </span>
              {days.map((d, i) => {
                const blocked = events.some((e) => e.effect === 'block' && e.start <= d && e.end >= d && eventTargets(e, p));
                return <span key={d} role="cell" className={`wb-cell ${dayClass(d)} ${blocked ? 'blocked' : ''}`} style={{ gridColumn: i + 2 }} />;
              })}
              {reqs.map((r) => {
                const type = data.leaveType(r.leaveTypeId);
                const pending = r.status === 'en_attente';
                return (
                  <button key={r.id} type="button" className={`wb-block ${pending ? 'pending' : 'approved'}`} style={{ gridColumn: span(r.start, r.end), ['--lt' as string]: type?.color ?? '#64748b' }}
                    onClick={() => onOpen(r.id)} title={`${type?.name} · ${formatRange(r.start, r.end)} · ${formatRequestDuration(r)}`}
                    aria-label={`${p.firstName} ${p.lastName}, ${type?.name}, ${formatRange(r.start, r.end)}, ${formatRequestDuration(r)}, ${pending ? 'soumis' : 'approuvé'}`}>
                    <span className="wb-block-title">{type?.name}</span>
                    <span className="wb-block-sub">
                      {pending ? <Clock size={11} aria-hidden /> : <Check size={11} aria-hidden />}
                      {pending ? 'Soumis' : 'Approuvé'} · {r.hours != null ? `${r.startTime}–${r.endTime}` : plural(r.days)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
