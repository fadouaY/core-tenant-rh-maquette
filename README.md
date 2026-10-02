# Core tenant · Application RH — maquette

Maquette statique et navigable d'une plateforme multi-sociétés :

- **Core tenant** : catalogue d'applications, sociétés (avec administrateur obligatoire), utilisateurs affectés aux applications par société, quotas de sociétés et d'utilisateurs, écrans de connexion et d'inscription.
- **Application RH** : tableau de bord, employés (rôles et permissions hors rôle), congés et autorisations en heures, soldes, calendrier, événements, paramètres (départements, fonctions solo / groupe, horaires et créneaux, types de congé, règles de présence, jours fériés, pays et téléphone, rôles, circuits d'approbation).

Aucune donnée n'est envoyée : tout est simulé en mémoire (données fictives « Groupe Atlas »). Aucun mot de passe n'est stocké ; seule la session de démonstration (identifiant utilisateur) est gardée dans le navigateur.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée par Vite et utiliser « Remplir avec f.yakoubi » sur l'écran de connexion.

```bash
npm run build
```

## Pile technique

React 18 · TypeScript · Vite 5 · lucide-react · CSS sans framework (`src/styles.css`, `src/refine.css`, `src/auth/auth.css`).
