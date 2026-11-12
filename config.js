// Public values only. Never put the Groq key, the Supabase service_role key or any secret here.
// The Supabase anon/publishable key is designed to be public: Row Level Security protects the data.
export const CONFIG = {
  API_BASE_URL: "https://mindmate-ai-84he.onrender.com",   // production: your Render URL, e.g. https://mindmate-api.onrender.com
  SUPABASE_URL: "https://bhsfvdwazcbyluwezmsx.supabase.co",                          // e.g. https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_53dnw0ZER0R_RWPPBDuRTA_oE0Ev7_k",                     // Project Settings > API > anon / publishable key
};
