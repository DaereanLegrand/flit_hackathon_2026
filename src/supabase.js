import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'http://127.0.0.1:54321'
export const supabaseAnonKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
