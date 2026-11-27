// Public client configuration. The publishable key is meant to ship to browsers:
// Row Level Security (see schema.sql) is what protects the data.
// Never put a service_role key here.
window.WISH_TREE_CONFIG = {
  SUPABASE_URL: 'https://tcrtkzqqcpzksjzbtiew.supabase.co',
  SUPABASE_KEY: 'sb_publishable_3r4X8t2uCC0Aw6tFJsEoig_2LsCQ6QR',
  FEATURED_SLUG: 'hhan', // shown when the URL has no ?t=
  ENABLE_EMAIL: false, // magic links are rate limited on Supabase's shared mailer; set true once a custom SMTP is configured
  ENABLE_GOOGLE: true, // needs OAuth credentials + the provider enabled in Supabase
  ENABLE_PHONE: false, // needs an SMS provider configured in Supabase
  ENABLE_FOREST: false, // hides every link to the forest (and the strangers' tree switch); ?view=forest still opens it for previewing
};
