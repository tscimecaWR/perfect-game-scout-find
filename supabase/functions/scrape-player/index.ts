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
    const body = await req.json()
    const { playerId, startId, endId, chunkSize = 50 } = body
    
    // Handle single player scraping
    if (playerId && !startId && !endId) {
      return await scrapeSinglePlayer(playerId)
    }
    
    // Handle range scraping with chunking
    if (startId && endId) {
      return await scrapePlayerRangeWithChunking(startId, endId, chunkSize)
    }
    
    return new Response(
      JSON.stringify({ error: 'Either playerId or startId/endId range is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Request error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function scrapeSinglePlayer(playerId: number) {
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const profileUrl = `https://www.perfectgame.org/Players/Playerprofile.aspx?ID=${playerId}`
  
  console.log(`Scraping player profile: ${profileUrl}`)
  
  try {
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
    
    // Check if we got any meaningful data (not just empty strings)
    const hasAnyData = playerData.name || 
                      playerData.height || 
                      playerData.weight || 
                      playerData.graduation_year || 
                      playerData.positions || 
                      playerData.bats || 
                      playerData.throws || 
                      playerData.showcase_report
    
    if (!hasAnyData) {
      return new Response(
        JSON.stringify({ error: 'Player not found or profile is private' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Save to database - use player name or fallback to "Unknown Player" if empty
    const playerName = playerData.name || `Player ${playerId}`
    
    const { data, error } = await supabase
      .from('perfect_game_players')
      .upsert({
        player_id: playerId,
        name: playerName,
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
}

async function scrapePlayerRangeWithChunking(startId: number, endId: number, chunkSize: number) {
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const totalPlayers = endId - startId + 1
  const chunks = Math.ceil(totalPlayers / chunkSize)
  
  const overallResults = {
    total: totalPlayers,
    successful: 0,
    failed: 0,
    errors: [] as string[],
    chunksCompleted: 0,
    totalChunks: chunks
  }

  console.log(`Starting chunked batch scrape from ID ${startId} to ${endId}`)
  console.log(`Total players: ${totalPlayers}, Chunk size: ${chunkSize}, Total chunks: ${chunks}`)

  // Process each chunk
  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
    const chunkStartId = startId + (chunkIndex * chunkSize)
    const chunkEndId = Math.min(chunkStartId + chunkSize - 1, endId)
    
    console.log(`Processing chunk ${chunkIndex + 1}/${chunks}: IDs ${chunkStartId} to ${chunkEndId}`)
    
    // Process players in current chunk
    for (let playerId = chunkStartId; playerId <= chunkEndId; playerId++) {
      try {
        const profileUrl = `https://www.perfectgame.org/Players/Playerprofile.aspx?ID=${playerId}`
        
        // Fetch the profile page
        const response = await fetch(profileUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })

        if (!response.ok) {
          overallResults.failed++
          overallResults.errors.push(`ID ${playerId}: Failed to fetch profile (${response.status})`)
          continue
        }

        const html = await response.text()
        
        // Parse the HTML to extract player data
        const playerData = parsePlayerData(html, playerId, profileUrl)
        
        // Check if we got any meaningful data
        const hasAnyData = playerData.name || 
                          playerData.height || 
                          playerData.weight || 
                          playerData.graduation_year || 
                          playerData.positions || 
                          playerData.bats || 
                          playerData.throws || 
                          playerData.showcase_report
        
        if (!hasAnyData) {
          overallResults.failed++
          overallResults.errors.push(`ID ${playerId}: No data found or profile is private`)
          continue
        }

        // Save to database
        const playerName = playerData.name || `Player ${playerId}`
        
        const { error } = await supabase
          .from('perfect_game_players')
          .upsert({
            player_id: playerId,
            name: playerName,
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

        if (error) {
          overallResults.failed++
          overallResults.errors.push(`ID ${playerId}: Database error - ${error.message}`)
          console.error(`Database error for player ${playerId}:`, error)
        } else {
          overallResults.successful++
          console.log(`Successfully scraped player ${playerId}: ${playerName}`)
        }

        // Reduced delay to 200ms for faster processing
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        overallResults.failed++
        overallResults.errors.push(`ID ${playerId}: ${error.message}`)
        console.error(`Error scraping player ${playerId}:`, error)
      }
    }

    // Update chunk completion
    overallResults.chunksCompleted = chunkIndex + 1
    
    // Send progress update via realtime if we have more chunks to process
    if (chunkIndex < chunks - 1) {
      try {
        await supabase
          .channel('scraping-progress')
          .send({
            type: 'broadcast',
            event: 'chunk-completed',
            payload: {
              chunkIndex: chunkIndex + 1,
              totalChunks: chunks,
              successful: overallResults.successful,
              failed: overallResults.failed,
              processed: (chunkIndex + 1) * chunkSize,
              total: totalPlayers
            }
          })
      } catch (error) {
        console.error('Failed to send progress update:', error)
      }
    }

    console.log(`Completed chunk ${chunkIndex + 1}/${chunks}. Progress: ${overallResults.successful} successful, ${overallResults.failed} failed`)
    
    // Small delay between chunks
    if (chunkIndex < chunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`Chunked batch scrape completed. Total: ${overallResults.successful} successful, ${overallResults.failed} failed`)

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: `Chunked batch scrape completed`,
      results: overallResults
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

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

  // Extract showcase report with improved logic to capture full content
  let showcase_report = ''
  
  // First try to find the main showcase report span
  const reportSpanMatch = html.match(/<span[^>]*id="[^"]*ContentTopLevel_ContentPlaceHolder1_lblLatestReport[^"]*"[^>]*>(.*?)<\/span>/is)
  
  if (reportSpanMatch) {
    let reportContent = reportSpanMatch[1].trim()
    console.log(`Found showcase report span content: "${reportContent.substring(0, 100)}..."`)
    
    // Clean up HTML entities and tags
    reportContent = reportContent
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
      .trim()
    
    showcase_report = reportContent
  }
  
  // Also try to find additional content in div with class "text-start p-1"
  const divMatch = html.match(/<div[^>]*class="[^"]*text-start[^"]*p-1[^"]*"[^>]*>(.*?)<\/div>/is)
  if (divMatch) {
    let divContent = divMatch[1].trim()
    console.log(`Found div content: "${divContent.substring(0, 100)}..."`)
    
    // Clean up HTML entities and tags
    divContent = divContent
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
      .trim()
    
    // If the div content is longer and different, use it instead or append it
    if (divContent.length > showcase_report.length && divContent !== showcase_report) {
      showcase_report = divContent
      console.log(`Using longer div content for showcase report`)
    } else if (divContent && !showcase_report.includes(divContent)) {
      // Append if it's additional content
      showcase_report = showcase_report ? `${showcase_report} ${divContent}` : divContent
      console.log(`Appended div content to showcase report`)
    }
  }
  
  // Try alternative patterns for showcase report if still empty
  if (!showcase_report) {
    // Look for any div or p tag that might contain showcase report content
    const altReportMatch = html.match(/<(?:div|p)[^>]*>\s*(?:Latest\s+)?(?:Showcase\s+)?Report[:\s]*([^<]+)</i)
    if (altReportMatch) {
      showcase_report = altReportMatch[1].trim()
      console.log(`Found showcase report using alternative pattern: "${showcase_report.substring(0, 100)}..."`)
    }
  }
  
  // Limit the final showcase report to 2000 characters to handle very long reports
  if (showcase_report) {
    showcase_report = showcase_report.substring(0, 2000)
    console.log(`Final showcase report (${showcase_report.length} chars): "${showcase_report.substring(0, 100)}..."`)
  } else {
    console.log('No showcase report content found')
  }

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
