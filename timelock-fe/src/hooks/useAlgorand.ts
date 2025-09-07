import { useState, useEffect, useCallback } from 'react';
import { 
  testAlgorandConnection, 
  getCurrentRound, 
  getAccountInfo, 
  getApplicationInfo,
  parseGlobalState,
  algodClient
} from '../utils/algorand';
// import type { AuctionParams } from '../types/auction'; // Removed unused import

interface AlgorandState {
  connected: boolean;
  currentRound: number;
  loading: boolean;
  error: string | null;
}

interface AuctionAppState {
  seller: string;
  asaQuote: number;
  reserve: number;
  minBid: number;
  bond: number;
  secondPrice: boolean;
  commitEnd: number;
  unlockSlack: number;
  payWindow: number;
  winner?: string;
  winBid: number;
  secondBid: number;
  secondWinner?: string;
  settled: boolean;
  settleRound: number;
}

export function useAlgorand() {
  const [state, setState] = useState<AlgorandState>({
    connected: false,
    currentRound: 0,
    loading: true,
    error: null
  });

  // Test connection on mount
  useEffect(() => {
    let mounted = true;
    
    const testConnection = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        const connected = await testAlgorandConnection();
        
        if (!mounted) return;
        
        if (connected) {
          const round = await getCurrentRound();
          setState(prev => ({
            ...prev,
            connected: true,
            currentRound: round,
            loading: false
          }));
        } else {
          setState(prev => ({
            ...prev,
            connected: false,
            loading: false,
            error: 'Failed to connect to localnet'
          }));
        }
      } catch (error) {
        if (!mounted) return;
        setState(prev => ({
          ...prev,
          connected: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        }));
      }
    };

    testConnection();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Poll for round updates
  useEffect(() => {
    if (!state.connected) return;

    const interval = setInterval(async () => {
      try {
        const round = await getCurrentRound();
        setState(prev => ({ ...prev, currentRound: round }));
      } catch (error) {
        console.error('Failed to update current round:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [state.connected]);

  // Get account balance
  const getBalance = useCallback(async (address: string) => {
    if (!state.connected) throw new Error('Not connected to Algorand');
    
    try {
      const accountInfo = await getAccountInfo(address);
      return {
        algo: accountInfo.balance,
        assets: accountInfo.assets,
        round: accountInfo.round
      };
    } catch (error) {
      console.error('Failed to get account balance:', error);
      throw error;
    }
  }, [state.connected]);

  // Get auction application state
  const getAuctionState = useCallback(async (appId: number): Promise<AuctionAppState | null> => {
    if (!state.connected) throw new Error('Not connected to Algorand');
    
    try {
      const appInfo = await getApplicationInfo(appId);
      const globalState = parseGlobalState(appInfo.globalState);
      
      return {
        seller: globalState.SELLER || '',
        asaQuote: globalState.ASA_QUOTE || 0,
        reserve: globalState.RESERVE || 0,
        minBid: globalState.MIN_BID || 0,
        bond: globalState.BOND || 0,
        secondPrice: globalState.SECOND_PRICE === 1,
        commitEnd: globalState.COMMIT_END || 0,
        unlockSlack: globalState.UNLOCK_SLACK || 0,
        payWindow: globalState.PAY_WINDOW || 0,
        winner: globalState.WINNER || undefined,
        winBid: globalState.WIN_BID || 0,
        secondBid: globalState.SECOND_BID || 0,
        secondWinner: globalState.SECOND_WINNER || undefined,
        settled: globalState.SETTLED === 1,
        settleRound: globalState.SETTLE_ROUND || 0
      };
    } catch (error) {
      console.error(`Failed to get auction state for app ${appId}:`, error);
      return null;
    }
  }, [state.connected]);

  // Get suggested transaction parameters
  const getSuggestedParams = useCallback(async () => {
    if (!state.connected) throw new Error('Not connected to Algorand');
    
    try {
      return await algodClient.getTransactionParams().do();
    } catch (error) {
      console.error('Failed to get suggested params:', error);
      throw error;
    }
  }, [state.connected]);

  // Retry connection
  const reconnect = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const connected = await testAlgorandConnection();
      
      if (connected) {
        const round = await getCurrentRound();
        setState(prev => ({
          ...prev,
          connected: true,
          currentRound: round,
          loading: false,
          error: null
        }));
      } else {
        setState(prev => ({
          ...prev,
          connected: false,
          loading: false,
          error: 'Failed to connect to localnet'
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        connected: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
    }
  }, []);

  return {
    ...state,
    getBalance,
    getAuctionState,
    getSuggestedParams,
    reconnect
  };
}

// Hook for managing auction applications
export function useAuctionApps(appIds: number[]) {
  const { connected, getAuctionState } = useAlgorand();
  const [auctions, setAuctions] = useState<Record<number, AuctionAppState>>({});
  const [loading, setLoading] = useState(false);

  const refreshAuctions = useCallback(async () => {
    if (!connected || appIds.length === 0) return;

    setLoading(true);
    const newAuctions: Record<number, AuctionAppState> = {};

    try {
      const promises = appIds.map(async (appId) => {
        const state = await getAuctionState(appId);
        if (state) {
          newAuctions[appId] = state;
        }
      });

      await Promise.allSettled(promises);
      setAuctions(newAuctions);
    } catch (error) {
      console.error('Failed to refresh auctions:', error);
    } finally {
      setLoading(false);
    }
  }, [connected, appIds, getAuctionState]);

  useEffect(() => {
    refreshAuctions();
  }, [refreshAuctions]);

  return {
    auctions,
    loading,
    refresh: refreshAuctions
  };
}