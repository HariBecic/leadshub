import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || ''

export async function POST(request: NextRequest) {
  try {
    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN nicht konfiguriert' }, { status: 500 })
    }

    // Step 1: Get all pages the user has access to
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${META_ACCESS_TOKEN}`
    )
    const pagesData = await pagesResponse.json()

    if (pagesData.error) {
      return NextResponse.json({ error: 'Meta API Fehler', details: pagesData.error }, { status: 400 })
    }

    const pages = pagesData.data || []
    let totalLeadsImported = 0
    let allLeads: any[] = []
    const errors: any[] = []

    // Step 2: For each page, get lead forms and leads
    for (const page of pages) {
      const pageId = page.id
      const pageName = page.name
      const pageAccessToken = page.access_token

      try {
        // Get leadgen forms for this page
        const formsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}/leadgen_forms?access_token=${pageAccessToken}`
        )
        const formsData = await formsResponse.json()

        if (formsData.error) {
          errors.push({ page: pageName, error: formsData.error.message })
          continue
        }

        const forms = formsData.data || []

        // For each form, get leads
        for (const form of forms) {
          const formId = form.id
          const formName = form.name

          // Get leads from last 90 days (Meta limit)
          const leadsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${formId}/leads?access_token=${pageAccessToken}&limit=500`
          )
          const leadsData = await leadsResponse.json()

          if (leadsData.error) {
            errors.push({ page: pageName, form: formName, error: leadsData.error.message })
            continue
          }

          const leads = leadsData.data || []

          // Process each lead
          for (const lead of leads) {
            const leadId = lead.id
            const createdTime = lead.created_time
            const fieldData = lead.field_data || []

            // Check if lead already exists
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id')
              .eq('extra_data->>meta_leadgen_id', leadId)
              .single()

            if (existingLead) {
              // Skip if already imported
              continue
            }

            // Map fields
            const getValue = (fieldName: string) => {
              const field = fieldData.find((f: any) =>
                f.name.toLowerCase().includes(fieldName.toLowerCase())
              )
              return field?.values?.[0] || ''
            }

            const firstName = getValue('first_name') || getValue('vorname') || getValue('full_name')?.split(' ')[0] || ''
            const lastName = getValue('last_name') || getValue('nachname') || getValue('full_name')?.split(' ').slice(1).join(' ') || ''
            const email = getValue('email') || getValue('e-mail') || ''
            const phone = getValue('phone') || getValue('telefon') || getValue('phone_number') || ''
            const plz = getValue('plz') || getValue('postleitzahl') || getValue('zip') || getValue('post_code') || ''
            const ort = getValue('ort') || getValue('city') || getValue('stadt') || ''

            // All other fields go to extra_data
            const standardFields = ['first_name', 'vorname', 'last_name', 'nachname', 'full_name', 'email', 'e-mail', 'phone', 'telefon', 'phone_number', 'plz', 'postleitzahl', 'zip', 'post_code', 'ort', 'city', 'stadt']

            const extraData: Record<string, any> = {
              meta_leadgen_id: leadId,
              meta_form_id: formId,
              meta_form_name: formName,
              meta_page_id: pageId,
              meta_page_name: pageName,
              meta_created_time: createdTime
            }

            for (const field of fieldData) {
              const fieldNameLower = field.name.toLowerCase()
              if (!standardFields.some(sf => fieldNameLower.includes(sf))) {
                extraData[field.name] = field.values?.[0] || ''
              }
            }

            // Find or create category based on form name
            let categoryId = null
            const { data: categories } = await supabase
              .from('lead_categories')
              .select('id, name')

            // Try to match category by form name
            if (categories) {
              const formNameLower = formName.toLowerCase()
              const matchedCategory = categories.find(c => 
                formNameLower.includes(c.name.toLowerCase()) ||
                c.name.toLowerCase().includes(formNameLower.split(' ')[0])
              )
              if (matchedCategory) {
                categoryId = matchedCategory.id
              } else {
                // Use first category as default
                categoryId = categories[0]?.id
              }
            }

            // Insert lead
            const { data: newLead, error: insertError } = await supabase
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
                extra_data: extraData,
                created_at: createdTime
              })
              .select()
              .single()

            if (!insertError && newLead) {
              totalLeadsImported++
              allLeads.push({
                id: newLead.id,
                name: `${firstName} ${lastName}`,
                email: email,
                page: pageName,
                form: formName,
                created: createdTime
              })
            }
          }
        }
      } catch (pageError: any) {
        errors.push({ page: pageName, error: pageError.message })
      }
    }

    return NextResponse.json({
      success: true,
      imported: totalLeadsImported,
      leads: allLeads,
      pages_checked: pages.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (err: any) {
    console.error('Meta fetch error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}

// GET - Status check
export async function GET() {
  return NextResponse.json({ 
    status: 'ready',
    info: 'POST to this endpoint to fetch leads from Meta'
  })
}
