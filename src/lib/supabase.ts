import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hetiwzglfxbqnwmpxjvb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhldGl3emdsZnhicW53bXB4anZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODY4MDksImV4cCI6MjA5NTY2MjgwOX0.iP9Kt92707onBpfrhsQQNtDX259KzDQFLymiORSEof8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
