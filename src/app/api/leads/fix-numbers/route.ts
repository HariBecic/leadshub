import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: Fix all lead numbers sequentially
export async function GET(request: NextRequest) {
  try {
    // Get all leads ordered by created_at
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, created_at, lead_number')
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update each lead with sequential number
    let updated = 0
    for (let i = 0; i < leads.length; i++) {
      const newNumber = i + 1
      if (leads[i].lead_number !== newNumber) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ lead_number: newNumber })
          .eq('id', leads[i].id)
        
        if (!updateError) updated++
      }
    }

    return NextResponse.json({ 
      success: true, 
      total: leads.length,
      updated,
      message: `${updated} Lead-Nummern korrigiert`
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
