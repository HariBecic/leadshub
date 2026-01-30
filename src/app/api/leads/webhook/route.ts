import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Webhook Verify Token (set in Meta App)
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'leadshub_webhook_2026'

// GET - Meta Webhook Verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST - Receive Lead Data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Webhook received:', JSON.stringify(body, null, 2))

    // Meta sends data in this format
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id
            const formId = change.value.form_id
            const pageId = change.value.page_id
            
            // Fetch lead details from Meta API
            const leadData = await fetchMetaLeadData(leadgenId)
            
            if (leadData) {
              await saveLeadToDatabase(leadData, formId, pageId)
            }
          }
        }
      }
    }
    
    // Direct lead submission (from Zapier, Make, or custom integration)
    if (body.lead || body.first_name || body.email) {
      await saveDirectLead(body)
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Fetch lead data from Meta Graph API
async function fetchMetaLeadData(leadgenId: string) {
  const accessToken = process.env.META_ACCESS_TOKEN
  
  if (!accessToken) {
    console.error('META_ACCESS_TOKEN not set')
    return null
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`
    )
    const data = await response.json()
    
    if (data.error) {
      console.error('Meta API error:', data.error)
      return null
    }
    
    return data
  } catch (err) {
    console.error('Error fetching lead from Meta:', err)
    return null
  }
}

// Save Meta lead to database
async function saveLeadToDatabase(metaLead: any, formId: string, pageId: string) {
  const fieldData = metaLead.field_data || []
  
  // Map Meta fields to our schema
  const getValue = (fieldName: string) => {
    const field = fieldData.find((f: any) => 
      f.name.toLowerCase().includes(fieldName.toLowerCase())
    )
    return field?.values?.[0] || ''
  }

  // Standard fields
  const firstName = getValue('first_name') || getValue('vorname') || ''
  const lastName = getValue('last_name') || getValue('nachname') || getValue('name') || ''
  const email = getValue('email') || getValue('e-mail') || ''
  const phone = getValue('phone') || getValue('telefon') || getValue('phone_number') || ''
  const plz = getValue('plz') || getValue('postleitzahl') || getValue('zip') || ''
  const ort = getValue('ort') || getValue('city') || getValue('stadt') || ''

  // All other fields go to extra_data
  const standardFields = ['first_name', 'vorname', 'last_name', 'nachname', 'name', 'email', 'e-mail', 'phone', 'telefon', 'phone_number', 'plz', 'postleitzahl', 'zip', 'ort', 'city', 'stadt']
  
  const extraData: Record<string, any> = {
    meta_leadgen_id: metaLead.id,
    meta_form_id: formId,
    meta_page_id: pageId,
    meta_created_time: metaLead.created_time
  }
  
  for (const field of fieldData) {
    const fieldNameLower = field.name.toLowerCase()
    if (!standardFields.some(sf => fieldNameLower.includes(sf))) {
      extraData[field.name] = field.values?.[0] || ''
    }
  }

  // Determine category based on form or set default
  let categoryId = null
  const { data: defaultCategory } = await supabase
    .from('lead_categories')
    .select('id')
    .limit(1)
    .single()
  
  if (defaultCategory) {
    categoryId = defaultCategory.id
  }

  // Insert lead
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      plz: plz,
      ort: ort,
      status: 'new',
      source: 'meta_ads',
      category_id: categoryId,
      extra_data: extraData
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving lead:', error)
  } else {
    console.log('Lead saved:', lead.id)
  }

  return lead
}

// Save direct lead (from Zapier, Make, or API call)
async function saveDirectLead(body: any) {
  // Support nested "lead" object or flat structure
  const data = body.lead || body

  const firstName = data.first_name || data.vorname || data.firstName || ''
  const lastName = data.last_name || data.nachname || data.lastName || data.name || ''
  const email = data.email || data.e_mail || ''
  const phone = data.phone || data.telefon || data.phone_number || ''
  const plz = data.plz || data.postleitzahl || data.zip || ''
  const ort = data.ort || data.city || data.stadt || ''
  const source = data.source || 'api'
  const categorySlug = data.category || data.kategorie || null

  // Find category
  let categoryId = null
  if (categorySlug) {
    const { data: cat } = await supabase
      .from('lead_categories')
      .select('id')
      .or(`slug.eq.${categorySlug},name.ilike.%${categorySlug}%`)
      .limit(1)
      .single()
    
    if (cat) categoryId = cat.id
  }

  // If no category found, use default
  if (!categoryId) {
    const { data: defaultCat } = await supabase
      .from('lead_categories')
      .select('id')
      .limit(1)
      .single()
    
    if (defaultCat) categoryId = defaultCat.id
  }

  // Collect extra fields
  const standardFields = ['first_name', 'vorname', 'firstName', 'last_name', 'nachname', 'lastName', 'name', 'email', 'e_mail', 'phone', 'telefon', 'phone_number', 'plz', 'postleitzahl', 'zip', 'ort', 'city', 'stadt', 'source', 'category', 'kategorie', 'lead']
  
  const extraData: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!standardFields.includes(key) && value) {
      extraData[key] = value
    }
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone: phone,
      plz: plz,
      ort: ort,
      status: 'new',
      source: source,
      category_id: categoryId,
      extra_data: Object.keys(extraData).length > 0 ? extraData : null
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving direct lead:', error)
    throw error
  }

  console.log('Direct lead saved:', lead.id)
  return lead
}
