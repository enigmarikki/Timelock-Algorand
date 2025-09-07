import { Package, Hash, User, Info } from 'lucide-react';
import type { AuctionParams, AssetType } from '../types/auction';

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

interface AuctionHeaderProps {
  auctionParams: AuctionParams;
  phase: 'commit' | 'reveal' | 'settled';
}

export function AuctionHeader({ auctionParams, phase }: AuctionHeaderProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const getPhaseDisplay = () => {
    switch (phase) {
      case 'commit': return { text: 'Commit Phase', color: 'text-blue-600 bg-blue-100' };
      case 'reveal': return { text: 'Reveal Phase', color: 'text-orange-600 bg-orange-100' };
      case 'settled': return { text: 'Settled', color: 'text-green-600 bg-green-100' };
    }
  };

  const phaseDisplay = getPhaseDisplay();

  return (
    <div className="relative overflow-hidden">
      {/* Floating background orbs */}
      <div className="floating-orb w-32 h-32 bg-gradient-to-br from-primary-400 to-primary-300 -top-16 -left-16" style={{ animationDelay: '0s' }} />
      <div className="floating-orb w-24 h-24 bg-gradient-to-br from-accent-400 to-accent-300 -top-8 -right-8" style={{ animationDelay: '2s' }} />
      <div className="floating-orb w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-300 top-20 left-1/3" style={{ animationDelay: '4s' }} />
      
      <div className="glass-card p-8 relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text mb-2">
                {auctionParams.title}
              </h1>
              <p className="text-slate-600 text-lg">
                {auctionParams.description}
              </p>
              <div className="mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                  {getAssetTypeIcon(auctionParams.assetType)} {auctionParams.assetType}
                </span>
              </div>
            </div>
          </div>
          
          <div className={`px-4 py-2 rounded-full ${phaseDisplay.color} font-semibold`}>
            {phaseDisplay.text}
          </div>
        </div>

        {/* Auction Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* App Info */}
          <div className="bg-white/50 rounded-xl p-4 border border-white/30">
            <div className="flex items-center space-x-2 mb-2">
              <Hash className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-700">Application</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-slate-900">#{auctionParams.appId}</div>
              <div className="text-xs text-slate-600 font-mono">
                ASA: {auctionParams.asaId}
              </div>
            </div>
          </div>

          {/* Seller */}
          <div className="bg-white/50 rounded-xl p-4 border border-white/30">
            <div className="flex items-center space-x-2 mb-2">
              <User className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-700">Seller</span>
            </div>
            <div className="text-sm font-mono text-slate-900">
              {formatAddress(auctionParams.seller)}
            </div>
          </div>

          {/* Reserve Price */}
          <div className="bg-white/50 rounded-xl p-4 border border-white/30">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-4 h-4 rounded-full bg-accent-500" />
              <span className="text-sm font-semibold text-slate-700">Reserve</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-slate-900">
                {auctionParams.reserve.toLocaleString()}
              </div>
              <div className="text-xs text-slate-600">tokens</div>
            </div>
          </div>

          {/* Bond Requirement */}
          <div className="bg-white/50 rounded-xl p-4 border border-white/30">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-4 h-4 rounded-full bg-primary-500" />
              <span className="text-sm font-semibold text-slate-700">Bond</span>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-slate-900">
                {(auctionParams.bond / 1000000).toFixed(2)}
              </div>
              <div className="text-xs text-slate-600">ALGO</div>
            </div>
          </div>
        </div>

        {/* Auction Type Badge */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-primary-50 px-3 py-2 rounded-lg">
              <Info className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-900">
                {auctionParams.secondPrice ? 'Second-Price' : 'First-Price'} Auction
              </span>
            </div>
            
            <div className="text-sm text-slate-600">
              Min bid: <span className="font-semibold">{auctionParams.minBid.toLocaleString()}</span> tokens
            </div>
          </div>
          
          <div className="text-sm text-slate-500">
            Rounds {auctionParams.commitEnd - 100} → {auctionParams.commitEnd + auctionParams.unlockSlack}
          </div>
        </div>
      </div>
    </div>
  );
}