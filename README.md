# Simple interface for [Venus.io](https://venus.io)

This is a small library to interact with Venus's smart contracts directly with minimal overhead.

## What is Venus.io?

Venus is a borrowing / lending network on Binance Smart Chain, similar to Aave or Compound on Ethereum.

Venus is useful to earn passive yield on your crypto assets. Simply deposit your crypto into the vToken contract, and start earning interest immediately!

Features:
* Auto-approves both the vToken and underlying BEP20 token
* Has a "safe" borrow function that borrows an amount that is unlikely to be liquidated
* Example usage is in index.ts for 4 main functions: mint (deposit), borrow, repay, redeem (withdraw)

Coming soon: ability to mint/burn VAI, Venus's stable coin.
