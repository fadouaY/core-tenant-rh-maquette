import { BadgePercent, Briefcase, Coins, Building2, CalendarCheck, CalendarOff, Clock, FileSignature, FileText, GitBranch, Globe, IdCard, ListChecks, Settings, ShieldCheck } from 'lucide-react';
import { useCompanyData } from '../../store';
import { PageHeader } from '../../components/ui';
import { CircuitsSection } from './CircuitsSection';
import { DepartmentsSection, FunctionsSection } from './OrganisationSections';
import { HolidaysSection, SchedulesSection } from './ReferenceSections';
import { RulesAndPresence } from './PresenceRules';
import { LeaveTypesSection } from './LeaveTypesSection';
import { RolesSection } from './RolesSection';
import { CountriesSection } from './CountriesSection';
import { PrimesSection } from './PrimesSection';
import { DocumentTypesSection } from './DocumentTypesSection';
import { NumberingSection } from './NumberingSection';
import { ContractTypesSection } from './ContractTypesSection';
import { CurrencySection } from './CurrencySection';

/** Sous-sections des paramètres, dans l'ordre de la sous-navigation du shell. */
export const SETTINGS_SECTIONS = [
  { id: 'numerotation', group: 'Numérotation', label: 'Numéro de souche', icon: IdCard, Component: NumberingSection },
  { id: 'departements', group: 'Organisation', label: 'Départements', icon: Building2, Component: DepartmentsSection },
  { id: 'fonctions', group: 'Organisation', label: 'Fonctions', icon: Briefcase, Component: FunctionsSection },
  { id: 'roles', group: 'Accès et validation', label: 'Rôles et permissions', icon: ShieldCheck, Component: RolesSection },
  { id: 'circuits', group: 'Accès et validation', label: 'Circuits d’approbation', icon: GitBranch, Component: CircuitsSection },
  { id: 'horaires', group: 'Temps de travail', label: 'Scénarios d’horaires', icon: Clock, Component: SchedulesSection },
  { id: 'types-contrat', group: 'Contrats et rémunération', label: 'Types de contrat', icon: FileSignature, Component: ContractTypesSection },
  { id: 'primes', group: 'Contrats et rémunération', label: 'Catalogue des primes', icon: BadgePercent, Component: PrimesSection },
  { id: 'types-document', group: 'Contrats et rémunération', label: 'Types de documents', icon: FileText, Component: DocumentTypesSection },
  { id: 'types-conge', group: 'Congés', label: 'Types de congé', icon: CalendarCheck, Component: LeaveTypesSection },
  { id: 'regles', group: 'Congés', label: 'Règles et quotas', icon: ListChecks, Component: RulesAndPresence },
  { id: 'jours-feries', group: 'Congés', label: 'Jours fériés', icon: CalendarOff, Component: HolidaysSection },
  { id: 'devise', group: 'Référentiels', label: 'Devise', icon: Coins, Component: CurrencySection },
  { id: 'pays', group: 'Référentiels', label: 'Pays et téléphone', icon: Globe, Component: CountriesSection },
] as const;

export function SettingsPage({ param }: { param?: string }) {
  const data = useCompanyData();
  const current = SETTINGS_SECTIONS.find((s) => s.id === param) ?? SETTINGS_SECTIONS[0];
  const { Component } = current;
  return (
    <>
      <PageHeader eyebrow="Application RH · Paramètres" icon={<Settings size={20} strokeWidth={1.8} />} title={current.label} subtitle={<>Configuration propre à <strong>{data.company.name}</strong>. Les éléments archivés restent visibles dans l’historique.</>} />
      <div key={`${data.company.id}-${current.id}`}><Component /></div>
    </>
  );
}
