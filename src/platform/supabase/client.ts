import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Type-safe database interface
export type Database = {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          key_name: string;
          key_value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key_name: string;
          key_value: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key_name?: string;
          key_value?: string;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: string;
          user_email: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          company: string | null;
          job_title: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          birthday: string | null;
          notes: string | null;
          relationship: string | null;
          tags: string[] | null;
          color: string | null;
          photo: string | null;
          enriched: boolean | null;
          socials: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_email: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          job_title?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          birthday?: string | null;
          notes?: string | null;
          relationship?: string | null;
          tags?: string[] | null;
          color?: string | null;
          photo?: string | null;
          enriched?: boolean | null;
          socials?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_email?: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          job_title?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          birthday?: string | null;
          notes?: string | null;
          relationship?: string | null;
          tags?: string[] | null;
          color?: string | null;
          photo?: string | null;
          enriched?: boolean | null;
          socials?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      integrations_credentials: {
        Row: {
          id: string;
          user_id: string;
          integration_name: string;
          email: string | null;
          username: string | null;
          password: string | null;
          api_key: string | null;
          status: string | null;
          label: string | null;
          color: string | null;
          icon: string | null;
          oauth_provider: string | null;
          oauth_access_token: string | null;
          oauth_refresh_token: string | null;
          oauth_expires_at: string | null;
          oauth_scope: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          integration_name: string;
          email?: string | null;
          username?: string | null;
          password?: string | null;
          api_key?: string | null;
          status?: string | null;
          label?: string | null;
          color?: string | null;
          icon?: string | null;
          oauth_provider?: string | null;
          oauth_access_token?: string | null;
          oauth_refresh_token?: string | null;
          oauth_expires_at?: string | null;
          oauth_scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          integration_name?: string;
          email?: string | null;
          username?: string | null;
          password?: string | null;
          api_key?: string | null;
          status?: string | null;
          label?: string | null;
          color?: string | null;
          icon?: string | null;
          oauth_provider?: string | null;
          oauth_access_token?: string | null;
          oauth_refresh_token?: string | null;
          oauth_expires_at?: string | null;
          oauth_scope?: string | null;
          updated_at?: string;
        };
      };
      user_data: {
        Row: {
          id: string;
          user_id: string;
          key_name: string;
          value: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          key_name: string;
          value: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          key_name?: string;
          value?: unknown;
          updated_at?: string;
        };
      };
    };
  };
};

export default supabase;