import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || ''

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// This is called by Vercel Cron every 5 minutes
export async function GET() {
  console.log('Cron: Starting Meta leads fetch...')
  
  try {
    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'META_ACCESS_TOKEN nicht konfiguriert' }, { status: 500 })
    }

    // Step 1: Get all pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${META_ACCESS_TOKEN}`
    )
    const pagesData = await pagesResponse.json()

    if (pagesData.error) {
      console.error('Meta API error:', pagesData.error)
      return NextResponse.json({ error: 'Meta API Fehler', details: pagesData.error }, { status: 400 })
    }

    const pages = pagesData.data || []
    let totalLeadsImported = 0
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

          // Get leads (last 90 days is Meta limit)
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
              continue // Skip if already imported
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

            if (categories) {
              const formNameLower = formName.toLowerCase()
              const matchedCategory = categories.find(c =>
                formNameLower.includes(c.name.toLowerCase()) ||
                c.name.toLowerCase().includes(formNameLower.split(' ')[0])
              )
              if (matchedCategory) {
                categoryId = matchedCategory.id
              } else {
                categoryId = categories[0]?.id
              }
            }

            // Insert lead
            const { error: insertError } = await supabase
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

            if (!insertError) {
              totalLeadsImported++
            }
          }
        }
      } catch (pageError: any) {
        errors.push({ page: pageName, error: pageError.message })
      }
    }

    console.log(`Cron: Imported ${totalLeadsImported} leads`)

    return NextResponse.json({
      success: true,
      imported: totalLeadsImported,
      pages_checked: pages.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
