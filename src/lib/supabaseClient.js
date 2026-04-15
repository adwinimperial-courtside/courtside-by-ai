import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bikjkoyodkduhnnlbzpb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_feazoLkkfHT18LYN5HhNzw_GiOWA58o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
