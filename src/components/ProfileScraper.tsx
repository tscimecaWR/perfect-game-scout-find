
import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { PlayerDataCard } from './PlayerDataCard';
import { ScrapingControls } from './ScrapingControls';
import { BatchProgress } from './BatchProgress';
import { ScrapedDataSummary } from './ScrapedDataSummary';
import { useProfileScraping } from '@/hooks/useProfileScraping';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ProfileScraper = () => {
  const {
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
  } = useProfileScraping();

  const { toast } = useToast();

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
      const { error } = await supabase
        .from('perfect_game_players')
        .delete()
        .neq('id', 0);

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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoStepping && !isLoading) {
      interval = setInterval(async () => {
        const success = await stepToNext();
        if (!success) {
          setIsAutoStepping(false);
        }
      }, 3000);
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
          <ScrapingControls
            currentId={currentId}
            setCurrentId={setCurrentId}
            startId={startId}
            setStartId={setStartId}
            endId={endId}
            setEndId={setEndId}
            chunkSize={chunkSize}
            setChunkSize={setChunkSize}
            playerDataLength={playerData.length}
            isLoading={isLoading}
            isBatchScraping={isBatchScraping}
            isAutoStepping={isAutoStepping}
            onScrapeCurrentProfile={scrapeCurrentProfile}
            onStepToPrevious={stepToPrevious}
            onStepToNext={stepToNext}
            onToggleAutoStep={toggleAutoStep}
            onScrapeRange={scrapeRange}
            onExportData={exportData}
            onResetData={resetData}
          />
          
          <BatchProgress 
            batchProgress={batchProgress}
            isBatchScraping={isBatchScraping}
          />
        </Card>

        {/* Current Player Display */}
        {currentPlayer && (
          <PlayerDataCard player={currentPlayer} />
        )}

        {/* Scraped Data Summary */}
        <ScrapedDataSummary
          playerData={playerData}
          onPlayerSelect={setCurrentPlayer}
        />
      </div>
    </div>
  );
};
