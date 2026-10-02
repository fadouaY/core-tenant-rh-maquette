import { EmployeeDetail } from './EmployeeDetail';
import { EmployeeList } from './EmployeeList';

/** Section Employés : liste, ajout (#/employes/nouveau) et fiche (#/employes/:id). */
export function EmployeesPage({ param }: { param?: string }) {
  if (param && param !== 'nouveau') return <EmployeeDetail employeeId={param} />;
  return <EmployeeList addOpen={param === 'nouveau'} />;
}
