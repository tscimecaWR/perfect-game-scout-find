
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { playerId } = await req.json()
    
    if (!playerId) {
      return new Response(
        JSON.stringify({ error: 'Player ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const profileUrl = `https://www.perfectgame.org/Players/Playerprofile.aspx?ID=${playerId}`
    
    console.log(`Scraping player profile: ${profileUrl}`)
    
    // Fetch the profile page
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`)
    }

    const html = await response.text()
    
    // Parse the HTML to extract player data
    const playerData = parsePlayerData(html, playerId, profileUrl)
    
    if (!playerData.name) {
      return new Response(
        JSON.stringify({ error: 'Player not found or profile is private' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Save to database
    const { data, error } = await supabase
      .from('perfect_game_players')
      .upsert({
        player_id: playerId,
        name: playerData.name,
        height: playerData.height,
        weight: playerData.weight,
        graduation_year: playerData.graduation_year,
        positions: playerData.positions,
        handedness: playerData.handedness,
        profile_url: profileUrl,
        showcase_report: playerData.showcase_report,
        scraped_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to save player data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, player: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Scraping error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function parsePlayerData(html: string, playerId: number, profileUrl: string) {
  // Extract player name
  const nameMatch = html.match(/<span[^>]*id="[^"]*lblPlayerName[^"]*"[^>]*>([^<]+)<\/span>/i)
  const name = nameMatch ? nameMatch[1].trim() : ''

  // Extract height
  const heightMatch = html.match(/Height[:\s]*([0-9]+'[0-9]+")/i)
  const height = heightMatch ? heightMatch[1].trim() : ''

  // Extract weight
  const weightMatch = html.match(/Weight[:\s]*([0-9]+\s*lbs?)/i)
  const weight = weightMatch ? weightMatch[1].trim() : ''

  // Extract graduation year
  const gradYearMatch = html.match(/Class of[:\s]*([0-9]{4})/i) || html.match(/Grad[:\s]*([0-9]{4})/i)
  const graduation_year = gradYearMatch ? gradYearMatch[1].trim() : ''

  // Extract positions
  const positionMatch = html.match(/Position[s]?[:\s]*([^<\n]+)/i)
  const positions = positionMatch ? positionMatch[1].trim() : ''

  // Extract handedness (Bats/Throws)
  const handsMatch = html.match(/B\/T[:\s]*([^<\n]+)/i) || html.match(/Bats\/Throws[:\s]*([^<\n]+)/i)
  const handedness = handsMatch ? handsMatch[1].trim() : ''

  // Extract showcase report (look for recent report)
  const reportMatch = html.match(/<div[^>]*class="[^"]*report[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                     html.match(/Report[:\s]*([^<\n]{20,})/i)
  const showcase_report = reportMatch ? reportMatch[1].trim().substring(0, 500) : ''

  return {
    name,
    height,
    weight,
    graduation_year,
    positions,
    handedness,
    showcase_report
  }
}
