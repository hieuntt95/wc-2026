import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  readonly isConfigured = Boolean(
    environment.supabase.url.trim() && environment.supabase.anonKey.trim(),
  );

  readonly client: SupabaseClient | null = this.isConfigured
    ? createClient(environment.supabase.url, environment.supabase.anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
}
