const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Prefer service key to bypass RLS for server-side read/write, fall back to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables in .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;