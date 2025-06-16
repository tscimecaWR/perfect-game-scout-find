
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Play, Pause, Download, RotateCcw, Zap } from 'lucide-react';

interface ScrapingControlsProps {
  currentId: number;
  setCurrentId: (id: number) => void;
  startId: number;
  setStartId: (id: number) => void;
  endId: number;
  setEndId: (id: number) => void;
  chunkSize: number;
  setChunkSize: (size: number) => void;
  playerDataLength: number;
  isLoading: boolean;
  isBatchScraping: boolean;
  isAutoStepping: boolean;
  onScrapeCurrentProfile: () => void;
  onStepToPrevious: () => void;
  onStepToNext: () => void;
  onToggleAutoStep: () => void;
  onScrapeRange: () => void;
  onExportData: () => void;
  onResetData: () => void;
}

export const ScrapingControls: React.FC<ScrapingControlsProps> = ({
  currentId,
  setCurrentId,
  startId,
  setStartId,
  endId,
  setEndId,
  chunkSize,
  setChunkSize,
  playerDataLength,
  isLoading,
  isBatchScraping,
  isAutoStepping,
  onScrapeCurrentProfile,
  onStepToPrevious,
  onStepToNext,
  onToggleAutoStep,
  onScrapeRange,
  onExportData,
  onResetData,
}) => {
  return (
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
            {playerDataLength} profiles scraped
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onStepToPrevious}
            disabled={isLoading || currentId <= 493019}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <Button
            onClick={onScrapeCurrentProfile}
            disabled={isLoading || isBatchScraping}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Scraping...' : 'Scrape Current'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onStepToNext}
            disabled={isLoading || isBatchScraping}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant={isAutoStepping ? "destructive" : "default"}
            onClick={onToggleAutoStep}
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
              onClick={onScrapeRange}
              disabled={isLoading || isBatchScraping || startId >= endId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Zap className="w-4 h-4" />
              {isBatchScraping ? 'Batch Scraping...' : 'Scrape Range'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExportData}
              disabled={playerDataLength === 0}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onResetData}
              disabled={playerDataLength === 0}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
