import { createLocalBackend } from './localBackend';

// Phase 3 deliberately keeps every deployed build read-only. The existing
// Supabase adapter/schema remain available for the future owner-access work.
export const localEditing = import.meta.env.DEV;
export const configurationError = localEditing ? null : 'This deployed archive is read-only. Edit the collection through the local development server, then rebuild for deployment.';
export const archiveBackend = localEditing ? createLocalBackend() : null;
