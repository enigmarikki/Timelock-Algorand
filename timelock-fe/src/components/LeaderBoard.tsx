import { Trophy, Medal, Award, Users, TrendingUp } from 'lucide-react';
import { microTokensToTokens } from '../utils/algorand';

interface LeaderBoardProps {
  winner?: string;
  secondWinner?: string;
  winBid: number;
  secondBid: number;
  totalBidders: number;
  phase: 'commit' | 'reveal' | 'settled';
}

export function LeaderBoard({ 
  winner, 
  secondWinner, 
  winBid, 
  secondBid, 
  totalBidders, 
  phase 
}: LeaderBoardProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTokens = (amount: number) => {
    if (amount <= 0) return 'No bids yet';
    const tokens = microTokensToTokens(amount, 6);
    return `${tokens.toLocaleString()} tokens`;
  };


  return (
    <div className="auction-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Leaderboard</h3>
            <p className="text-slate-600">
              {phase === 'commit' ? 'Sealed bids hidden until reveal' : 
               phase === 'reveal' ? 'Live bid reveals with oracle attestation' : 
               'Final results - winner pays 2nd price'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 bg-purple-50 px-3 py-2 rounded-lg">
          <Users className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-purple-900">{totalBidders}</span>
          <span className="text-purple-700 text-sm">bidders</span>
        </div>
      </div>

      <div className="space-y-4">
        {phase === 'commit' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-slate-300 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-600">All bids are hashed and hidden</p>
            <p className="text-sm text-slate-500 mt-2">Bid any amount - oracle reveals happen in phase 2</p>
          </div>
        )}

        {(phase === 'reveal' || phase === 'settled') && (
          <>
            {/* Winner */}
            {winner && winBid > 0 ? (
              <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-yellow-900">Leading Bidder</div>
                      <div className="text-sm text-yellow-700 font-mono">{formatAddress(winner)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-yellow-900">{formatTokens(winBid)}</div>
                    <div className="text-sm text-yellow-700">highest bid</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <div className="text-slate-500">No bids revealed yet</div>
              </div>
            )}

            {/* Second Place */}
            {secondWinner && secondBid > 0 && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-400 rounded-full flex items-center justify-center">
                      <Medal className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Second Place</div>
                      <div className="text-sm text-gray-700 font-mono">{formatAddress(secondWinner)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">{formatTokens(secondBid)}</div>
                    <div className="text-sm text-gray-700">second highest</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Auction Info */}
        {phase === 'settled' && winner && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Award className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Auction Results</span>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-green-700">Winner:</span>
                <span className="font-mono font-semibold text-green-900">{formatAddress(winner)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Winning Bid:</span>
                <span className="font-semibold text-green-900">{formatTokens(winBid)}</span>
              </div>
              {secondBid > 0 && (
                <div className="flex justify-between">
                  <span className="text-green-700">Final Price:</span>
                  <span className="font-semibold text-green-900">{formatTokens(Math.max(secondBid, winBid))}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phase-specific messaging */}
      {phase === 'reveal' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Oracle Reveal Phase:</strong> Anyone can reveal bids using VDF/RSW oracle attestation. 
            Revealers earn 70% of the bond, bidders keep 30%.
          </p>
        </div>
      )}
    </div>
  );
}