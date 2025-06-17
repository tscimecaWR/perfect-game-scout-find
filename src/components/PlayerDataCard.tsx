
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, User, Ruler, Weight, GraduationCap, FileText, Clock, Target, Hand, MapPin, Users } from 'lucide-react';

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
  city: string | null;
  state: string | null;
  team_last_played: string | null;
  profile_url: string;
  showcase_report: string;
  scraped_at: string;
}

interface PlayerDataCardProps {
  player: PlayerData;
}

export const PlayerDataCard: React.FC<PlayerDataCardProps> = ({ player }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const openProfile = () => {
    window.open(player.profile_url, '_blank');
  };

  const formatHeight = (inches: number | null) => {
    if (!inches) return null;
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  const formatLocation = () => {
    if (player.city && player.state) {
      return `${player.city}, ${player.state}`;
    } else if (player.city) {
      return player.city;
    } else if (player.state) {
      return player.state;
    }
    return null;
  };

  return (
    <Card className="p-6 bg-white shadow-lg border-l-4 border-l-blue-500">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              {player.name || 'Unknown Player'}
            </h2>
            <p className="text-sm text-gray-500">Player ID: {player.player_id}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={openProfile}
            className="flex items-center gap-1"
          >
            <ExternalLink className="w-4 h-4" />
            View Profile
          </Button>
        </div>

        {/* Player Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {player.height && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Ruler className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Height</p>
                <p className="text-lg font-semibold text-gray-900">{formatHeight(player.height)}</p>
              </div>
            </div>
          )}

          {player.weight && (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Weight className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Weight</p>
                <p className="text-lg font-semibold text-gray-900">{player.weight} lbs</p>
              </div>
            </div>
          )}

          {player.graduation_year && (
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <GraduationCap className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Graduation Year</p>
                <p className="text-lg font-semibold text-gray-900">{player.graduation_year}</p>
              </div>
            </div>
          )}

          {(player.bats || player.throws) && (
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <Hand className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Bats/Throws</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.bats || '?'}/{player.throws || '?'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Location */}
        {formatLocation() && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-gray-900">Hometown</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-200">
              <p className="text-gray-700">{formatLocation()}</p>
            </div>
          </div>
        )}

        {/* Team Last Played */}
        {player.team_last_played && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              <h3 className="font-semibold text-gray-900">Team Last Played</h3>
            </div>
            <div className="p-3 bg-teal-50 rounded-lg border-l-4 border-teal-200">
              <p className="text-gray-700">{player.team_last_played}</p>
            </div>
          </div>
        )}

        {/* Positions */}
        {player.positions && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Positions</h3>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-200">
              <p className="text-gray-700">{player.positions}</p>
            </div>
          </div>
        )}

        {/* Showcase Report */}
        {player.showcase_report && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900">Latest Showcase Report</h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-200">
              <p className="text-gray-700">{player.showcase_report}</p>
            </div>
          </div>
        )}

        {/* Profile URL */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Profile URL</p>
          <div className="p-2 bg-gray-50 rounded border font-mono text-sm text-gray-600 break-all">
            {player.profile_url}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">
            Scraped on {formatDate(player.scraped_at)}
          </span>
        </div>
      </div>
    </Card>
  );
};
