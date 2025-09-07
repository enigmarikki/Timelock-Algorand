"""
Timelock Auction Smart Contract

This contract implements a sealed-bid second-price auction with commit-reveal scheme
and oracle-based attestation for time-locked bids. The auction allows bidders to
commit hash values during a commit phase, then reveal their bids during a reveal
phase with oracle attestation for timing validation.

Key Features:
- Sealed-bid auction with commit-reveal scheme
- Second-price auction mechanism (winner pays second-highest bid)
- Oracle attestation for secure timing validation
- Bond-based participation with bounty system for revealing
- Optional KYC integration for bidder verification
- Time-locked reveal phase with unlock slack period

Auction Flow:
1. Setup: Creator initializes auction with parameters
2. Commit: Bidders commit hashed bids with bonds
3. Reveal: Bids are revealed with oracle attestation during unlock period
4. Settle: Auction settles after reveal period ends
5. Finalize: Winner pays and receives asset, others get refunds

Global State Variables:
- SELLER: Address of auction creator
- ASA_QUOTE: Asset ID of the token being auctioned
- RESERVE: Minimum acceptable bid price
- MIN_BID: Minimum bid amount allowed
- BOND: Required bond amount for participation
- SECOND_PRICE: Whether to use second-price auction (1) or first-price (0)
- COMMIT_END: Block round when commit phase ends
- UNLOCK_SLACK: Additional blocks after commit_end for reveals
- PAY_WINDOW: Blocks winner has to finalize payment
- ORACLE_PK: Oracle's public key for attestation verification
- P_HASH: Hash of auction parameters
- WINNER/SECOND_WINNER: Addresses of highest/second-highest bidders
- WIN_BID/SECOND_BID: Highest/second-highest bid amounts
- SETTLED: Whether auction has been settled
- SETTLE_ROUND: Block round when auction was settled

Local State Variables:
- COMMIT: Hash of bidder's commitment
- C_CID: Content identifier for commitment
- ANON_KEY: Anonymous key for bid privacy
- BONDED: Whether bidder has posted bond
- REVEALED: Whether bidder has revealed their bid
- BID: Revealed bid amount
- REFUNDED: Whether bidder has claimed refund
- REMAINING_BOND: Remaining bond amount after any deductions
"""
from pyteal import (
    Bytes,
    Router,
    BareCallActions,
    OnCompleteAction,
    CallConfig,
    Seq,
    Assert,
    App,
    abi,
    Cond,
    Txn,
    Global,
    Gtxn,
    Int,
    Expr,
    TxnType,
    ScratchVar,
    TealType,
    If,
    InnerTxnBuilder,
    TxnField,
    Addr,
    OnComplete,
    Return,
    And,
    Btoi,
    Approve,
    Concat,
    Itob,
    Ed25519Verify_Bare,
    Sha256,
    Mode,
    compileTeal,
)

# Global state keys (Bytes)
SELLER = Bytes("SELLER")
ASA_QUOTE = Bytes("ASA_QUOTE")
RESERVE = Bytes("RESERVE")
MIN_BID = Bytes("MIN_BID")
BOND = Bytes("BOND")
SECOND_PRICE = Bytes("SECOND_PRICE")
COMMIT_END = Bytes("COMMIT_END")
UNLOCK_SLACK = Bytes("UNLOCK_SLACK")
PAY_WINDOW = Bytes("PAY_WINDOW")
ORACLE_PK = Bytes("ORACLE_PK")
P_HASH = Bytes("P_HASH")
WINNER = Bytes("WINNER")
WIN_BID = Bytes("WIN_BID")
SECOND_BID = Bytes("SECOND_BID")
SECOND_WINNER = Bytes("SECOND_WINNER")
SETTLED = Bytes("SETTLED")
SETTLE_ROUND = Bytes("SETTLE_ROUND")

# Local state keys (Bytes)
COMMIT = Bytes("COMMIT")
C_CID = Bytes("C_CID")
ANON_KEY = Bytes("ANON_KEY")
BONDED = Bytes("BONDED")
REVEALED = Bytes("REVEALED")
BID = Bytes("BID")
REFUNDED = Bytes("REFUNDED")
REMAINING_BOND = Bytes("REMAINING_BOND")

# KYC box prefix (optional)
KYC_PREFIX = Bytes("KYC:")


def build_router():
    """
    Build and return the PyTeal router for the timelock auction contract.
    
    The router defines all ABI methods and bare call actions for the contract.
    It handles method dispatch based on application arguments and on-complete actions.
    
    Returns:
        Router: PyTeal router instance with all contract methods registered
    """
    # Router for ABI methods
    router = Router(
        "timelock_contracts",
        BareCallActions(
            no_op=OnCompleteAction.create_only(Approve()),
            update_application=OnCompleteAction.call_only(Approve()),
            delete_application=OnCompleteAction.call_only(Approve()),
            close_out=OnCompleteAction.call_only(Approve()),
            opt_in=OnCompleteAction.call_only(Approve()),
            clear_state=OnCompleteAction.never(),
        ),
    )

    @router.method
    def create(
        asa_quote: abi.Uint64,        # Asset ID of token being auctioned
        reserve: abi.Uint64,          # Minimum acceptable bid price
        min_bid: abi.Uint64,          # Minimum bid amount allowed
        bond: abi.Uint64,             # Required bond amount for participation
        second_price: abi.Uint8,      # 1 for second-price auction, 0 for first-price
        commit_end: abi.Uint64,       # Block round when commit phase ends
        unlock_slack: abi.Uint64,     # Additional blocks after commit_end for reveals
        pay_window: abi.Uint64,       # Blocks winner has to finalize payment
        oracle_pk: abi.DynamicBytes,  # Oracle's public key for attestation (32 bytes)
        p_hash: abi.DynamicBytes,     # Hash of auction parameters (32 bytes)
    ) -> Expr:
        """
        Initialize the auction contract with all necessary parameters.
        
        This method can only be called by the contract creator and sets up all
        global state variables for the auction. It validates that the commit_end
        is in the future and initializes all tracking variables to default values.
        
        Args:
            asa_quote: Asset ID of the token being auctioned
            reserve: Minimum acceptable winning bid price
            min_bid: Minimum bid amount that will be accepted
            bond: Amount bidders must post as collateral
            second_price: Whether auction uses second-price (1) or first-price (0)
            commit_end: Block number when commit phase ends
            unlock_slack: Extra blocks after commit_end for reveals
            pay_window: Blocks winner has to pay after settlement
            oracle_pk: 32-byte public key of timing oracle
            p_hash: 32-byte hash of auction parameters for verification
            
        Returns:
            Expr: PyTeal expression that initializes all auction state
        """
        return Seq(
            App.globalPut(SELLER, Txn.sender()),
            App.globalPut(ASA_QUOTE, asa_quote.get()),
            App.globalPut(RESERVE, reserve.get()),
            App.globalPut(MIN_BID, min_bid.get()),
            App.globalPut(BOND, bond.get()),
            App.globalPut(SECOND_PRICE, second_price.get()),
            App.globalPut(COMMIT_END, commit_end.get()),
            App.globalPut(UNLOCK_SLACK, unlock_slack.get()),
            App.globalPut(PAY_WINDOW, pay_window.get()),
            App.globalPut(ORACLE_PK, oracle_pk.get()),
            App.globalPut(P_HASH, p_hash.get()),
            App.globalPut(WINNER, Bytes("")),
            App.globalPut(WIN_BID, Int(0)),
            App.globalPut(SECOND_BID, Int(0)),
            App.globalPut(SECOND_WINNER, Bytes("")),
            App.globalPut(SETTLED, Int(0)),
            App.globalPut(SETTLE_ROUND, Int(0)),
            Assert(commit_end.get() > Global.round()),
            Approve(),
        )

    @router.method
    def commit(
        h: abi.DynamicBytes,          # Hash of commitment (SHA256 of bid+salt+anon_key+app_id)
        c_cid: abi.DynamicBytes,      # Content identifier for the commitment
        anon_key: abi.DynamicBytes,   # Anonymous key for bid privacy (32 bytes)
    ) -> Expr:
        """
        Commit a sealed bid during the commit phase.
        
        Bidders must post a bond and submit a hash commitment of their bid.
        The commitment hash should be SHA256(bid || salt || anon_key || app_id).
        This method requires a grouped payment transaction to post the bond.
        
        Transaction group structure:
        - Txn[0]: Payment of bond amount to contract address
        - Txn[1]: This application call
        
        Args:
            h: 32-byte commitment hash
            c_cid: Content identifier for commitment metadata
            anon_key: 32-byte anonymous key for privacy
            
        Returns:
            Expr: PyTeal expression that validates and stores the commitment
        """
        return Seq(
            Assert(Global.round() < App.globalGet(COMMIT_END)),
            # Optional KYC: Uncomment to enable
            # kyc_check := App.box_get(Concat(KYC_PREFIX, Txn.sender())),
            # Assert(And(kyc_check.hasValue(), Btoi(kyc_check.value()) == Int(1))),
            Assert(Global.group_size() == Int(2)),
            Assert(Gtxn[0].type_enum() == TxnType.Payment),
            Assert(Gtxn[0].receiver() == Global.current_application_address()),
            Assert(Gtxn[0].amount() == App.globalGet(BOND)),
            Assert(App.localGet(Txn.sender(), BONDED) == Int(0)),
            App.localPut(Txn.sender(), COMMIT, h.get()),
            App.localPut(Txn.sender(), C_CID, c_cid.get()),
            App.localPut(Txn.sender(), ANON_KEY, anon_key.get()),
            App.localPut(Txn.sender(), BONDED, Int(1)),
            App.localPut(Txn.sender(), REVEALED, Int(0)),
            App.localPut(Txn.sender(), REFUNDED, Int(0)),
            App.localPut(Txn.sender(), BID, Int(0)),
            App.localPut(Txn.sender(), REMAINING_BOND, App.globalGet(BOND)),
            # Store commitment to bidder mapping in box
            App.box_put(h.get(), Txn.sender()),
            Approve(),
        )

    @router.method
    def reveal_for(
        commit_id: abi.DynamicBytes,  # Hash identifying the commitment to reveal
        bid: abi.Uint64,              # The actual bid amount being revealed
        salt: abi.DynamicBytes,       # Random salt used in commitment hash
        hy: abi.DynamicBytes,         # Hybrid parameter for oracle attestation
        att: abi.DynamicBytes,        # Oracle attestation signature (64 bytes)
    ) -> Expr:
        """
        Reveal a previously committed bid with oracle attestation.
        
        This method validates that:
        1. We're in the reveal phase (after commit_end, before unlock period expires)
        2. The oracle attestation is valid for the current timing
        3. The revealed bid matches the original commitment hash
        4. The bid meets the minimum requirements
        
        The oracle attestation validates a message containing version, app_id,
        hybrid parameter, current round, parameter hash, and timing windows.
        
        If called by a third party (not the bidder), splits the bond reward
        70% to revealer, 30% held for bidder. If self-revealed, full bond
        is held for potential winner payout or refund.
        
        Args:
            commit_id: The commitment hash to reveal
            bid: Actual bid amount in auction tokens
            salt: Random value used in original commitment
            hy: Hybrid parameter for oracle message
            att: 64-byte Ed25519 signature from oracle
            
        Returns:
            Expr: PyTeal expression that validates and processes the reveal
        """
        bidder = ScratchVar(TealType.bytes)
        msg = ScratchVar(TealType.bytes)
        bond_amount = ScratchVar(TealType.uint64)
        revealer_amount = ScratchVar(TealType.uint64)
        bidder_amount = ScratchVar(TealType.uint64)
        
        # Use the MaybeValue returned by App.box_get
        box_result = App.box_get(commit_id.get())
        
        return Seq(
            Assert(App.globalGet(COMMIT_END) <= Global.round()),
            Assert(
                Global.round() < App.globalGet(COMMIT_END) + App.globalGet(UNLOCK_SLACK)
            ),
            
            # Verify attestation is 64 bytes
            Assert(att.length() == Int(64)),
            
            # Msg construction
            msg.store(
                Concat(
                    Bytes("v:1"),
                    Itob(Global.current_application_id()),
                    hy.get(),
                    Itob(Global.round()),
                    App.globalGet(P_HASH),
                    Itob(App.globalGet(COMMIT_END)),
                    Itob(App.globalGet(COMMIT_END) + App.globalGet(UNLOCK_SLACK)),
                )
            ),
            
            # Ed25519Verify_Bare expects: (message, signature, public_key) - signature is 64 bytes, message can be any length
            Assert(Ed25519Verify_Bare(msg.load(), att.get(), App.globalGet(ORACLE_PK))),
            
            # Check box exists and get value
            box_result,
            Assert(box_result.hasValue()),
            bidder.store(box_result.value()),
            
            # Verify commitment
            Assert(
                Sha256(
                    Concat(
                        Itob(bid.get()),
                        salt.get(),
                        App.localGet(bidder.load(), ANON_KEY),
                        Itob(Global.current_application_id()),
                    )
                )
                == App.localGet(bidder.load(), COMMIT)
            ),
            Assert(App.localGet(bidder.load(), REVEALED) == Int(0)),
            Assert(bid.get() >= App.globalGet(MIN_BID)),
            App.localPut(bidder.load(), REVEALED, Int(1)),
            App.localPut(bidder.load(), BID, bid.get()),
            
            # Update leaderboard
            If(bid.get() > App.globalGet(WIN_BID))
            .Then(
                Seq(
                    App.globalPut(SECOND_BID, App.globalGet(WIN_BID)),
                    App.globalPut(SECOND_WINNER, App.globalGet(WINNER)),
                    App.globalPut(WIN_BID, bid.get()),
                    App.globalPut(WINNER, bidder.load()),
                )
            )
            .ElseIf(bid.get() > App.globalGet(SECOND_BID))
            .Then(
                Seq(
                    App.globalPut(SECOND_BID, bid.get()),
                    App.globalPut(SECOND_WINNER, bidder.load()),
                )
            ),
            
            # Bounty payout (immediate for revealer portion only)
            bond_amount.store(App.localGet(bidder.load(), REMAINING_BOND)),
            If(Txn.sender() == bidder.load())
            .Then(
                # Self-reveal: hold full bond for potential claim or slash
                App.localPut(bidder.load(), REMAINING_BOND, bond_amount.load()),
            )
            .Else(
                # Third-party: pay 70% to revealer immediately, hold 30% for bidder
                Seq(
                    revealer_amount.store((bond_amount.load() * Int(70)) / Int(100)),
                    bidder_amount.store((bond_amount.load() * Int(30)) / Int(100)),
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields(
                        {
                            TxnField.type_enum: TxnType.Payment,
                            TxnField.receiver: Txn.sender(),
                            TxnField.amount: revealer_amount.load(),
                        }
                    ),
                    InnerTxnBuilder.Submit(),
                    App.localPut(bidder.load(), REMAINING_BOND, bidder_amount.load()),
                )
            ),
            Approve(),
        )

    @router.method
    def settle() -> Expr:
        """
        Settle the auction after the reveal period ends.
        
        Determines if there's a valid winner (winning bid >= reserve)
        and marks the auction as settled. Can be called by anyone once
        the unlock slack period has expired.
        
        Returns:
            Expr: PyTeal expression that settles the auction state
        """
        return Seq(
            Assert(
                Global.round() >= App.globalGet(COMMIT_END) + App.globalGet(UNLOCK_SLACK)
            ),
            Assert(App.globalGet(SETTLED) == Int(0)),
            If(
                And(
                    App.globalGet(WINNER) != Bytes(""),
                    App.globalGet(WIN_BID) >= App.globalGet(RESERVE),
                )
            )
            .Then(
                Seq(
                    App.globalPut(SETTLED, Int(1)),
                    App.globalPut(SETTLE_ROUND, Global.round()),
                )
            )
            .Else(
                Seq(
                    App.globalPut(SETTLED, Int(1)),
                    App.globalPut(SETTLE_ROUND, Global.round()),
                )
            ),
            Approve(),
        )

    @router.method
    def finalize_win(price: abi.Uint64) -> Expr:
        """
        Finalize the auction by having the winner pay the final price.
        
        Winner must pay either the second-highest bid (second-price auction)
        or their own bid (first-price auction), whichever is higher than reserve.
        Requires a grouped asset transfer transaction with the payment.
        
        Transaction group structure:
        - Txn[0]: Asset transfer of price amount to contract
        - Txn[1]: This application call
        
        Args:
            price: Amount being paid (must match calculated price)
            
        Returns:
            Expr: PyTeal expression that processes winner payment and refund
        """
        expected_price = ScratchVar(TealType.uint64)
        
        return Seq(
            Assert(App.globalGet(SETTLED) == Int(1)),
            Assert(Txn.sender() == App.globalGet(WINNER)),
            Assert(
                Global.round() <= App.globalGet(SETTLE_ROUND) + App.globalGet(PAY_WINDOW)
            ),
            Assert(Global.group_size() == Int(2)),
            Assert(Gtxn[0].type_enum() == TxnType.AssetTransfer),
            Assert(Gtxn[0].xfer_asset() == App.globalGet(ASA_QUOTE)),
            Assert(Gtxn[0].asset_receiver() == Global.current_application_address()),
            Assert(Gtxn[0].asset_amount() == price.get()),
            
            # Calculate expected price
            If(App.globalGet(SECOND_PRICE) == Int(1))
            .Then(
                expected_price.store(
                    If(App.globalGet(SECOND_BID) > App.globalGet(RESERVE))
                    .Then(App.globalGet(SECOND_BID))
                    .Else(App.globalGet(RESERVE))
                )
            )
            .Else(
                expected_price.store(
                    If(App.globalGet(WIN_BID) > App.globalGet(RESERVE))
                    .Then(App.globalGet(WIN_BID))
                    .Else(App.globalGet(RESERVE))
                )
            ),
            Assert(price.get() == expected_price.load()),
            
            # Pay to seller
            InnerTxnBuilder.Begin(),
            InnerTxnBuilder.SetFields(
                {
                    TxnField.type_enum: TxnType.AssetTransfer,
                    TxnField.xfer_asset: App.globalGet(ASA_QUOTE),
                    TxnField.asset_receiver: App.globalGet(SELLER),
                    TxnField.asset_amount: price.get(),
                }
            ),
            InnerTxnBuilder.Submit(),
            
            # Refund bond to winner
            If(App.localGet(Txn.sender(), REMAINING_BOND) > Int(0)).Then(
                Seq(
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields(
                        {
                            TxnField.type_enum: TxnType.Payment,
                            TxnField.receiver: Txn.sender(),
                            TxnField.amount: App.localGet(Txn.sender(), REMAINING_BOND),
                        }
                    ),
                    InnerTxnBuilder.Submit(),
                    App.localPut(Txn.sender(), REMAINING_BOND, Int(0)),
                )
            ),
            Approve(),
        )

    @router.method
    def promote_next() -> Expr:
        return Seq(
            Assert(App.globalGet(SETTLED) == Int(1)),
            Assert(
                Global.round() > App.globalGet(SETTLE_ROUND) + App.globalGet(PAY_WINDOW)
            ),
            # Check if there's a second winner to promote
            Assert(App.globalGet(SECOND_WINNER) != Bytes("")),
            # Slash winner's remaining bond to seller if any
            If(App.localGet(App.globalGet(WINNER), REMAINING_BOND) > Int(0)).Then(
                Seq(
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields(
                        {
                            TxnField.type_enum: TxnType.Payment,
                            TxnField.receiver: App.globalGet(SELLER),
                            TxnField.amount: App.localGet(App.globalGet(WINNER), REMAINING_BOND),
                        }
                    ),
                    InnerTxnBuilder.Submit(),
                    App.localPut(App.globalGet(WINNER), REMAINING_BOND, Int(0)),
                )
            ),
            # Promote second to winner
            App.globalPut(WINNER, App.globalGet(SECOND_WINNER)),
            App.globalPut(WIN_BID, App.globalGet(SECOND_BID)),
            # Reset second winner and bid
            App.globalPut(SECOND_WINNER, Bytes("")),
            App.globalPut(SECOND_BID, Int(0)),
            # Reset settle round
            App.globalPut(SETTLE_ROUND, Global.round()),
            Approve(),
        )

    @router.method
    def claim_refund() -> Expr:
        """
        Allow losing bidders to claim their bond refunds.
        
        After auction settlement, all bidders except the winner can
        reclaim their remaining bond amount. The amount may be reduced
        if they received a reveal bounty from third-party reveals.
        
        Returns:
            Expr: PyTeal expression that refunds remaining bond to bidder
        """
        return Seq(
            Assert(App.globalGet(SETTLED) == Int(1)),
            Assert(App.localGet(Txn.sender(), REVEALED) == Int(1)),
            Assert(Txn.sender() != App.globalGet(WINNER)),
            Assert(App.localGet(Txn.sender(), REFUNDED) == Int(0)),
            # Pay remaining bond portion if any
            If(App.localGet(Txn.sender(), REMAINING_BOND) > Int(0)).Then(
                Seq(
                    InnerTxnBuilder.Begin(),
                    InnerTxnBuilder.SetFields(
                        {
                            TxnField.type_enum: TxnType.Payment,
                            TxnField.receiver: Txn.sender(),
                            TxnField.amount: App.localGet(Txn.sender(), REMAINING_BOND),
                        }
                    ),
                    InnerTxnBuilder.Submit(),
                    App.localPut(Txn.sender(), REMAINING_BOND, Int(0)),
                )
            ),
            App.localPut(Txn.sender(), REFUNDED, Int(1)),
            Approve(),
        )

    @router.method
    def set_kyc(addr: abi.Address, value: abi.Uint8) -> Expr:
        """
        Set KYC status for a bidder address (seller only).
        
        Allows the auction creator to manage KYC verification status
        for participants. When KYC is enabled in commit method,
        only verified addresses can participate.
        
        Args:
            addr: Address to set KYC status for
            value: 1 for verified, 0 for unverified
            
        Returns:
            Expr: PyTeal expression that updates KYC status in box storage
        """
        return Seq(
            Assert(Txn.sender() == App.globalGet(SELLER)),
            Assert(Global.round() < App.globalGet(COMMIT_END)),
            App.box_put(Concat(KYC_PREFIX, addr.get()), Itob(value.get())),
            Approve(),
        )

    @router.method
    def update() -> Expr:
        return Seq(
            Assert(Txn.sender() == App.globalGet(SELLER)),
            Approve(),
        )

    @router.method 
    def delete() -> Expr:
        return Seq(
            Assert(Txn.sender() == App.globalGet(SELLER)),
            Approve(),
        )
    
    return router


def get_compiled_programs(version=8):
    """
    Compile the timelock auction contract programs.
    
    Builds the router and compiles both approval and clear programs
    to TEAL assembly code strings that can be deployed to Algorand.
    
    Args:
        version: TEAL version to compile to (default 8)
        
    Returns:
        tuple: (approval_program, clear_program, contract, router)
            - approval_program: TEAL code string for main logic
            - clear_program: TEAL code string for clear state
            - contract: ABI contract interface
            - router: PyTeal router instance
    """
    router = build_router()
    approval_program, clear_program, contract = router.compile_program(version=version)
    return approval_program, clear_program, contract, router


def get_router():
    """
    Get a fresh router instance for the timelock auction contract.
    
    Useful for testing or when you need to examine the contract
    structure without compiling.
    
    Returns:
        Router: Fresh PyTeal router instance
    """
    return build_router()