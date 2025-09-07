import { useState, useCallback } from 'react';
import { AuctionHeader } from './components/AuctionHeader';
import { AuctionTimer } from './components/AuctionTimer';
import { BidForm } from './components/BidForm';
import { LeaderBoard } from './components/LeaderBoard';
import { WalletConnect } from './components/WalletConnect';
import { AuctionSelector } from './components/AuctionSelector';
import { CreateAuctionForm } from './components/CreateAuctionForm';
import type { AuctionParams, AuctionState, BidCommitment, WalletState } from './types/auction';
import { AuctionPhase } from './types/auction';
import { useAlgorand } from './hooks/useAlgorand';

// Mock auction data - in real app this would come from the blockchain
const MOCK_AUCTIONS: AuctionParams[] = [
  {
    appId: 13337,
    asaId: 31566704,
    seller: 'REALEST8OWNER4Q7BNZX3JKLM9PRTYUIOP2SAFGHJVBNM8XZQWERTY',
    title: "Manhattan Penthouse Tokenized Shares",
    description: "10% ownership stake in luxury penthouse at 432 Park Avenue. Fully tokenized real estate asset.",
    assetType: 'RWA',
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400",
    reserve: 250000000000, // 250k USDC
    minBid: 100000000000,  // 100k USDC  
    bond: 100000000,       // 100 ALGO
    secondPrice: true,
    commitEnd: 110, // 20s for commit (rounds 100->110)
    unlockSlack: 10, // 20s for reveal (rounds 110->120)
    payWindow: 200,
    oraclePk: new Uint8Array(32),
    pHash: new Uint8Array(32),
    created: Date.now() - 3600000,
    status: 'ACTIVE'
  },
  {
    appId: 69420,
    asaId: 31566704,
    seller: 'GOLDDEALER3XBNM4QWERTY8ZXCVB5HJKLP9ASDFG2UIOP7MNBVCXZ',
    title: "1kg Gold Bar - LBMA Certified",
    description: "London Bullion Market Association certified gold bar. Physical delivery or vault storage available.",
    assetType: 'COMMODITY',
    imageUrl: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400",
    reserve: 65000000000, // 65k USDC
    minBid: 60000000000,  // 60k USDC
    bond: 50000000,       // 50 ALGO
    secondPrice: false,   // First price auction
    commitEnd: 115, // 25s for commit (rounds 100->115) 
    unlockSlack: 10, // 15s for reveal (rounds 115->125)
    payWindow: 120,
    oraclePk: new Uint8Array(32),
    pHash: new Uint8Array(32),
    created: Date.now() - 7200000,
    status: 'ACTIVE'
  },
  {
    appId: 88888,
    asaId: 31566704,
    seller: 'ARTIST9CREATOR1ZXCVB6ASDFGH3QWERTY0MNBVCX8UIOP4LJKHGF',
    title: "Digital Art: 'Crypto Dreams'",
    description: "Original digital artwork by renowned crypto artist. 4K resolution, unique 1/1 piece.",
    assetType: 'ART',
    imageUrl: "https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?w=400",
    reserve: 2500000000,  // 2.5k USDC
    minBid: 1000000000,   // 1k USDC
    bond: 5000000,        // 5 ALGO
    secondPrice: true,
    commitEnd: 120, // 30s for commit (rounds 100->120)
    unlockSlack: 10, // 10s for reveal (rounds 120->130)
    payWindow: 100,
    oraclePk: new Uint8Array(32),
    pHash: new Uint8Array(32),
    created: Date.now() - 1800000,
    status: 'ACTIVE'
  },
  {
    appId: 12345,
    asaId: 312769, // ALGO
    seller: 'TOKENOWNER2MNBVCXZ7ASDFGH1QWERTY5UIOP9ZXCVBN4KJHGFDS',
    title: "10,000 $DEGEN Tokens",
    description: "Premium meme token allocation. Early holder benefits and governance rights included.",
    assetType: 'TOKEN',
    imageUrl: "https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=400",
    reserve: 500000000,   // 500 ALGO
    minBid: 100000000,    // 100 ALGO
    bond: 2000000,        // 2 ALGO
    secondPrice: true,
    commitEnd: 125, // 35s for commit (rounds 100->125)
    unlockSlack: 5, // 5s for reveal (rounds 125->130)
    payWindow: 80,
    oraclePk: new Uint8Array(32),
    pHash: new Uint8Array(32),
    created: Date.now() - 5400000,
    status: 'ACTIVE'
  }
];

// Mock current round removed - now using real blockchain data

function App() {
  const algorand = useAlgorand();
  const [wallet, setWallet] = useState<WalletState>({ connected: false, balance: 0 });
  const [selectedAuction, setSelectedAuction] = useState<AuctionParams>(MOCK_AUCTIONS[0]);
  const [auctionState, setAuctionState] = useState<AuctionState>({
    winBid: 7500000000,
    secondBid: 6000000000,
    winner: 'ABC123...XYZ789',
    secondWinner: 'DEF456...UVW012',
    settled: false,
    settleRound: 0
  });
  const [userCommitment, setUserCommitment] = useState<BidCommitment>({
    bid: 3000000000, // 3000 USDC for demo
    salt: new Uint8Array(32),
    anonKey: new Uint8Array(32),
    hash: new Uint8Array(32)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalBidders] = useState(12);
  const [showCreateAuction, setShowCreateAuction] = useState(false);
  const [allAuctions, setAllAuctions] = useState<AuctionParams[]>(MOCK_AUCTIONS);
  
  // Fixed auction timing - set when component mounts
  const [auctionStartTime] = useState(() => Date.now());
  
  const getCurrentPhase = useCallback((): AuctionPhase => {
    const elapsed = Date.now() - auctionStartTime;
    const commitDuration = 40 * 1000; // 40 seconds
    const revealDuration = 22 * 1000; // 22 seconds
    
    if (elapsed < commitDuration) {
      return AuctionPhase.COMMIT;
    } else if (elapsed < commitDuration + revealDuration) {
      return AuctionPhase.REVEAL;
    } else {
      return AuctionPhase.SETTLED;
    }
  }, [auctionStartTime]);

  const phase = getCurrentPhase();

  const handleWalletChange = useCallback((newWallet: WalletState) => {
    setWallet(newWallet);
  }, []);

  const handleCommitBid = async (commitment: BidCommitment): Promise<void> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    setIsSubmitting(true);
    try {
      // Get suggested transaction parameters (for future use)
      await algorand.getSuggestedParams();
      
      console.log('🔵 Creating bid commitment transaction:', {
        appId: selectedAuction.appId,
        from: wallet.address,
        commitmentHash: Array.from(commitment.hash.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
        bidAmount: commitment.bid
      });

      // In a real implementation, you would:
      // 1. Sign the transaction with the wallet
      // 2. Submit to the blockchain
      // 3. Wait for confirmation
      
      // For demo purposes, simulate the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setUserCommitment(commitment);
      console.log('✅ Bid committed successfully!', {
        txn: 'mock_txn_' + Date.now(),
        bid: commitment.bid,
        hash: Array.from(commitment.hash.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
      });
    } catch (error) {
      console.error('❌ Failed to commit bid:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevealBid = async (bid: number, salt: Uint8Array): Promise<void> => {
    if (!wallet.connected || !wallet.address) {
      throw new Error('Wallet not connected');
    }

    setIsSubmitting(true);
    try {
      // Get suggested transaction parameters (for future use)
      await algorand.getSuggestedParams();
      
      console.log('🟠 Creating bid reveal transaction:', {
        appId: selectedAuction.appId,
        from: wallet.address,
        bidAmount: bid,
        saltHash: Array.from(salt.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
      });

      // In a real implementation, you would:
      // 1. Sign the transaction with the wallet
      // 2. Submit to the blockchain
      // 3. Wait for confirmation
      
      // For demo purposes, simulate the transaction and update UI
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update auction state with revealed bid (mock)
      setAuctionState(prev => ({
        ...prev,
        winBid: Math.max(prev.winBid, bid),
        secondBid: bid > prev.winBid ? prev.winBid : Math.max(prev.secondBid, bid),
        winner: bid > prev.winBid ? wallet.address || prev.winner : prev.winner,
        secondWinner: bid > prev.winBid ? prev.winner : (bid > prev.secondBid ? wallet.address || prev.secondWinner : prev.secondWinner)
      }));
      
      console.log('✅ Bid revealed successfully!', {
        txn: 'mock_reveal_' + Date.now(),
        bid,
        newWinning: bid > (auctionState.winBid || 0)
      });
    } catch (error) {
      console.error('❌ Failed to reveal bid:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAuction = (auctionData: Omit<AuctionParams, 'appId' | 'created' | 'status' | 'oraclePk' | 'pHash'>) => {
    // Generate new app ID (in real app this would come from blockchain)
    const newAppId = Math.floor(Math.random() * 900000) + 100000;
    
    const newAuction: AuctionParams = {
      ...auctionData,
      appId: newAppId,
      created: Date.now(),
      status: 'ACTIVE',
      oraclePk: new Uint8Array(32),
      pHash: new Uint8Array(32)
    };

    setAllAuctions(prev => [newAuction, ...prev]);
    setSelectedAuction(newAuction);
    console.log('New auction created!', newAuction);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100" />
      
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/40 to-indigo-500/30 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/35 to-pink-500/25 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-br from-cyan-400/30 to-teal-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-72 h-72 bg-gradient-to-br from-emerald-400/25 to-green-500/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-violet-400/20 to-purple-600/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Wallet Connection */}
        <div className="mb-8">
          <WalletConnect onWalletChange={handleWalletChange} />
        </div>


        {/* Auction Selector */}
        <AuctionSelector
          auctions={allAuctions}
          selectedAuction={selectedAuction}
          onSelectAuction={setSelectedAuction}
          onCreateAuction={() => setShowCreateAuction(true)}
          currentRound={algorand.currentRound}
          auctionStartTime={auctionStartTime}
        />

        {/* Selected Auction Header */}
        <div className="mb-8 shimmer">
          <AuctionHeader auctionParams={selectedAuction} phase={phase === AuctionPhase.COMMIT ? 'commit' : 
                     phase === AuctionPhase.REVEAL ? 'reveal' : 'settled'} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column - Timer and Form */}
          <div className="xl:col-span-2 space-y-8">
            <AuctionTimer
              commitEndRound={selectedAuction.commitEnd}
              currentRound={algorand.currentRound}
              unlockSlack={selectedAuction.unlockSlack}
              phase={phase === AuctionPhase.COMMIT ? 'commit' : 
                     phase === AuctionPhase.REVEAL ? 'reveal' : 'settled'}
            />
            
            <BidForm
              auctionParams={selectedAuction}
              phase={phase === AuctionPhase.COMMIT ? 'commit' : 
                     phase === AuctionPhase.REVEAL ? 'reveal' : 'settled'}
              onCommitBid={handleCommitBid}
              onRevealBid={handleRevealBid}
              userCommitment={userCommitment}
              isConnected={wallet.connected}
              isSubmitting={isSubmitting}
            />
          </div>

          {/* Right Column - Leaderboard */}
          <div>
            <LeaderBoard
              winner={auctionState.winner}
              secondWinner={auctionState.secondWinner}
              winBid={auctionState.winBid}
              secondBid={auctionState.secondBid}
              totalBidders={totalBidders}
              phase={phase === AuctionPhase.COMMIT ? 'commit' : 
                     phase === AuctionPhase.REVEAL ? 'reveal' : 'settled'}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-slate-500">
          <div className="glass-card p-6 shimmer">
            <p className="text-sm font-semibold gradient-text">
              Timelock Auction Platform
            </p>
            <p className="text-xs mt-2 text-slate-600">
              Powered by Algorand Smart Contracts • Sealed-bid auctions with oracle attestation
            </p>
            <div className="mt-4 flex justify-center space-x-4 text-xs text-slate-400">
              <span>🔐 Secure</span>
              <span>⚡ Fast</span>
              <span>🎨 Beautiful</span>
              <span>🚀 Modern</span>
            </div>
          </div>
        </footer>

        {/* Create Auction Form Modal */}
        {showCreateAuction && (
          <CreateAuctionForm
            onClose={() => setShowCreateAuction(false)}
            onSubmit={handleCreateAuction}
          />
        )}
      </div>
    </div>
  );
}

export default App;
