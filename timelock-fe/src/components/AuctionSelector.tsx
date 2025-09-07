import { Grid, Plus, Calendar, DollarSign, Clock, Hash } from 'lucide-react';
import type { AuctionParams, AssetType } from '../types/auction';
import { microTokensToTokens } from '../utils/algorand';

interface AuctionSelectorProps {
  auctions: AuctionParams[];
  selectedAuction: AuctionParams;
  onSelectAuction: (auction: AuctionParams) => void;
  onCreateAuction: () => void;
  currentRound: number;
  auctionStartTime: number;
}

const getAssetTypeIcon = (type: AssetType) => {
  switch (type) {
    case 'NFT': return '🎨';
    case 'RWA': return '🏠';
    case 'COMMODITY': return '🥇';
    case 'ART': return '🖼️';
    case 'TOKEN': return '🪙';
    case 'REAL_ESTATE': return '🏢';
    default: return '📦';
  }
};

const getAssetTypeColor = (type: AssetType) => {
  switch (type) {
    case 'NFT': return 'bg-purple-100 text-purple-800';
    case 'RWA': return 'bg-green-100 text-green-800';
    case 'COMMODITY': return 'bg-yellow-100 text-yellow-800';
    case 'ART': return 'bg-pink-100 text-pink-800';
    case 'TOKEN': return 'bg-blue-100 text-blue-800';
    case 'REAL_ESTATE': return 'bg-indigo-100 text-indigo-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatPrice = (amount: number, asaId: number) => {
  if (asaId === 31566704) { // USDC
    return `$${microTokensToTokens(amount, 6).toLocaleString()}`;
  } else if (asaId === 312769) { // ALGO
    return `${microTokensToTokens(amount, 6).toLocaleString()} ALGO`;
  }
  return `${microTokensToTokens(amount, 6).toLocaleString()} tokens`;
};

const getPhaseStatus = (_auction: AuctionParams, auctionStartTime: number) => {
  const elapsed = Date.now() - auctionStartTime;
  const commitDuration = 40 * 1000; // 40 seconds
  const revealDuration = 22 * 1000; // 22 seconds
  
  if (elapsed < commitDuration) {
    const remainingMs = commitDuration - elapsed;
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const timeStr = remainingSeconds > 60 ? `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s` : `${remainingSeconds}s`;
    return { text: 'Commit Phase', color: 'bg-blue-100 text-blue-800', remaining: timeStr };
  } else if (elapsed < commitDuration + revealDuration) {
    const revealElapsed = elapsed - commitDuration;
    const remainingMs = revealDuration - revealElapsed;
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const timeStr = remainingSeconds > 60 ? `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s` : `${remainingSeconds}s`;
    return { text: 'Reveal Phase', color: 'bg-orange-100 text-orange-800', remaining: timeStr };
  } else {
    return { text: 'Settlement', color: 'bg-green-100 text-green-800', remaining: 'Ended' };
  }
};

export function AuctionSelector({ auctions, selectedAuction, onSelectAuction, onCreateAuction, currentRound: _currentRound, auctionStartTime }: AuctionSelectorProps) {
  return (
    <div className="glass-card p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full flex items-center justify-center">
            <Grid className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold gradient-text">Live Auctions</h2>
            <p className="text-slate-600">Sealed-bid auctions for RWAs, NFTs, tokens, and more</p>
          </div>
        </div>
        
        <button
          onClick={onCreateAuction}
          className="primary-button flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Create Auction</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {auctions.map((auction) => {
          const isSelected = auction.appId === selectedAuction.appId;
          const phase = getPhaseStatus(auction, auctionStartTime);
          
          return (
            <div
              key={auction.appId}
              onClick={() => onSelectAuction(auction)}
              className={`
                relative cursor-pointer transition-all duration-300 rounded-xl overflow-hidden
                ${isSelected 
                  ? 'ring-4 ring-primary-400 bg-white/90 shadow-2xl scale-105' 
                  : 'bg-white/80 hover:bg-white/90 hover:shadow-xl hover:scale-102'
                }
                backdrop-filter backdrop-blur-lg border border-white/30
              `}
            >
              {/* Asset Image */}
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={auction.imageUrl} 
                  alt={auction.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getAssetTypeColor(auction.assetType)}`}>
                    {getAssetTypeIcon(auction.assetType)} {auction.assetType}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${phase.color}`}>
                    {phase.text}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-1">{auction.title}</h3>
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{auction.description}</p>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Reserve</div>
                      <div className="font-semibold text-slate-900">{formatPrice(auction.reserve, auction.asaId)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Time Left</div>
                      <div className="font-semibold text-slate-900">{phase.remaining}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Hash className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-slate-500">App ID</div>
                      <div className="font-semibold text-slate-900">#{auction.appId}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-slate-500">Type</div>
                      <div className="font-semibold text-slate-900">{auction.secondPrice ? '2nd Price' : '1st Price'}</div>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                    <div className="text-xs text-primary-700 font-semibold">✨ Currently Selected</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}