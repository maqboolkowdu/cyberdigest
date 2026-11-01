/* CyberDigest — backend settings.
   Leave both values empty and the app runs exactly as before: no sign-in, no usage stats.
   To switch them on, follow docs/SUPABASE-SETUP.md and paste your project's values here.
   The anon key is meant to be public: the database rules in supabase/setup.sql only let
   visitors add usage events, never read or change anything. */
window.CD_CONFIG = {
  supabaseUrl: 'https://nrwkxvnkalbsezemtrex.supabase.co',
  supabaseAnonKey: 'sb_publishable_RtpfJAJYVXG7_q7cuZn9eg_sOJMElPd', // publishable (public) key
  // Shown to visitors so they know which email to look for. Update it after setting up your own
  // email sender (custom SMTP), e.g. 'CyberDigest <no-reply@yourdomain.com>'.
  emailSender: 'CyberDigest <maqbool.kowdu@12643788.brevosend.com>',
};
