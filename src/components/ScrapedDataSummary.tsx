
import React from 'react';
import { Card } from '@/components/ui/card';
import { PlayerData } from '@/types/player';

interface ScrapedDataSummaryProps {
  playerData: PlayerData[];
  onPlayerSelect: (player: PlayerData) => void;
}

export const ScrapedDataSummary: React.FC<ScrapedDataSummaryProps> = ({
  playerData,
  onPlayerSelect,
}) => {
  if (playerData.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-4">Scraped Profiles Summary</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
        {playerData.slice().reverse().map((player) => (
          <div
            key={player.id}
            className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => onPlayerSelect(player)}
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
  );
};
