// Single source of truth for release notes.
// Used by the in-app "What's new" screen and by the release workflow
// (.github/workflows/release.yml) to fill the GitHub release body.
// Newest version first. Keep entries short and user-facing.
export const CHANGELOG = [
  {
    version: '1.3.0',
    date: '2026-06-26',
    changes: [
      'New Settings screen — hide salaries, switch theme, check for updates and view the changelog in one place.',
      'Light theme with a quick toggle.',
      'Redesigned Insights: response rate, offer rate, interviews, recent activity and an application funnel.',
      "What's new screen so you can see what changed in each release.",
      'Open Settings by tapping your avatar (removed the extra gear button).',
      'Fixed delete buttons appearing dark on the light theme.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-26',
    changes: [
      'One-tap updates: download the new APK and launch the installer right from the app.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-26',
    changes: [
      'Update prompt redesigned as a bottom sheet.',
      'Sign-up no longer dead-ends when email confirmation is enabled.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-26',
    changes: [
      'First release — track applications with statuses, a timeline, salaries and sources.',
      'Email + password sign-in backed by Supabase.',
    ],
  },
];
