
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { BatchProgress as BatchProgressType } from '@/types/player';

interface BatchProgressProps {
  batchProgress: BatchProgressType | null;
  isBatchScraping: boolean;
}

export const BatchProgress: React.FC<BatchProgressProps> = ({ 
  batchProgress, 
  isBatchScraping 
}) => {
  if (!isBatchScraping && !batchProgress) {
    return null;
  }

  return (
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
  );
};
