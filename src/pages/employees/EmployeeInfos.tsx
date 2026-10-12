// Onglet « Infos générales » (RH-5) : identité, situation familiale et coordonnées, modifiables sur place,
// champ par champ ; chaque modification est enregistrée aussitôt et inscrite dans l'historique.
import { AtSign, Hash, HeartHandshake, MapPin, Phone, UserRound } from 'lucide-react';
import { useCompanyData, useStore } from '../../store';
import type { Employee, LeaveProfile, MaritalStatus } from '../../types';
import { diffDays, formatDate, TODAY } from '../../utils/dates';
import { MARITAL_LABEL } from '../../utils/org';
import { formatPhone, phoneError } from '../../utils/phone';
import { FormCard } from '../../components/FormCard';
import { InlineField } from '../../components/InlineField';
import { PhoneField } from '../../components/PhoneField';

export function InfosTab({ employee, profile }: { employee: Employee; profile: LeaveProfile }) {
  const { saveEmployee, toast } = useStore();
  const data = useCompanyData();
  const others = data.employees.filter((e) => e.id !== employee.id);
  const age = employee.birthDate ? Math.floor(diffDays(employee.birthDate, TODAY) / 365.25) : undefined;

  const update = (patch: Partial<Employee>, label: string) => {
    saveEmployee({ ...employee, ...patch }, profile);
    toast(`${label} mis à jour`);
  };
  const required = (label: string) => (v: string) => (v.trim() ? undefined : `${label} requis.`);
  const unique = (label: string, key: 'matricule' | 'companyMatricule') => (v: string) => {
    if (!v.trim()) return `${label} requis.`;
    return others.some((e) => (e[key] ?? '').trim().toLowerCase() === v.trim().toLowerCase()) ? `Ce ${label.toLowerCase()} est déjà attribué.` : undefined;
  };
  const text = (v: string, set: (v: string) => void, id: string, extra?: { type?: string; placeholder?: string; mono?: boolean }) =>
    <input id={id} type={extra?.type ?? 'text'} value={v} placeholder={extra?.placeholder} className={extra?.mono ? 'mono' : undefined} onChange={(e) => set(e.target.value)} />;

  return (
    <div className="fstack">
      <p className="if-intro">Cliquez sur une valeur pour la modifier : <kbd>Entrée</kbd> enregistre, <kbd>Échap</kbd> annule. Chaque modification est inscrite dans l’historique.</p>

      <div className="if-layout">
        <FormCard icon={<UserRound size={16} />} title="Identité">
          <div className="if-grid">
            <InlineField label="Prénom" required value={employee.firstName} display={employee.firstName}
              validate={required('Prénom')} onSave={(v) => update({ firstName: v.trim() }, 'Prénom')} render={(v, set, id) => text(v, set, id)} />
            <InlineField label="Nom" required value={employee.lastName} display={employee.lastName}
              validate={required('Nom')} onSave={(v) => update({ lastName: v.trim() }, 'Nom')} render={(v, set, id) => text(v, set, id)} />
            <InlineField label="Matricule application" required value={employee.matricule} display={<span className="mono"><Hash size={12} aria-hidden className="inline-icon" />{employee.matricule}</span>}
              hint="Unique dans la société." validate={unique('Matricule', 'matricule')} onSave={(v) => update({ matricule: v.trim() }, 'Matricule')} render={(v, set, id) => text(v, set, id, { mono: true })} />
            <InlineField label="Matricule société" value={employee.companyMatricule ?? ''} display={employee.companyMatricule && <span className="mono">{employee.companyMatricule}</span>}
              hint="Code interne attribué par la société." validate={unique('Matricule société', 'companyMatricule')} onSave={(v) => update({ companyMatricule: v.trim() }, 'Matricule société')} render={(v, set, id) => text(v, set, id, { mono: true, placeholder: 'Ex. : AC-00457' })} />
            <InlineField label="Date de naissance" value={employee.birthDate} display={employee.birthDate && <>{formatDate(employee.birthDate)} <span className="text-muted">· {age} ans</span></>}
              validate={(v) => (v && v > TODAY ? 'Date dans le futur.' : undefined)} onSave={(v) => update({ birthDate: v }, 'Date de naissance')}
              render={(v, set, id) => <input id={id} type="date" value={v} max={TODAY} onChange={(e) => set(e.target.value)} />} />
          </div>
        </FormCard>

        <FormCard icon={<HeartHandshake size={16} />} title="Situation familiale" subtitle="Historisée : utile au calcul des droits et de la paie.">
          <div className="if-grid if-highlight">
            <InlineField<MaritalStatus> label="Situation matrimoniale" required value={employee.maritalStatus} display={MARITAL_LABEL[employee.maritalStatus]}
              onSave={(v) => update({ maritalStatus: v }, 'Situation matrimoniale')}
              render={(v, set, id) => (
                <select id={id} value={v} onChange={(e) => set(e.target.value as MaritalStatus)}>
                  {(Object.keys(MARITAL_LABEL) as MaritalStatus[]).map((k) => <option key={k} value={k}>{MARITAL_LABEL[k]}</option>)}
                </select>
              )} />
            <InlineField<number> label="Enfants à charge" required value={employee.childrenCount} display={employee.childrenCount === 0 ? 'Aucun' : `${employee.childrenCount} enfant${employee.childrenCount > 1 ? 's' : ''}`}
              validate={(v) => (Number.isInteger(v) && v >= 0 ? undefined : 'Nombre entier positif ou nul.')} onSave={(v) => update({ childrenCount: v }, 'Enfants à charge')}
              render={(v, set, id) => <input id={id} type="number" min={0} step={1} value={v} onChange={(e) => set(e.target.value === '' ? 0 : Number(e.target.value))} />} />
          </div>
        </FormCard>
      </div>

      <FormCard icon={<AtSign size={16} />} title="Coordonnées">
        <div className="if-grid cols-3">
          <InlineField label="E-mail professionnel" required value={employee.email} display={<><AtSign size={12} aria-hidden className="inline-icon" />{employee.email}</>}
            validate={(v) => (/^\S+@\S+\.\S+$/.test(v) ? undefined : 'Adresse e-mail invalide.')} onSave={(v) => update({ email: v.trim() }, 'E-mail')}
            render={(v, set, id) => text(v, set, id, { type: 'email', placeholder: 'prenom.nom@societe.ma' })} />
          <InlineField<{ countryId?: string; phone: string }> label="Téléphone" value={{ countryId: employee.phoneCountryId, phone: employee.phone }}
            display={employee.phone && <><Phone size={12} aria-hidden className="inline-icon" />{formatPhone(data.country(employee.phoneCountryId), employee.phone)}</>}
            validate={(v) => phoneError(data.country(v.countryId), v.phone)} onSave={(v) => update({ phoneCountryId: v.countryId, phone: v.phone }, 'Téléphone')}
            render={(v, set, id) => (
              <PhoneField id={id} value={v.phone} countryId={v.countryId} countries={data.countries.filter((c) => !c.archived || c.id === v.countryId)}
                onChange={(countryId, phone) => set({ countryId, phone })} />
            )} />
          <InlineField label="Adresse postale" value={employee.address} display={employee.address && <><MapPin size={12} aria-hidden className="inline-icon" />{employee.address}</>}
            onSave={(v) => update({ address: v.trim() }, 'Adresse')} render={(v, set, id) => text(v, set, id, { placeholder: 'Rue, ville, code postal' })} />
        </div>
      </FormCard>
    </div>
  );
}
