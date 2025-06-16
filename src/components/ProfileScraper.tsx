
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Play, Pause, Download, RotateCcw } from 'lucide-react';
import { PlayerDataCard } from './PlayerDataCard';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PlayerData {
  id: number;
  player_id: number;
  name: string;
  height: string;
  weight: string;
  graduation_year: string;
  positions: string;
  bats: string;
  throws: string;
  profile_url: string;
  showcase_report: string;
  scraped_at: string;
}

export const ProfileScraper = () => {
  const [currentId, setCurrentId] = useState(493019);
  const [playerData, setPlayerData] = useState<PlayerData[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerData | null>(null);
  const [isAutoStepping, setIsAutoStepping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load existing data from database on component mount
  useEffect(() => {
    loadExistingData();
  }, []);

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

  const scrapeCurrentProfile = async () => {
    setIsLoading(true);
    try {
      // Call the edge function to scrape the profile
      const { data, error } = await supabase.functions.invoke('scrape-player', {
        body: { playerId: currentId }
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
    } finally {
      setIsLoading(false);
    }
  };

  const stepToNext = async () => {
    const nextId = currentId + 1;
    setCurrentId(nextId);
    await scrapeCurrentProfile();
  };

  const stepToPrevious = async () => {
    const prevId = Math.max(493019, currentId - 1);
    setCurrentId(prevId);
    await scrapeCurrentProfile();
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
      interval = setInterval(() => {
        stepToNext();
      }, 5000); // Increased to 5 seconds to be respectful to the server
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
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? 'Scraping...' : 'Scrape Current'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={stepToNext}
                disabled={isLoading}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>

              <Button
                variant={isAutoStepping ? "destructive" : "default"}
                onClick={toggleAutoStep}
                disabled={isLoading}
                className="ml-2"
              >
                {isAutoStepping ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isAutoStepping ? 'Stop Auto' : 'Auto Step'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
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
