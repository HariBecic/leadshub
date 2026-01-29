import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let supabaseInstance: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a dummy client during build
    return createClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

export const supabase = getSupabaseClient()

export interface LeadCategory {
  id: string
  slug: string
  name: string
  default_price: number
  fields_schema: Record<string, unknown>
  active: boolean
  created_at: string
}

export interface Broker {
  id: string
  name: string
  contact_person: string | null
  email: string
  phone: string | null
  status: 'active' | 'paused' | 'inactive'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Contract {
  id: string
  broker_id: string
  category_id: string
  pricing_model: 'fixed' | 'subscription' | 'revenue_share'
  price_per_lead: number | null
  monthly_quota: number | null
  monthly_fee: number | null
  revenue_share_percent: number | null
  followup_days: number | null
  max_attempts: number | null
  distribution_rule: 'instant' | 'daily' | 'weekly'
  distribution_amount: number
  priority: number
  status: 'active' | 'paused' | 'expired'
  valid_from: string | null
  valid_until: string | null
  created_at: string
  updated_at: string
  broker?: Broker
  category?: LeadCategory
}

export interface LeadSource {
  id: string
  name: string
  webhook_token: string
  category_id: string | null
  active: boolean
  created_at: string
}

export interface Lead {
  id: string
  lead_number: number
  category_id: string | null
  source_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  plz: string | null
  ort: string | null
  extra_data: Record<string, unknown>
  ownership: 'sold' | 'managed'
  status: 'new' | 'assigned' | 'closed' | 'available'
  assignment_count: number
  created_at: string
  updated_at: string
  category?: LeadCategory
  source?: LeadSource
}

export interface LeadAssignment {
  id: string
  lead_id: string
  broker_id: string
  contract_id: string
  assigned_at: string
  email_sent_at: string | null
  followup_sent_at: string | null
  followup_response: 'contacted' | 'not_reached' | 'closed_won' | 'closed_lost' | null
  followup_responded_at: string | null
  commission_amount: number | null
  status: 'sent' | 'success' | 'returned'
  return_reason: string | null
  price_charged: number | null
  lead?: Lead
  broker?: Broker
  contract?: Contract
}

export interface Invoice {
  id: string
  broker_id: string
  invoice_number: string
  period_from: string | null
  period_until: string | null
  subtotal: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  due_date: string | null
  sent_at: string | null
  paid_at: string | null
  payment_method: string | null
  stripe_payment_id: string | null
  stripe_payment_link: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
  broker?: Broker
}

export interface Setting {
  id: string
  key: string
  value: string | null
  updated_at: string
}
