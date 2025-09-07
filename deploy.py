"""
Timelock Auction Contract Deployment Script

This script deploys and initializes a timelock auction smart contract to Algorand localnet.
It handles the complete deployment flow including:

1. Network connection validation
2. Account funding verification  
3. Test ASA (token) creation for the auction
4. Smart contract compilation and deployment
5. Contract funding and initialization with parameters
6. State verification and deployment summary

Prerequisites:
- Algorand localnet running (sandbox)
- Funded account mnemonic configured below
- Python environment with algosdk and pyteal

Usage:
    python deploy.py

The script will create:
- deployment.json: Contains all deployment details and transaction IDs
- approval.teal: Human-readable approval program TEAL code
- clear.teal: Human-readable clear state program TEAL code

Configuration:
- Update FUNDED_ACCOUNT_MNEMONIC with your funded account mnemonic
- Modify auction parameters in the initialization section as needed
"""

import base64
import hashlib
import json
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.transaction import (
    ApplicationCreateTxn,
    StateSchema,
    OnComplete,
    wait_for_confirmation,
    PaymentTxn,
    AssetCreateTxn,
)
from algosdk import logic
from timelock_contracts import get_compiled_programs

# Localnet configuration
ALGOD_ADDRESS = "http://localhost:4001"
ALGOD_TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

# Your mnemonic
# TODO: set as env var lol
FUNDED_ACCOUNT_MNEMONIC = "slice horse chest ocean elevator guitar model law dog aim chuckle twelve crew phone awesome one margin nest inch frozen debate spoil sunny about net"

def main():
    print("=" * 60)
    print("TIMELOCK CONTRACT DEPLOYMENT TO LOCALNET")
    print("=" * 60)
    
    # 1. Connect to node
    print("\n1. Connecting to Algorand node...")
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)
    
    try:
        status = client.status()
        print(f"   Connected to network")
        print(f"   Current round: {status['last-round']}")
    except Exception as e:
        print(f"   Failed to connect: {e}")
        print("\n   Make sure your localnet is running:")
        print("   cd sandbox && ./sandbox up dev")
        return
    
    # 2. Setup account from mnemonic
    print("\n2. Setting up creator account...")
    
    try:
        private_key = mnemonic.to_private_key(FUNDED_ACCOUNT_MNEMONIC)
        address = account.address_from_private_key(private_key)
        print(f"   Using account: {address}")
    except Exception as e:
        print(f"   Invalid mnemonic: {e}")
        return
    
    # Check balance
    account_info = client.account_info(address)
    balance = account_info.get('amount', 0)
    print(f"   Current balance: {balance:,} microAlgos ({balance/1_000_000:.2f} ALGO)")
    
    if balance < 10_000_000:  # Less than 10 ALGO
        print(f"\n   WARNING: Account needs funding!")
        print(f"   Your account address: {address}")
        print(f"\n   To fund this account, run this in your sandbox directory:")
        print(f"   ./sandbox goal account list  # Find a funded account")
        print(f"   ./sandbox goal clerk send -a 100000000 -f <FUNDED_ACCOUNT> -t {address}")
        print(f"\n   Then run this script again.")
        return
    
    print(f"   Account is funded and ready!")
    
    # 3. Create test ASA
    print("\n3. Creating test ASA (token)...")
    params = client.suggested_params()
    
    asa_txn = AssetCreateTxn(
        sender=address,
        sp=params,
        total=1_000_000_000,  # 1 billion units
        default_frozen=False,
        unit_name="TEST",
        asset_name="Test Token",
        manager=address,
        reserve=address,
        freeze=address,
        clawback=address,
        decimals=6
    )
    
    signed_asa_txn = asa_txn.sign(private_key)
    asa_tx_id = client.send_transaction(signed_asa_txn)
    asa_result = wait_for_confirmation(client, asa_tx_id, 4)
    asa_id = asa_result["asset-index"]
    print(f"   Created ASA ID: {asa_id}")
    print(f"   TX ID: {asa_tx_id}")
    
    # 4. Compile contract
    print("\n4. Compiling smart contract...")
    
    try:
        # Get compiled programs (these are TEAL strings)
        approval_program, clear_program, contract, router = get_compiled_programs(version=8)
        
        # Save TEAL for inspection
        with open("approval.teal", "w") as f:
            f.write(approval_program)
        with open("clear.teal", "w") as f:
            f.write(clear_program)
        
        # Compile TEAL to bytecode using algod
        approval_compiled = base64.b64decode(client.compile(approval_program)['result'])
        clear_compiled = base64.b64decode(client.compile(clear_program)['result'])
        
        print(f"   Approval program size: {len(approval_compiled)} bytes")
        print(f"   Clear program size: {len(clear_compiled)} bytes")
        print(f"   TEAL files saved for inspection")
        
    except Exception as e:
        print(f"   Compilation failed: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 5. Deploy contract (without initialization)
    print("\n5. Deploying contract...")
    
    # Define state schemas
    global_schema = StateSchema(
        num_uints=12,  # Increased to accommodate all integer values
        num_byte_slices=10
    )
    
    local_schema = StateSchema(
        num_uints=5,
        num_byte_slices=3
    )
    
    # Create application transaction - NO APP ARGS during creation
    app_txn = ApplicationCreateTxn(
        sender=address,
        sp=params,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval_compiled,
        clear_program=clear_compiled,
        global_schema=global_schema,
        local_schema=local_schema,
        extra_pages=1  # Extra pages for larger program
    )
    
    signed_app_txn = app_txn.sign(private_key)
    app_tx_id = client.send_transaction(signed_app_txn)
    app_result = wait_for_confirmation(client, app_tx_id, 4)
    app_id = app_result["application-index"]
    app_address = logic.get_application_address(app_id)
    
    print(f"   Contract deployed!")
    print(f"   Application ID: {app_id}")
    print(f"   App Address: {app_address}")
    print(f"   TX ID: {app_tx_id}")
    
    # 6. Fund the application
    print("\n6. Funding application account...")
    
    fund_txn = PaymentTxn(
        sender=address,
        sp=params,
        receiver=app_address,
        amt=5_000_000  # 5 ALGO for app operations
    )
    
    signed_fund_txn = fund_txn.sign(private_key)
    fund_tx_id = client.send_transaction(signed_fund_txn)
    wait_for_confirmation(client, fund_tx_id, 4)
    print(f"   Funded app with 5 ALGO")
    print(f"   TX ID: {fund_tx_id}")
    
    # 7. Initialize contract (AFTER deployment)
    print("\n7. Initializing contract...")
    
    from algosdk.atomic_transaction_composer import (
        AtomicTransactionComposer,
        AccountTransactionSigner,
    )
    
    atc = AtomicTransactionComposer()
    signer = AccountTransactionSigner(private_key)
    
    # Get current round for timing parameters
    current_round = client.status()["last-round"]
    
    # Generate test oracle key and parameter hash
    oracle_pk = bytes(32)  # Replace with real oracle public key in production
    p_hash = hashlib.sha256(b"test_parameters").digest()
    
    # Add method call - call the create method AFTER the app exists
    atc.add_method_call(
        app_id=app_id,
        method=contract.get_method_by_name("create"),
        sender=address,
        sp=client.suggested_params(),
        signer=signer,
        method_args=[
            asa_id,                    # asa_quote
            1_000_000,                 # reserve (1 TEST token)
            500_000,                   # min_bid (0.5 TEST token)
            1_000_000,                 # bond (1 ALGO)
            1,                         # second_price (yes)
            current_round + 100,       # commit_end (about 5-6 minutes)
            50,                        # unlock_slack
            100,                       # pay_window
            oracle_pk,                 # oracle public key
            p_hash                     # parameter hash
        ],
        boxes=[(0, b"")]  # Add empty box reference for initialization
    )
    
    try:
        result = atc.execute(client, 4)
        print(f"   Contract initialized!")
        print(f"   Init TX ID: {result.tx_ids[0]}")
    except Exception as e:
        print(f"   Initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 8. Read global state to verify
    print("\n8. Verifying contract state...")
    
    app_info = client.application_info(app_id)
    global_state = app_info.get('params', {}).get('global-state', [])
    
    print("   Global State:")
    for item in global_state[:5]:  # Show first 5 items
        key = base64.b64decode(item['key']).decode('utf-8', errors='ignore')
        if item['value']['type'] == 1:  # bytes
            value = base64.b64decode(item['value'].get('bytes', ''))
            if len(value) < 20:
                print(f"     {key}: {value.hex()}")
            else:
                print(f"     {key}: {value.hex()[:20]}...")
        else:  # uint
            value = item['value'].get('uint', 0)
            print(f"     {key}: {value}")
    
    # 9. Save deployment info
    print("\n" + "=" * 60)
    print("DEPLOYMENT SUCCESSFUL!")
    print("=" * 60)
    
    deployment_info = {
        "app_id": app_id,
        "app_address": app_address,
        "asa_id": asa_id,
        "creator": address,
        "network": "localnet",
        "commit_end_round": current_round + 100,
        "transactions": {
            "create_asa": asa_tx_id,
            "deploy_app": app_tx_id,
            "fund_app": fund_tx_id,
            "init_app": result.tx_ids[0]
        }
    }
    
    with open("deployment.json", "w") as f:
        json.dump(deployment_info, f, indent=2)
    
    print(f"\nKey Information:")
    print(f"  • Application ID: {app_id}")
    print(f"  • App Address: {app_address}")
    print(f"  • ASA ID: {asa_id}")
    print(f"  • Creator: {address}")
    print(f"  • Commit ends at round: {current_round + 100}")
    
    print(f"\nFiles created:")
    print(f"  • deployment.json - All deployment details")
    print(f"  • approval.teal - Approval program TEAL code")
    print(f"  • clear.teal - Clear state program TEAL code")
    
    print("\nNext Steps:")
    print("1. Test the auction by having users opt-in and commit bids")
    print("2. Example commands to run in sandbox:")
    print(f"   # User opts into the application")
    print(f"   ./sandbox goal app optin --app-id {app_id} -f <USER_ADDRESS>")
    print(f"   # User opts into receiving the TEST token")
    print(f"   ./sandbox goal asset optin --assetid {asa_id} -f <USER_ADDRESS>")
    
    print("\nTo interact with the contract, you can:")
    print("   • Use the provided test scripts")
    print("   • Use sandbox goal commands")
    print("   • Build a frontend application")

if __name__ == "__main__":
    main()