import { useState, useEffect } from 'react';
import { Wallet, LogOut, RefreshCw, AlertCircle } from 'lucide-react';
import { PeraWalletConnect } from '@perawallet/connect';
import type { WalletState } from '../types/auction';
import { useAlgorand } from '../hooks/useAlgorand';
import { formatAddress, microAlgosToAlgos } from '../utils/algorand';

interface WalletConnectProps {
  onWalletChange: (wallet: WalletState) => void;
}

const peraWallet = new PeraWalletConnect({
  chainId: 416001, // Localnet
});

// Dummy wallet for testing
const DUMMY_WALLET = {
  address: 'DUMMYWALLET3TESTINGXYZ4ALGORAND7LOCALNET9DEMO2ACCOUNT',
  balance: 50000000000 // 50,000 ALGO
};

export function WalletConnect({ onWalletChange }: WalletConnectProps) {
  const algorand = useAlgorand();
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    balance: 0
  });
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Auto-connect dummy wallet when localnet is available
    const checkSession = async () => {
      try {
        if (algorand.connected) {
          // Auto-connect dummy wallet for testing
          const dummyWallet = {
            connected: true,
            address: DUMMY_WALLET.address,
            balance: DUMMY_WALLET.balance
          };
          setWallet(dummyWallet);
          console.log('🎭 Dummy wallet auto-connected:', DUMMY_WALLET.address.slice(0, 8) + '...');
          return;
        }

        // Fallback to real wallet connection
        const accounts = peraWallet.connector?.accounts || [];
        if (accounts.length > 0 && algorand.connected) {
          const address = accounts[0];
          const accountInfo = await algorand.getBalance(address);
          setWallet({
            connected: true,
            address,
            balance: Number(accountInfo.algo)
          });
        }
      } catch (error) {
        console.error('Session check failed:', error);
      }
    };

    checkSession();

    // Listen for account changes
    peraWallet.connector?.on('disconnect', () => {
      const newWallet = { connected: false, balance: 0 };
      setWallet(newWallet);
      onWalletChange(newWallet);
    });
  }, [onWalletChange, algorand.connected, algorand.getBalance]);

  useEffect(() => {
    onWalletChange(wallet);
  }, [wallet, onWalletChange]);

  const connectWallet = async () => {
    if (!algorand.connected) {
      alert('Please start Algorand localnet first!\n\nRun: algokit localnet start');
      return;
    }

    try {
      setConnecting(true);
      
      // Use dummy wallet for easy testing
      const newWallet: WalletState = {
        connected: true,
        address: DUMMY_WALLET.address,
        balance: DUMMY_WALLET.balance
      };
      setWallet(newWallet);
      console.log('🎭 Dummy wallet connected for testing!');
      
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('Wallet connection failed. Make sure your wallet is configured for localnet.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      await peraWallet.disconnect();
      const newWallet = { connected: false, balance: 0 };
      setWallet(newWallet);
    } catch (error) {
      console.error('Wallet disconnect failed:', error);
    }
  };

  // Show localnet status
  if (!algorand.connected) {
    return (
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-400 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Localnet Disconnected</div>
            <div className="text-sm text-slate-600">
              {algorand.loading ? 'Connecting...' : (algorand.error || 'Start localnet to continue')}
            </div>
          </div>
        </div>
        <button
          onClick={algorand.reconnect}
          disabled={algorand.loading}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          title="Retry connection"
        >
          <RefreshCw className={`w-5 h-5 ${algorand.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  if (wallet.connected) {
    return (
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-accent-500 to-accent-400 rounded-full flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{formatAddress(wallet.address!)}</div>
            <div className="text-sm text-slate-600">{microAlgosToAlgos(wallet.balance).toFixed(2)} ALGO</div>
            <div className="text-xs text-green-600">Localnet Round {algorand.currentRound}</div>
          </div>
        </div>
        <button
          onClick={disconnectWallet}
          className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
          title="Disconnect wallet"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      disabled={connecting || !algorand.connected}
      className="primary-button flex items-center space-x-2"
    >
      <Wallet className="w-5 h-5" />
      <span>{connecting ? 'Connecting...' : 'Connect Wallet'}</span>
    </button>
  );
}