import { ChevronRight, Paperclip } from 'lucide-react';
import { useCompanyData } from '../../store';
import type { ID, LeaveRequest } from '../../types';
import { formatRange } from '../../utils/dates';
import { formatRequestDuration } from '../../utils/hours';
import { currentStep } from '../../utils/leave';
import { EmptyState, LeaveStatusBadge, LeaveTypeTag, PersonCell } from '../../components/ui';

export function LeaveTable({ requests, onOpen, hideEmployee, emptyText }: {
  requests: LeaveRequest[]; onOpen: (id: ID) => void; hideEmployee?: boolean; emptyText?: string;
}) {
  const data = useCompanyData();
  if (requests.length === 0) {
    return <EmptyState title="Aucune demande" text={emptyText ?? 'Aucune demande ne correspond aux filtres sélectionnés.'} />;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {!hideEmployee && <th scope="col">Employé</th>}
            <th scope="col">Type</th>
            <th scope="col">Dates</th>
            <th scope="col" className="num">Durée</th>
            <th scope="col">Statut</th>
            <th scope="col">Approbateur actuel</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const emp = data.person(r.employeeId);
            const step = currentStep(r);
            return (
              <tr key={r.id} className="row-click" onClick={() => onOpen(r.id)}>
                {!hideEmployee && <td><PersonCell employee={emp} sub={data.departmentName(emp?.departmentId)} /></td>}
                <td><LeaveTypeTag type={data.leaveType(r.leaveTypeId)} />{r.attachment && <Paperclip size={13} className="inline-icon text-muted ml-4" aria-label="Justificatif joint" />}</td>
                <td className="nowrap">{formatRange(r.start, r.end)}{r.startTime ? <span className="text-muted small"> · {r.startTime}–{r.endTime}</span> : (r.startPart !== 'full' || r.endPart !== 'full') && <span className="text-muted small"> · ½ j</span>}</td>
                <td className="num">{formatRequestDuration(r)}</td>
                <td><LeaveStatusBadge status={r.status} /></td>
                <td>
                  {step ? (
                    <span className="small">
                      {data.person(step.approverId)?.firstName} {data.person(step.approverId)?.lastName}
                      <span className="text-muted"> · étape {step.order}/{r.steps.length}</span>
                    </span>
                  ) : <span className="text-muted small">{r.exempt ? 'Dispensé' : '—'}</span>}
                </td>
                <td className="actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}
                    aria-label={`Ouvrir la demande de ${emp?.firstName} ${emp?.lastName}`}>
                    Détail <ChevronRight size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
