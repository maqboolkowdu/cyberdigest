/* CyberDigest — backend settings.
   Leave both values empty and the app runs exactly as before: no sign-in, no usage stats.
   To switch them on, follow docs/SUPABASE-SETUP.md and paste your project's values here.
   The anon key is meant to be public: the database rules in supabase/setup.sql only let
   visitors add usage events, never read or change anything. */
window.CD_CONFIG = {
  supabaseUrl: '',       // e.g. 'https://abcdefghijklmnop.supabase.co'
  supabaseAnonKey: '',   // Project Settings → API → anon public key
};
