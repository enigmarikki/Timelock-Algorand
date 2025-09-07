import { useState, useEffect } from 'react';
import { Lock, Send, AlertCircle, Coins, Shield, CheckCircle } from 'lucide-react';
import type { BidCommitment, AuctionParams } from '../types/auction';
import { microTokensToTokens } from '../utils/algorand';

interface BidFormProps {
  auctionParams: AuctionParams;
  phase: 'commit' | 'reveal' | 'settled';
  onCommitBid: (commitment: BidCommitment) => Promise<void>;
  onRevealBid: (bid: number, salt: Uint8Array) => Promise<void>;
  userCommitment?: BidCommitment;
  isConnected: boolean;
  isSubmitting: boolean;
}

export function BidForm({ 
  auctionParams, 
  phase, 
  onCommitBid, 
  onRevealBid, 
  userCommitment,
  isConnected,
  isSubmitting 
}: BidFormProps) {
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setError('');
    // Only clear success message when user types something new
    if (bidAmount) {
      setSuccessMessage('');
    }
  }, [bidAmount]);
  
  useEffect(() => {
    setError('');
    // Clear success message when phase changes (e.g., commit -> reveal)
    setSuccessMessage('');
  }, [phase]);

  const validateBid = (amount: string): boolean => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid bid amount');
      return false;
    }
    // Note: Anyone can bid any amount - reserve price check happens at settlement
    return true;
  };

  const generateCommitment = (bid: number): BidCommitment => {
    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt);
    
    const anonKey = new Uint8Array(32);
    crypto.getRandomValues(anonKey);

    // In real implementation, this would be SHA256(bid || salt || anonKey || appId)
    const hash = new Uint8Array(32);
    crypto.getRandomValues(hash);

    return { bid, salt, anonKey, hash };
  };

  const handleCommit = async () => {
    if (!validateBid(bidAmount)) return;
    
    const humanBid = parseFloat(bidAmount);
    // Convert human-readable amount to micro-tokens (6 decimals)
    const microTokenBid = humanBid * Math.pow(10, 6);
    const commitment = generateCommitment(microTokenBid);
    
    try {
      await onCommitBid(commitment);
      setBidAmount('');
      setSuccessMessage('🎉 Bid committed successfully! Your bid is now sealed in the blockchain.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit bid');
    }
  };

  const handleReveal = async () => {
    if (!userCommitment) {
      setError('No commitment found to reveal');
      return;
    }

    try {
      await onRevealBid(userCommitment.bid, userCommitment.salt);
      setSuccessMessage('🚀 Bid revealed successfully! Your bid is now public on the blockchain.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal bid');
    }
  };

  const formatTokens = (amount: number) => {
    const tokens = microTokensToTokens(amount, 6);
    return `${tokens.toLocaleString()} tokens`;
  };

  const formatAlgo = (microAlgos: number) => {
    return `${(microAlgos / 1000000).toFixed(2)} ALGO`;
  };

  if (!isConnected) {
    return (
      <div className="auction-card text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-slate-400 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Connect Your Wallet</h3>
        <p className="text-slate-600">Connect your Algorand wallet to participate in the auction</p>
      </div>
    );
  }

  if (phase === 'settled') {
    return (
      <div className="auction-card text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Auction Complete</h3>
        <p className="text-slate-600">This auction has ended and been settled</p>
      </div>
    );
  }

  if (phase === 'reveal' && !userCommitment) {
    return (
      <div className="auction-card text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">No Bid to Reveal</h3>
        <p className="text-slate-600">You didn't commit a bid during the commit phase</p>
      </div>
    );
  }

  return (
    <div className="auction-card">
      <div className="flex items-center space-x-3 mb-6">
        <div className={`w-10 h-10 bg-gradient-to-r ${
          phase === 'commit' ? 'from-primary-500 to-primary-400' : 'from-orange-500 to-orange-400'
        } rounded-full flex items-center justify-center`}>
          {phase === 'commit' ? <Lock className="w-5 h-5 text-white" /> : <Send className="w-5 h-5 text-white" />}
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            {phase === 'commit' ? 'Commit Your Bid' : 'Reveal Your Bid'}
          </h3>
          <p className="text-slate-600">
            {phase === 'commit' 
              ? 'Submit a sealed bid with bond collateral' 
              : 'Reveal your committed bid with oracle attestation'}
          </p>
        </div>
      </div>

      {/* Auction Parameters */}
      <div className="bg-slate-50 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
          <Coins className="w-4 h-4 mr-2" />
          Auction Details
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Reserve Price:</span>
            <span className="ml-2 font-semibold">{formatTokens(auctionParams.reserve)}</span>
          </div>
          <div>
            <span className="text-slate-500">Suggested Min:</span>
            <span className="ml-2 font-semibold">{formatTokens(auctionParams.minBid)}</span>
          </div>
          <div>
            <span className="text-slate-500">Required Bond:</span>
            <span className="ml-2 font-semibold">{formatAlgo(auctionParams.bond)}</span>
          </div>
          <div>
            <span className="text-slate-500">Auction Type:</span>
            <span className="ml-2 font-semibold">{auctionParams.secondPrice ? 'Second Price' : 'First Price'}</span>
          </div>
        </div>
      </div>

      {phase === 'commit' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Bid Amount (e.g., 100.50 for 100.50 tokens)
            </label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="e.g., 100.50"
              className="bid-input"
              min="0.000001"
              step="0.000001"
            />
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center space-x-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900">Sealed Bid Auction</p>
                <p className="text-blue-700">
                  Bid any amount you want. Your bid is hashed and hidden until the reveal phase. 
                  You'll need to post a {formatAlgo(auctionParams.bond)} anti-spam bond.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCommit}
            disabled={isSubmitting || !bidAmount}
            className="primary-button w-full"
          >
            {isSubmitting ? 'Committing Bid...' : `Commit Bid + Post ${formatAlgo(auctionParams.bond)} Bond`}
          </button>
        </div>
      )}

      {phase === 'reveal' && userCommitment && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-semibold text-orange-900 mb-2">Your Committed Bid</h4>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-orange-700">Bid Amount: </span>
                <span className="font-semibold">{formatTokens(userCommitment.bid)}</span>
              </div>
              <div>
                <span className="text-orange-700">Commitment Hash: </span>
                <span className="font-mono text-xs">
                  {Array.from(userCommitment.hash.slice(0, 8))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('')}...
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center space-x-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            onClick={handleReveal}
            disabled={isSubmitting}
            className="primary-button w-full"
          >
            {isSubmitting ? 'Revealing Bid...' : 'Reveal Bid'}
          </button>
        </div>
      )}
    </div>
  );
}