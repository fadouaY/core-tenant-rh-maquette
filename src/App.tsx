import { useEffect, useRef } from 'react';
import { Shell } from './shell/Shell';
import { EmptyState, Toasts } from './components/ui';
import { useRoute, useStore } from './store';
import { ApplicationsPage } from './core/ApplicationsPage';
import { CompaniesPage } from './core/CompaniesPage';
import { UsersPage } from './core/UsersPage';
import { CredentialsNotice } from './core/shared';
import { AuthPage, type AuthMode } from './auth/AuthPage';
import { navigate } from './store';
import { CalendarPage } from './pages/calendar/CalendarPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { EmployeesPage } from './pages/employees/EmployeesPage';
import { EventsPage } from './pages/events/EventsPage';
import { LeavesPage } from './pages/leave/LeavesPage';
import { LoadingBoardPage } from './pages/loading/LoadingBoardPage';
import { SettingsPage } from './pages/settings/SettingsPage';

// Core tenant : #/core/applications[/rh], #/core/societes[/nouvelle|/:id], #/core/utilisateurs[/nouveau|/:id]
// Application RH : #/tableau-de-bord, #/employes[/nouveau|/:id], #/conges/demandes[/nouvelle|/:id], #/conges/soldes,
//                  #/calendrier[/perso], #/evenements, #/chargement, #/parametres/:section
const AUTH_ROUTES: AuthMode[] = ['connexion', 'inscription', 'mot-de-passe-oublie'];

// À l'ouverture (ou au rechargement), on arrive toujours sur la connexion, jamais directement sur l'inscription.
if (/^#\/(inscription|mot-de-passe-oublie)/.test(window.location.hash)) {
  history.replaceState(null, '', '#/connexion');
}

export default function App() {
  const route = useRoute();
  const { sessionUserId } = useStore();
  const isCore = route.length === 0 || route[0] === 'core';
  const authRoute = AUTH_ROUTES.find((r) => r === route[0]);
  // Page demandée avant connexion, pour y revenir ensuite.
  const intended = useRef<string>();
  useEffect(() => { window.scrollTo(0, 0); }, [route.join('/')]);
  useEffect(() => {
    if (!sessionUserId && !authRoute && route.length) intended.current = route.join('/');
    if (sessionUserId && authRoute) navigate('core/applications');
  }, [sessionUserId, authRoute, route]);

  if (!sessionUserId) {
    return (
      <>
        <AuthPage mode={authRoute ?? 'connexion'} onDone={() => navigate(intended.current ?? 'core/applications')} />
        <Toasts />
      </>
    );
  }
  return (
    <>
      {isCore ? <CoreApp section={route[1] ?? 'applications'} param={route[2]} /> : <RhApp route={route} />}
      <Toasts />
      <CredentialsNotice />
    </>
  );
}

function CoreApp({ section, param }: { section: string; param?: string }) {
  return (
    <Shell mode="core" app={section} section="">
      <div className="page">{section === 'societes' ? <CompaniesPage param={param} /> : section === 'utilisateurs' ? <UsersPage param={param} /> : <ApplicationsPage param={param} />}</div>
    </Shell>
  );
}

function RhApp({ route }: { route: string[] }) {
  const { companyId, setCompanyId, companiesFor } = useStore();
  const [section = 'tableau-de-bord', a, b] = route;
  const allowed = companiesFor('rh');
  const enabled = allowed.some((c) => c.id === companyId);

  // L'application RH ne s'ouvre que pour une société où elle est activée.
  useEffect(() => { if (!enabled && allowed[0]) setCompanyId(allowed[0].id); }, [enabled, allowed, setCompanyId]);
  if (!enabled) {
    return (
      <Shell mode="core" app="applications" section="">
        <EmptyState title="Application RH non activée" text="Activez l’Application RH pour au moins une société dans le core tenant."
          action={<a className="btn btn-primary" href="#/core/applications/rh">Gérer l’accès</a>} />
      </Shell>
    );
  }

  const sub = section === 'conges' ? (a ?? 'demandes') : section === 'parametres' ? (a ?? 'departements') : a ?? '';
  let page;
  switch (section) {
    case 'employes': page = <EmployeesPage param={a} />; break;
    case 'conges': page = <LeavesPage section={sub} param={b} />; break;
    case 'calendrier': page = <CalendarPage param={a} />; break;
    case 'evenements': page = <EventsPage />; break;
    case 'chargement': page = <LoadingBoardPage />; break;
    case 'parametres': page = <SettingsPage param={sub} />; break;
    default: page = <DashboardPage />;
  }
  return (
    <Shell mode="rh" app={section} section={sub}>
      {/* La clé remonte la page au changement de société pour réinitialiser filtres et sélections. */}
      <div key={companyId} className="page">{page}</div>
    </Shell>
  );
}
