import { useState, useEffect } from 'react';
import { Clock, Calendar, Timer } from 'lucide-react';

interface AuctionTimerProps {
  commitEndRound: number;
  currentRound: number;
  unlockSlack: number;
  phase: 'commit' | 'reveal' | 'settled' | 'expired';
  auctionStartRound?: number;
}

export function AuctionTimer({ commitEndRound: _commitEndRound, currentRound: _currentRound, unlockSlack: _unlockSlack, phase, auctionStartRound: _auctionStartRound }: AuctionTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [auctionStartTime] = useState(() => Date.now()); // Fixed start time

  useEffect(() => {
    const updateTimer = () => {
      // Use time-based auction for demo (40s commit + 22s reveal)
      const now = Date.now();
      const elapsed = now - auctionStartTime;
      const commitDuration = 40 * 1000; // 40 seconds in ms
      const revealDuration = 22 * 1000; // 22 seconds in ms
      
      let remainingMs = 0;
      let currentProgress = 0;
      
      if (phase === 'commit') {
        remainingMs = Math.max(0, commitDuration - elapsed);
        currentProgress = elapsed < commitDuration ? (elapsed / commitDuration) * 100 : 100;
      } else if (phase === 'reveal') {
        const revealElapsed = elapsed - commitDuration;
        remainingMs = Math.max(0, revealDuration - revealElapsed);
        currentProgress = revealElapsed < revealDuration ? (revealElapsed / revealDuration) * 100 : 100;
      }

      // Format remaining time
      if (remainingMs > 0) {
        const seconds = Math.ceil(remainingMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${remainingSeconds}s`);
        } else {
          setTimeRemaining(`${remainingSeconds}s`);
        }
      } else {
        setTimeRemaining('Expired');
      }

      // Set progress
      setProgress(Math.min(100, Math.max(0, currentProgress)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [phase, auctionStartTime]);

  const getPhaseColor = () => {
    switch (phase) {
      case 'commit': return 'from-blue-500 to-blue-400';
      case 'reveal': return 'from-orange-500 to-orange-400';
      case 'settled': return 'from-green-500 to-green-400';
      default: return 'from-gray-500 to-gray-400';
    }
  };

  const getPhaseIcon = () => {
    switch (phase) {
      case 'commit': return <Calendar className="w-5 h-5" />;
      case 'reveal': return <Timer className="w-5 h-5" />;
      case 'settled': return <Clock className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className="auction-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 bg-gradient-to-r ${getPhaseColor()} rounded-full flex items-center justify-center text-white`}>
            {getPhaseIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-900">
              {phase === 'commit' ? 'Commit Phase' : 
               phase === 'reveal' ? 'Reveal Phase' :
               phase === 'settled' ? 'Auction Settled' : 'Auction Expired'}
            </h3>
            <p className="text-slate-600 text-sm">
              {phase === 'commit' ? 'Hash any bid amount + post bond' :
               phase === 'reveal' ? 'Oracle reveals with VDF/RSW attestation' :
               'Winner pays 2nd highest bid (if above reserve)'}
            </p>
          </div>
        </div>
        
        {(phase === 'commit' || phase === 'reveal') && (
          <div className="text-right">
            <div className="text-2xl font-bold gradient-text">{timeRemaining}</div>
            <div className="text-sm text-slate-500">remaining</div>
          </div>
        )}
      </div>

      {(phase === 'commit' || phase === 'reveal') && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${getPhaseColor()} transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Current Round:</span>
          <span className="ml-2 font-semibold">{_currentRound}</span>
        </div>
        <div>
          <span className="text-slate-500">Demo Mode:</span>
          <span className="ml-2 font-semibold">40s Commit + 22s Reveal</span>
        </div>
      </div>
    </div>
  );
}