import algosdk from 'algosdk';

// Localnet configuration
export const LOCALNET_CONFIG = {
  algodToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  algodServer: 'http://localhost',
  algodPort: 4001,
  indexerToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  indexerServer: 'http://localhost',
  indexerPort: 8980,
  kmdToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  kmdServer: 'http://localhost',
  kmdPort: 4002
};

// Create Algorand clients
export const algodClient = new algosdk.Algodv2(
  LOCALNET_CONFIG.algodToken,
  LOCALNET_CONFIG.algodServer,
  LOCALNET_CONFIG.algodPort
);

export const indexerClient = new algosdk.Indexer(
  LOCALNET_CONFIG.indexerToken,
  LOCALNET_CONFIG.indexerServer,
  LOCALNET_CONFIG.indexerPort
);

export const kmdClient = new algosdk.Kmd(
  LOCALNET_CONFIG.kmdToken,
  LOCALNET_CONFIG.kmdServer,
  LOCALNET_CONFIG.kmdPort
);

// Test connection to localnet
export async function testAlgorandConnection(): Promise<boolean> {
  try {
    const health = await algodClient.healthCheck().do();
    const status = await algodClient.status().do();
    console.log('🟢 Algorand localnet connected:', { health, round: status.lastRound });
    return true;
  } catch (error) {
    console.error('🔴 Failed to connect to Algorand localnet:', error);
    return false;
  }
}

// Get current round
export async function getCurrentRound(): Promise<number> {
  try {
    const status = await algodClient.status().do();
    return Number(status.lastRound);
  } catch (error) {
    console.error('Failed to get current round:', error);
    return 0;
  }
}

// Get account information
export async function getAccountInfo(address: string) {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    return {
      address: accountInfo.address,
      balance: accountInfo.amount, // microAlgos
      round: accountInfo.round,
      assets: accountInfo.assets || [],
      apps: accountInfo.appsLocalState || []
    };
  } catch (error) {
    console.error('Failed to get account info:', error);
    throw error;
  }
}

// Get application information
export async function getApplicationInfo(appId: number) {
  try {
    const app = await algodClient.getApplicationByID(appId).do();
    return {
      id: app.id,
      creator: app.params.creator,
      approvalProgram: (app.params as any)['approval-program'],
      clearStateProgram: (app.params as any)['clear-state-program'],
      globalState: (app.params as any)['global-state'] || [],
      localState: (app.params as any)['local-state-schema'] || {},
      globalSchema: (app.params as any)['global-state-schema'] || {},
      created: (app.params as any)['created-at-round'],
      deleted: (app.params as any)['deleted'] || false
    };
  } catch (error) {
    console.error(`Failed to get application ${appId}:`, error);
    throw error;
  }
}

// Parse global state from application
export function parseGlobalState(globalState: any[]): Record<string, any> {
  const state: Record<string, any> = {};
  
  for (const item of globalState) {
    const key = Buffer.from(item.key, 'base64').toString('utf8');
    let value: any;
    
    if (item.value.type === 1) {
      // Bytes
      value = Buffer.from(item.value.bytes, 'base64');
    } else if (item.value.type === 2) {
      // Uint
      value = item.value.uint;
    } else {
      value = item.value;
    }
    
    state[key] = value;
  }
  
  return state;
}

// Format address for display
export function formatAddress(address: string, length: number = 8): string {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-4)}`;
}

// Format microAlgos to Algos
export function microAlgosToAlgos(microAlgos: number): number {
  return microAlgos / 1_000_000;
}

// Format microTokens to tokens (assuming 6 decimals for most tokens)
export function microTokensToTokens(microTokens: number, decimals: number = 6): number {
  return microTokens / Math.pow(10, decimals);
}

// Wait for transaction confirmation
export async function waitForTransactionConfirmation(txId: string, timeout: number = 30000): Promise<any> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const txInfo = await algodClient.pendingTransactionInformation(txId).do();
      if ((txInfo as any)['confirmed-round'] > 0) {
        console.log('✅ Transaction confirmed:', {
          txId,
          round: (txInfo as any)['confirmed-round'],
          fee: (txInfo as any)['txn']['txn']['fee']
        });
        return txInfo;
      }
    } catch (error) {
      // Transaction might not be in pending pool yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Transaction ${txId} not confirmed within ${timeout}ms`);
}

// Create payment transaction
export function createPaymentTxn(
  sender: string,
  receiver: string,
  amount: number,
  note?: string,
  suggestedParams?: any
) {
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver,
    amount,
    closeRemainderTo: undefined,
    note: note ? new TextEncoder().encode(note) : undefined,
    suggestedParams
  });
}

// Create asset transfer transaction
export function createAssetTransferTxn(
  sender: string,
  receiver: string,
  assetId: number,
  amount: number,
  note?: string,
  suggestedParams?: any
) {
  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender,
    receiver,
    closeRemainderTo: undefined,
    amount,
    note: note ? new TextEncoder().encode(note) : undefined,
    assetIndex: assetId,
    suggestedParams
  });
}

// Create application call transaction
export function createAppCallTxn(
  sender: string,
  appId: number,
  appArgs: Uint8Array[],
  accounts?: string[],
  foreignApps?: number[],
  foreignAssets?: number[],
  note?: string,
  suggestedParams?: any
) {
  return algosdk.makeApplicationCallTxnFromObject({
    sender,
    appIndex: appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs,
    accounts,
    foreignApps,
    foreignAssets,
    note: note ? new TextEncoder().encode(note) : undefined,
    suggestedParams
  });
}