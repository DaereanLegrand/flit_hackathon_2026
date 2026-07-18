import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://flit-api.qallariy.lat'
export const supabaseAnonKey = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
