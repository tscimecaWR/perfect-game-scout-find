
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
        bats: playerData.bats,
        throws: playerData.throws,
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

  // Extract height from specific element ID and convert to inches
  const heightMatch = html.match(/<span[^>]*id="[^"]*ContentTopLevel_ContentPlaceHolder1_lblHt[^"]*"[^>]*>([^<]+)<\/span>/i)
  let height = null
  if (heightMatch) {
    const heightText = heightMatch[1].trim()
    console.log(`Found height text: "${heightText}"`)
    
    // Parse different height formats
    // Handle format like "5-3" (feet-inches with hyphen)
    const hyphenMatch = heightText.match(/(\d+)-(\d+)/)
    if (hyphenMatch) {
      const feet = parseInt(hyphenMatch[1])
      const inches = parseInt(hyphenMatch[2])
      height = (feet * 12) + inches
      console.log(`Parsed height from hyphen format: ${feet}-${inches} = ${height} inches`)
    } else {
      // Handle format like "6' 2\"" or "6'2\"" (feet and inches with quotes)
      const feetInchesMatch = heightText.match(/(\d+)'?\s*(\d+)"?/)
      if (feetInchesMatch) {
        const feet = parseInt(feetInchesMatch[1])
        const inches = parseInt(feetInchesMatch[2])
        height = (feet * 12) + inches
        console.log(`Parsed height from quote format: ${feet}' ${inches}" = ${height} inches`)
      } else {
        console.log(`Could not parse height from: "${heightText}"`)
      }
    }
  } else {
    console.log('Height element not found in HTML')
  }

  // Extract weight from specific element ID and convert to integer
  const weightMatch = html.match(/<span[^>]*id="[^"]*ContentTopLevel_ContentPlaceHolder1_lblWt[^"]*"[^>]*>([^<]+)<\/span>/i)
  let weight = null
  if (weightMatch) {
    const weightText = weightMatch[1].trim()
    console.log(`Found weight text: "${weightText}"`)
    // Extract just the number from weight (e.g., "185 lbs" -> 185)
    const weightNumberMatch = weightText.match(/(\d+)/)
    if (weightNumberMatch) {
      weight = parseInt(weightNumberMatch[1])
      console.log(`Parsed weight: ${weight} lbs`)
    } else {
      console.log(`Could not parse weight from: "${weightText}"`)
    }
  } else {
    console.log('Weight element not found in HTML')
  }

  // Extract graduation year
  const gradYearMatch = html.match(/Class of[:\s]*([0-9]{4})/i) || html.match(/Grad[:\s]*([0-9]{4})/i)
  const graduation_year = gradYearMatch ? gradYearMatch[1].trim() : ''

  // Extract positions using the specific element ID
  const positionMatch = html.match(/<span[^>]*id="[^"]*ContentTopLevel_ContentPlaceHolder1_lblPos[^"]*"[^>]*>([^<]+)<\/span>/i)
  const positions = positionMatch ? positionMatch[1].trim() : ''

  // Extract bats and throws from the specific element ID
  const batsThrowsMatch = html.match(/<span[^>]*id="[^"]*ContentTopLevel_ContentPlaceHolder1_lblBT[^"]*"[^>]*>([^<]+)<\/span>/i)
  let bats = ''
  let throws = ''
  
  if (batsThrowsMatch) {
    const batsThrowsText = batsThrowsMatch[1].trim()
    const slashIndex = batsThrowsText.indexOf('/')
    if (slashIndex !== -1) {
      bats = batsThrowsText.substring(0, slashIndex).trim()
      throws = batsThrowsText.substring(slashIndex + 1).trim()
    }
  }

  // Extract showcase report (look for recent report)
  const reportMatch = html.match(/<div[^>]*class="[^"]*report[^"]*"[^>]*>([^<]+)<\/div>/i) ||
                     html.match(/Report[:\s]*([^<\n]{20,})/i)
  const showcase_report = reportMatch ? reportMatch[1].trim().substring(0, 500) : ''

  console.log(`Final parsed data for player ${playerId}:`, {
    name,
    height,
    weight,
    graduation_year,
    positions,
    bats,
    throws
  })

  return {
    name,
    height,
    weight,
    graduation_year,
    positions,
    bats,
    throws,
    showcase_report
  }
}
