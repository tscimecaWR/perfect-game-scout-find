import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Play, Pause, Download, RotateCcw, Zap } from 'lucide-react';
import { PlayerDataCard } from './PlayerDataCard';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PlayerData {
  id: number;
  player_id: number;
  name: string;
  height: number | null;
  weight: number | null;
  graduation_year: string;
  positions: string;
  bats: string;
  throws: string;
  profile_url: string;
  showcase_report: string;
  scraped_at: string;
}

interface BatchProgress {
  currentChunk: number;
  totalChunks: number;
  overallSuccessful: number;
  overallFailed: number;
  overallProcessed: number;
  total: number;
  isComplete: boolean;
}

export const ProfileScraper = () => {
  const [currentId, setCurrentId] = useState(493019);
  const [startId, setStartId] = useState(493019);
  const [endId, setEndId] = useState(493030);
  const [chunkSize, setChunkSize] = useState(25); // Reduced default chunk size
  const [playerData, setPlayerData] = useState<PlayerData[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
  const [isAutoStepping, setIsAutoStepping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBatchScraping, setIsBatchScraping] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const { toast } = useToast();

  // Load existing data from database on component mount
  useEffect(() => {
    loadExistingData();
  }, []);

  // Subscribe to real-time progress updates
  useEffect(() => {
    const channel = supabase
      .channel('scraping-progress')
      .on('broadcast', { event: 'chunk-completed' }, (payload) => {
        console.log('Progress update received:', payload.payload);
        setBatchProgress(payload.payload);
        
        toast({
          title: "Progress Update",
          description: `Chunk ${payload.payload.chunkIndex}/${payload.payload.totalChunks} completed. ${payload.payload.successful} successful, ${payload.payload.failed} failed.`,
          duration: 2000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const loadExistingData = async () => {
    try {
      const { data, error } = await supabase
        .from('perfect_game_players')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setPlayerData(data || []);
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  };

  const scrapeProfile = async (playerId: number) => {
    setIsLoading(true);
    try {
      console.log(`Attempting to scrape player ID: ${playerId}`);
      
      // Call the edge function to scrape the profile
      const { data, error } = await supabase.functions.invoke('scrape-player', {
        body: { playerId }
      });

      if (error) throw error;

      if (data.success && data.player) {
        const player = data.player;
        setCurrentPlayer(player);
        
        // Update local state
        setPlayerData(prev => {
          const existing = prev.find(p => p.player_id === player.player_id);
          if (existing) {
            return prev.map(p => p.player_id === player.player_id ? player : p);
          }
          return [player, ...prev];
        });
        
        toast({
          title: "Profile Scraped",
          description: `Successfully scraped data for ${player.name}`,
          duration: 2000,
        });
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to scrape profile');
      }
    } catch (error) {
      console.error('Scraping error:', error);
      toast({
        title: "Scraping Failed",
        description: error.message || "Could not scrape profile data",
        variant: "destructive",
        duration: 3000,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const scrapeRange = async () => {
    if (startId >= endId) {
      toast({
        title: "Invalid Range",
        description: "Start ID must be less than End ID",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsBatchScraping(true);
    const totalPlayers = endId - startId + 1;
    const totalChunks = Math.ceil(totalPlayers / chunkSize);
    
    // Initialize progress tracking
    const progress: BatchProgress = {
      currentChunk: 0,
      totalChunks,
      overallSuccessful: 0,
      overallFailed: 0,
      overallProcessed: 0,
      total: totalPlayers,
      isComplete: false
    };
    setBatchProgress(progress);
    
    try {
      console.log(`Starting chunked batch scrape from ${startId} to ${endId} with chunk size ${chunkSize}`);
      console.log(`Total players: ${totalPlayers}, Total chunks: ${totalChunks}`);
      
      toast({
        title: "Batch Scraping Started",
        description: `Scraping ${totalPlayers} profiles in ${totalChunks} chunks of ${chunkSize}...`,
        duration: 3000,
      });

      // Process each chunk separately
      for (let chunkIndex = 1; chunkIndex <= totalChunks; chunkIndex++) {
        const chunkStartId = startId + ((chunkIndex - 1) * chunkSize);
        const chunkEndId = Math.min(chunkStartId + chunkSize - 1, endId);
        
        console.log(`Processing chunk ${chunkIndex}/${totalChunks}: IDs ${chunkStartId} to ${chunkEndId}`);
        
        // Update progress for current chunk
        setBatchProgress(prev => prev ? {
          ...prev,
          currentChunk: chunkIndex
        } : null);

        try {
          // Call the edge function for this specific chunk
          const { data, error } = await supabase.functions.invoke('scrape-player', {
            body: { 
              startId: chunkStartId, 
              endId: chunkEndId,
              chunkIndex,
              totalChunks
            }
          });

          if (error) throw error;

          if (data.success && data.results) {
            const chunkResults = data.results;
            
            // Update overall progress
            setBatchProgress(prev => prev ? {
              ...prev,
              overallSuccessful: prev.overallSuccessful + chunkResults.successful,
              overallFailed: prev.overallFailed + chunkResults.failed,
              overallProcessed: prev.overallProcessed + chunkResults.totalPlayers
            } : null);
            
            toast({
              title: `Chunk ${chunkIndex}/${totalChunks} Complete`,
              description: `${chunkResults.successful} successful, ${chunkResults.failed} failed`,
              duration: 2000,
            });
            
            console.log(`Chunk ${chunkIndex} results:`, chunkResults);
          } else {
            throw new Error(data.error || `Failed to scrape chunk ${chunkIndex}`);
          }
        } catch (chunkError) {
          console.error(`Error processing chunk ${chunkIndex}:`, chunkError);
          
          // Update failed count for this chunk
          setBatchProgress(prev => prev ? {
            ...prev,
            overallFailed: prev.overallFailed + (chunkEndId - chunkStartId + 1),
            overallProcessed: prev.overallProcessed + (chunkEndId - chunkStartId + 1)
          } : null);
          
          toast({
            title: `Chunk ${chunkIndex} Failed`,
            description: chunkError.message || "Could not process chunk",
            variant: "destructive",
            duration: 3000,
          });
        }

        // Small delay between chunks to prevent overwhelming the server
        if (chunkIndex < totalChunks) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Mark as complete
      setBatchProgress(prev => prev ? {
        ...prev,
        isComplete: true
      } : null);

      const finalProgress = batchProgress;
      toast({
        title: "Batch Scraping Complete",
        description: `Successfully scraped ${finalProgress?.overallSuccessful || 0} of ${totalPlayers} profiles`,
        duration: 5000,
      });

      // Reload data from database to get the new records
      await loadExistingData();
      
    } catch (error) {
      console.error('Batch scraping error:', error);
      toast({
        title: "Batch Scraping Failed",
        description: error.message || "Could not scrape profile range",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsBatchScraping(false);
      // Keep progress visible for a moment after completion
      setTimeout(() => setBatchProgress(null), 3000);
    }
  };

  const scrapeCurrentProfile = async () => {
    return await scrapeProfile(currentId);
  };

  const stepToNext = async () => {
    const nextId = currentId + 1;
    setCurrentId(nextId);
    return await scrapeProfile(nextId);
  };

  const stepToPrevious = async () => {
    const prevId = Math.max(493019, currentId - 1);
    setCurrentId(prevId);
    return await scrapeProfile(prevId);
  };

  const toggleAutoStep = () => {
    setIsAutoStepping(!isAutoStepping);
  };

  const exportData = () => {
    const csvContent = [
      'ID,Player ID,Name,Height,Weight,Grad Year,Positions,Bats,Throws,Profile URL,Showcase Report,Scraped At',
      ...playerData.map(player => 
        `${player.id},"${player.player_id}","${player.name}","${player.height}","${player.weight}","${player.graduation_year}","${player.positions}","${player.bats}","${player.throws}","${player.profile_url}","${player.showcase_report}","${player.scraped_at}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perfectgame_profiles_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${playerData.length} player profiles`,
      duration: 3000,
    });
  };

  const resetData = async () => {
    try {
      // Clear database
      const { error } = await supabase
        .from('perfect_game_players')
        .delete()
        .neq('id', 0); // Delete all rows

      if (error) throw error;

      setPlayerData([]);
      setCurrentPlayer(null);
      setCurrentId(493019);
      
      toast({
        title: "Data Reset",
        description: "All scraped data has been cleared from database",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        title: "Reset Failed",
        description: "Could not clear database",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoStepping && !isLoading) {
      interval = setInterval(async () => {
        const success = await stepToNext();
        // If scraping fails, stop auto-stepping
        if (!success) {
          setIsAutoStepping(false);
        }
      }, 3000); // Reduced to 3 seconds for faster auto-stepping
    }
    return () => clearInterval(interval);
  }, [isAutoStepping, isLoading, currentId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Perfect Game Profile Scraper</h1>
          <p className="text-lg text-gray-600">Extract real player data from Perfect Game profiles</p>
        </div>

        {/* Controls */}
        <Card className="p-6">
          <div className="space-y-4">
            {/* Single Player Controls */}
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Current ID:</label>
                  <Input
                    type="number"
                    value={currentId}
                    onChange={(e) => setCurrentId(parseInt(e.target.value) || 493019)}
                    className="w-24"
                    min="493019"
                  />
                </div>
                <Badge variant="outline" className="text-sm">
                  {playerData.length} profiles scraped
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stepToPrevious}
                  disabled={isLoading || currentId <= 493019}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                
                <Button
                  onClick={scrapeCurrentProfile}
                  disabled={isLoading || isBatchScraping}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? 'Scraping...' : 'Scrape Current'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={stepToNext}
                  disabled={isLoading || isBatchScraping}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  variant={isAutoStepping ? "destructive" : "default"}
                  onClick={toggleAutoStep}
                  disabled={isLoading || isBatchScraping}
                  className="ml-2"
                >
                  {isAutoStepping ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isAutoStepping ? 'Stop Auto' : 'Auto Step'}
                </Button>
              </div>
            </div>

            {/* Batch Scraping Controls */}
            <div className="border-t pt-4">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Batch Range:</label>
                    <Input
                      type="number"
                      value={startId}
                      onChange={(e) => setStartId(parseInt(e.target.value) || 493019)}
                      className="w-24"
                      min="493019"
                      placeholder="Start ID"
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <Input
                      type="number"
                      value={endId}
                      onChange={(e) => setEndId(parseInt(e.target.value) || 493030)}
                      className="w-24"
                      min="493019"
                      placeholder="End ID"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Chunk Size:</label>
                    <Input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(parseInt(e.target.value) || 25)}
                      className="w-20"
                      min="5"
                      max="50"
                    />
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {endId >= startId ? endId - startId + 1 : 0} players
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={scrapeRange}
                    disabled={isLoading || isBatchScraping || startId >= endId}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Zap className="w-4 h-4" />
                    {isBatchScraping ? 'Batch Scraping...' : 'Scrape Range'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportData}
                    disabled={playerData.length === 0}
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetData}
                    disabled={playerData.length === 0}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* Progress Bar for Batch Scraping */}
            {(isBatchScraping || batchProgress) && (
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>
                      {batchProgress 
                        ? `Chunk ${batchProgress.currentChunk}/${batchProgress.totalChunks} - ${batchProgress.overallProcessed}/${batchProgress.total} players processed`
                        : 'Starting batch scraping...'
                      }
                    </span>
                    <span>
                      {batchProgress 
                        ? `${batchProgress.overallSuccessful} successful, ${batchProgress.overallFailed} failed`
                        : ''
                      }
                    </span>
                  </div>
                  <Progress 
                    value={batchProgress ? (batchProgress.overallProcessed / batchProgress.total) * 100 : 0} 
                    className="w-full h-2"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Current Player Display */}
        {currentPlayer && (
          <PlayerDataCard player={currentPlayer} />
        )}

        {/* Scraped Data Summary */}
        {playerData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Scraped Profiles Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {playerData.slice().reverse().map((player) => (
                <div
                  key={player.id}
                  className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => setCurrentPlayer(player)}
                >
                  <div className="font-medium text-sm">{player.name}</div>
                  <div className="text-xs text-gray-600">ID: {player.player_id}</div>
                  <div className="text-xs text-gray-600">{player.height} • {player.weight}</div>
                  <div className="text-xs text-gray-600">Class of {player.graduation_year}</div>
                  {player.positions && (
                    <div className="text-xs text-gray-600">{player.positions}</div>
                  )}
                  {(player.bats || player.throws) && (
                    <div className="text-xs text-gray-600">B/T: {player.bats || '?'}/{player.throws || '?'}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
