export type AssetType = 'TOKEN' | 'NFT' | 'RWA' | 'COMMODITY' | 'ART' | 'REAL_ESTATE' | 'OTHER';

export interface AuctionParams {
  appId: number;
  asaId: number;
  seller: string;
  title: string;
  description: string;
  assetType: AssetType;
  imageUrl?: string;
  reserve: number;
  minBid: number;
  bond: number;
  secondPrice: boolean;
  commitEnd: number;
  unlockSlack: number;
  payWindow: number;
  oraclePk: Uint8Array;
  pHash: Uint8Array;
  created: number;
  status: 'ACTIVE' | 'SETTLED' | 'EXPIRED';
}

export interface AuctionState {
  winner?: string;
  secondWinner?: string;
  winBid: number;
  secondBid: number;
  settled: boolean;
  settleRound: number;
}

export interface UserState {
  commit?: Uint8Array;
  cCid?: Uint8Array;
  anonKey?: Uint8Array;
  bonded: boolean;
  revealed: boolean;
  bid: number;
  refunded: boolean;
  remainingBond: number;
}

export interface BidCommitment {
  bid: number;
  salt: Uint8Array;
  anonKey: Uint8Array;
  hash: Uint8Array;
}

export const AuctionPhase = {
  SETUP: 'setup',
  COMMIT: 'commit', 
  REVEAL: 'reveal',
  SETTLED: 'settled',
  FINALIZED: 'finalized'
} as const;

export type AuctionPhase = typeof AuctionPhase[keyof typeof AuctionPhase];

export interface WalletState {
  connected: boolean;
  address?: string;
  balance: number;
}