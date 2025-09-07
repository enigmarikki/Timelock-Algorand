# 🚀 Algorand Localnet Setup Guide

This guide helps you connect your timelock auction frontend to Algorand localnet.

## Prerequisites

1. **Install AlgoKit** (if not already installed):
   ```bash
   # Install via pipx (recommended)
   pipx install algokit
   
   # Or via pip
   pip install algokit
   ```

2. **Install Docker** (required for localnet):
   - Download from https://docker.com
   - Make sure Docker Desktop is running

## 🔧 Start Localnet

1. **Start the localnet**:
   ```bash
   algokit localnet start
   ```

2. **Verify it's running**:
   ```bash
   algokit localnet status
   ```

   You should see:
   ```
   ✅ algod (http://localhost:4001)
   ✅ indexer (http://localhost:8980) 
   ✅ kmd (http://localhost:4002)
   ```

## 💰 Fund Test Accounts

1. **Dispense funds to test accounts**:
   ```bash
   # Get a test account funded with 1000 ALGO
   algokit localnet dispense --amount 1000 --receiver YOUR_ADDRESS_HERE
   ```

2. **Check account balance**:
   ```bash
   algokit goal account list
   ```

## 🔗 Connect Frontend

1. **Start the frontend**:
   ```bash
   npm run dev
   ```

2. **Open browser** to http://localhost:5174

3. **Connection Status**:
   - ✅ **Green**: Connected to localnet
   - 🔴 **Red**: Localnet not running or connection failed

## 🎯 Deploy Test Auctions

To deploy real timelock auction smart contracts:

1. **Compile your contracts** (if you have them):
   ```bash
   # In your smart contract directory
   algokit compile
   ```

2. **Deploy to localnet**:
   ```bash
   # Deploy auction app
   algokit deploy --network localnet
   ```

3. **Update frontend** with real app IDs in `MOCK_AUCTIONS` array

## 💡 Wallet Configuration

### For Pera Wallet:

1. **Add Custom Network**:
   - Network Name: `Algorand Localnet`
   - RPC URL: `http://localhost:4001`
   - Chain ID: `416001`

2. **Import Test Account**:
   - Use one of the pre-funded accounts from localnet
   - Get private key: `algokit goal account export -a ADDRESS`

### For Development:

The frontend automatically detects localnet and shows connection status. If you see connection errors:

1. Make sure Docker is running
2. Restart localnet: `algokit localnet restart`
3. Check firewall settings (ports 4001, 4002, 8980)

## 🛠 Troubleshooting

### "Connection Failed" Error:
```bash
# Stop and restart localnet
algokit localnet stop
algokit localnet start

# Reset localnet (clears all data)
algokit localnet reset
```

### "Port in use" Error:
```bash
# Kill processes using Algorand ports
sudo lsof -ti:4001,4002,8980 | xargs kill -9

# Or restart localnet with different ports
algokit localnet start --algod-port 4011 --kmd-port 4012 --indexer-port 8990
```

### Frontend Shows "Localnet Disconnected":
1. Verify localnet is running: `algokit localnet status`
2. Check browser console for detailed error messages
3. Try refreshing the page
4. Click the refresh button next to the connection status

## 📱 Test Flow

Once connected:

1. **Connect Wallet**: Click "Connect Wallet" button
2. **Select Account**: Choose a funded localnet account  
3. **View Auctions**: Browse the demo auctions
4. **Create Auction**: Click "Create Auction" to launch your own
5. **Place Bids**: Bid on any auction (no minimum restrictions!)

## 🔥 Advanced: Real Contract Integration

To connect to real timelock contracts:

1. Deploy your timelock contracts to localnet
2. Update `MOCK_AUCTIONS` with real app IDs
3. Replace mock auction state with `useAuctionApps(appIds)` hook
4. The frontend will automatically fetch real contract state

## 📚 Resources

- **AlgoKit Docs**: https://developer.algorand.org/algokit/
- **Algorand SDK**: https://developer.algorand.org/docs/sdks/
- **Smart Contract Examples**: https://github.com/algorand/smart-contracts

## 🆘 Need Help?

If you run into issues:
1. Check the browser console for errors
2. Verify localnet status: `algokit localnet status`
3. Review the network logs: `algokit localnet logs`

Happy bidding! 🎯