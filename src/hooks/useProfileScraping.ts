
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PlayerData, BatchProgress } from '@/types/player';

export const useProfileScraping = () => {
  const [currentId, setCurrentId] = useState(493019);
  const [startId, setStartId] = useState(493019);
  const [endId, setEndId] = useState(493030);
  const [chunkSize, setChunkSize] = useState(25);
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
      
      const { data, error } = await supabase.functions.invoke('scrape-player', {
        body: { playerId }
      });

      if (error) throw error;

      if (data.success && data.player) {
        const player = data.player;
        setCurrentPlayer(player);
        
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

      for (let chunkIndex = 1; chunkIndex <= totalChunks; chunkIndex++) {
        const chunkStartId = startId + ((chunkIndex - 1) * chunkSize);
        const chunkEndId = Math.min(chunkStartId + chunkSize - 1, endId);
        
        console.log(`Processing chunk ${chunkIndex}/${totalChunks}: IDs ${chunkStartId} to ${chunkEndId}`);
        
        setBatchProgress(prev => prev ? {
          ...prev,
          currentChunk: chunkIndex
        } : null);

        try {
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

        if (chunkIndex < totalChunks) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

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
      setTimeout(() => setBatchProgress(null), 3000);
    }
  };

  return {
    currentId,
    setCurrentId,
    startId,
    setStartId,
    endId,
    setEndId,
    chunkSize,
    setChunkSize,
    playerData,
    setPlayerData,
    currentPlayer,
    setCurrentPlayer,
    isAutoStepping,
    setIsAutoStepping,
    isLoading,
    isBatchScraping,
    batchProgress,
    scrapeProfile,
    scrapeRange,
    loadExistingData,
  };
};
