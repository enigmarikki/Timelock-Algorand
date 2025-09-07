# Algorand Sealed-Bid Auction Implementation Flow

## Round Windows (Algorand)
```
start_round = S
commit_end  = C        # commits allowed while round < C
unlock_slack = U       # reveals allowed when C ≤ round < C+U
settle_start = C+U     # settle allowed when round ≥ C+U
pay_window  = P        # winner must pay before round > settle_round + P
```

## Actors / Notation

- **Seller** (auction creator)
- **Bidder_i** (any participant)
- **Revealer** (anyone: bidder, seller, or 3rd party)
- **Oracle** (attests VDF/RSW result)
- **App** (Algorand Application)
- **USDC** = ASA id of the quote asset
- **Bond** = anti-spam fee paid in microAlgos
- **h** = sha256(enc(bid)||salt||anon_key||app_id)
- **P_hash** = hash of auction timelock params
- **att** = ed25519(Sign, Sha256(CBOR{app_id, hy, round, P_hash, w=[C, C+U)}))
- **hy** = H(y) where y = s^(2^T) from timelock

## Global / Local State (at a glance)

**Globals:** SELLER, ASA_QUOTE, RESERVE, MIN_BID, BOND, SECOND_PRICE (0/1), COMMIT_END=C, UNLOCK_SLACK=U, PAY_WINDOW=P, ORACLE_PK, P_HASH, WINNER, WIN_BID, SECOND_BID, SECOND_WINNER, SETTLED (0/1), SETTLE_ROUND

**Locals (per bidder):** COMMIT=h, C_CID, ANON_KEY, BONDED(0/1), REVEALED(0/1), BID, REFUNDED(0/1), REMAINING_BOND

**Boxes:** KYC:<addr> -> 1, <commit_hash> -> <bidder_address>

## 1) Auction Creation (Seller)

**Step 1: Bare Create**
```
Seller            App
  |               |
  |  ApplicationCreateTxn (NoOp, bare create) ---------------------------->
  |               |  OnCreate: (bare create, no parameters set)
  |               |
  |<--------------|  app_id returned
```

**Step 2: Initialize Parameters**
```
Seller            App
  |               |
  |  AppCall: method "create", args(asa_quote, reserve, min_bid, bond,
  |                                 second_price, commit_end, unlock_slack,
  |                                 pay_window, oracle_pk, p_hash) ---------->
  |               |  create():
  |               |    - Set globals (ASA_QUOTE, RESERVE, MIN_BID, BOND,
  |               |      SECOND_PRICE, COMMIT_END=C, UNLOCK_SLACK=U,
  |               |      PAY_WINDOW=P, P_HASH, ORACLE_PK, SELLER=Txn.sender)
  |               |    - Assert C > Global.round()
  |               |    - Initialize WINNER="", WIN_BID=0, SECOND_BID=0, etc.
  |               |
  |<--------------| OK
```

### Optional KYC (before commits start)

```
Seller            App
  |  AppCall set_kyc(addr,1) (seller-only; only if Global.round() < S+small) -->
  |               | BoxWrite: KYC:<addr> = 1
```

## 2) Commit Phase (Bidder → App) [round < C]

**2-txn Group:** [0] Payment (bond) + [1] AppCall commit(h, C_cid, anon_key)

```
Bidder_i          App
  |  [0] Payment: amount=BOND, receiver=app_addr ------------------------->
  |  [1] AppCall: method "commit", args(h, C_cid, anon_key)  -------------->
  |               | AVM checks in commit():
  |               |   - Assert(Global.round() < COMMIT_END)
  |               |   - Optional KYC: Assert(BoxGet KYC:Bidder_i == 1) or L_KYC_OK==1
  |               |   - Assert(Global.group_size() == 2)
  |               |   - Assert(Gtxn[0].type == Payment &&
  |               |            Gtxn[0].receiver == Global.current_application_address() &&
  |               |            Gtxn[0].amount == App.globalGet(BOND))
  |               |   - Assert(App.localGet(Bidder_i, BONDED) == 0)
  |               | Effects:
  |               |   - LocalPut(COMMIT=h, C_CID, ANON_KEY, BONDED=1,
  |               |              REVEALED=0, REFUNDED=0, BID=0, REMAINING_BOND=BOND)
  |               |   - BoxPut(h, Txn.sender) [commit-to-bidder mapping]
  |<--------------| OK
```

### Notes
- The bond funds later reveal bounties (and is forfeited if never revealed)
- h binds bid, salt, anon_key, and app_id (prevents cross-auction replay)

## 3) Unlock / Reveal Window [C ≤ round < C+U]

Anyone can reveal for a specific commit and earn a bounty.

**Single AppCall:** reveal_for(commit_id, bid, salt, hy, att)

```
Revealer          Oracle                         App
  |  (Compute VDF/RSW → y, π)                    |
  |--------------------------------------------->|  POST /attest {app_id, P_hash, round, y, π}
  |                        (verify π; derive hy) |
  |<---------------------------------------------|  {hy, att}
  |
  |  AppCall: method "reveal_for",
  |           args(commit_id, bid, salt, hy, att) ------------------------>
  |                                    App checks in reveal_for():
  |                                    - Assert(COMMIT_END ≤ Global.round()
  |                                             < COMMIT_END + UNLOCK_SLACK)
  |                                    - msg = Concat("v:1", app_id, hy, round,
  |                                                    P_hash, commit_end, commit_end+slack)
  |                                    - Assert(ed25519verify_bare(att, msg, ORACLE_PK))
  |                                    - Lookup commit owner = Bidder_j by BoxGet(commit_id)
  |                                    - Assert(sha256(enc(bid)||salt||
  |                                                   App.localGet(Bidder_j, ANON_KEY)||
  |                                                   Itob(App.id())) ==
  |                                            App.localGet(Bidder_j, COMMIT))
  |                                    - Assert(App.localGet(Bidder_j, REVEALED)==0)
  |                                    Effects:
  |                                      * LocalPut(Bidder_j, REVEALED=1, BID=bid)
  |                                      * Update global leader board:
  |                                          if bid > WIN_BID:
  |                                              SECOND_BID = WIN_BID
  |                                              SECOND_WINNER = WINNER
  |                                              WIN_BID    = bid
  |                                              WINNER     = Bidder_j
  |                                          elif bid > SECOND_BID:
  |                                              SECOND_BID = bid
  |                                              SECOND_WINNER = Bidder_j
  |                                      * Bond handling:
  |                                          if Txn.sender == Bidder_j:
  |                                             LocalPut(REMAINING_BOND = bond) [held for refund/slash]
  |                                          else:
  |                                             pay app→Txn.sender = 70% bond (immediate)
  |                                             LocalPut(Bidder_j, REMAINING_BOND = 30% bond)
  |<------------------------------------------------------------------------ OK
```

### Notes
- The oracle never sees the bid; it signs only (app_id, hy, round, P_hash, window)
- The app verifies h against (bid, salt, anon_key, app_id); the bid stays hidden until this moment

## 4 Settle [round ≥ C+U]

Anyone can settle once the reveal window closes.

```
Caller            App
  |  AppCall: method "settle" -------------------------------------------->
  |               | Checks:
  |               |   - Assert(Global.round() ≥ COMMIT_END + UNLOCK_SLACK)
  |               |   - Assert(SETTLED == 0)
  |               | Effects:
  |               |   - If WINNER != zero && WIN_BID ≥ RESERVE:
  |               |        SETTLED=1; SETTLE_ROUND=Global.round()
  |               |     else:
  |               |        SETTLED=1; (no winner — allow refunds; seller may sweep bonds)
  |<--------------| OK
```

## 5A Winner Pays (Pay-on-Win) within window [round ≤ SETTLE_ROUND + P]

**2-txn Group:** [0] AssetTransfer (USDC) + [1] AppCall finalize_win(price)

```
Winner            App
  |  [0] AssetTransfer: sender=Winner, receiver=app_addr,
  |     asset=USDC, amount=price ---------------------------------------->
  |  [1] AppCall: "finalize_win", args(price) ---------------------------->
  |               | Checks:
  |               |   - Assert(SETTLED==1 && Txn.sender==WINNER)
  |               |   - Assert(Global.round() ≤ SETTLE_ROUND + PAY_WINDOW)
  |               |   - Assert(Gtxn[0].type==AssetTransfer &&
  |               |            Gtxn[0].xfer_asset==ASA_QUOTE &&
  |               |            Gtxn[0].asset_receiver==app_addr &&
  |               |            Gtxn[0].asset_amount == price)
  |               |   - If SECOND_PRICE==1:
  |               |         price_expected = max(SECOND_BID, RESERVE)
  |               |     else:
  |               |         price_expected = max(WIN_BID, RESERVE)
  |               |   - Assert(price == price_expected)
  |               | Effects:
  |               |   - InnerTxn: app→SELLER AssetTransfer(USDC, amount=price)
  |               |   - If winner has REMAINING_BOND > 0:
  |               |       InnerTxn: app→WINNER Payment(amount=REMAINING_BOND)
  |               |       LocalPut(WINNER, REMAINING_BOND=0)
  |<--------------| OK (seller has USDC)
```

### Losers Claim Refund (any time after settle)

```
Loser_j           App
  |  AppCall: "claim_refund" --------------------------------------------->
  |               | Checks:
  |               |   - Assert(SETTLED==1)
  |               |   - Assert(Local REVEALED==1 && caller != WINNER)
  |               |   - Assert(Local REFUNDED==0)
  |               | Effects:
  |               |   - If Local REMAINING_BOND > 0:
  |               |       pay app→Loser_j (Inner Payment) REMAINING_BOND amount
  |               |       LocalPut(REMAINING_BOND=0)
  |               |   - LocalPut(REFUNDED=1)
  |<--------------| OK
```

## 5B Winner Fails to Pay → Promote Next Best

```
Caller            App
  |  AppCall: "promote_next" --------------------------------------------->
  |               | Checks:
  |               |   - Assert(SETTLED==1)
  |               |   - Assert(Global.round() > SETTLE_ROUND + PAY_WINDOW)
  |               | Effects:
  |               |   - If prior WINNER has REMAINING_BOND > 0:
  |               |       Slash to SELLER (Inner Payment REMAINING_BOND amount)
  |               |       LocalPut(prior_WINNER, REMAINING_BOND=0)
  |               |   - WINNER = SECOND_WINNER
  |               |   - WIN_BID = SECOND_BID
  |               |   - Clear SECOND_WINNER="", SECOND_BID=0
  |               |   - SETTLE_ROUND = Global.round() [new payment window]
  |<--------------| OK
```

Then the new winner uses 5A within the next window.
