import { ethers, BigNumber } from "ethers";
import { VBNB_ABI, VBEP20_ABI, UNITROLLER_ABI } from "./ABI/VenusABIs";
import { BEP20 } from "./ABI/BEP20";
import * as CONFIG from "./env.json";

const SOLIDITY_INFINITY = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

export interface VToken {
  decimals: number,
  symbol: string,
  name: string,
  address: string,
  underlying: string
}

/*
* Convenience method for retrieving the default provider (unsigned tx's) and/or wallet (signed tx's).
*/
export const getConnection = (): [ethers.Wallet, ethers.providers.JsonRpcProvider] => {
  const p = new ethers.providers.JsonRpcProvider(CONFIG.RPC);
  return [new ethers.Wallet(CONFIG.KEY, p),p];
}

/*
* Convenience method for retrieving the vToken contract with read/write capability.
*/
const getVTokenContract = async (token: VToken): Promise<ethers.Contract> => {
  const [wallet,] = getConnection();
  const contract = new ethers.Contract(token.address, token.symbol === "vBNB" ? VBNB_ABI: VBEP20_ABI, wallet);
  if(!await contract.isVToken()) throw new Error("Isn't a vToken contract!");

  return contract;
}

/*
* Convenience method for retrieving the Unitroller contract with read/write capability.
*/
const getUnitrollerContract = async (): Promise<ethers.Contract> => {
  const [wallet, ] = getConnection();
  const proxy = new ethers.Contract(CONFIG.UNITROLLER, UNITROLLER_ABI, wallet);

  return proxy;
}

/*
* Deposit into the vToken contract, minting vTokens.
*/
export const mint = async (vToken: VToken, amount: BigNumber): Promise<void> => {
  const getBEP20Balance = async (address: string, w: ethers.Wallet): Promise<BigNumber> => {
    const contract = new ethers.Contract(address, BEP20, w);
    return await contract.balanceOf(w.getAddress());
  }

  const [wallet,] = getConnection();
  const contract = await getVTokenContract(vToken);
  const balance: BigNumber = vToken.symbol === "vBNB" ? await wallet.getBalance() : await getBEP20Balance(vToken.underlying, wallet);

  if(balance.lt(amount)) throw new Error("Don't have enough " + vToken.name);

  const tx = vToken.symbol === "vBNB" ? await contract.mint({value:amount}) : await contract.mint(amount);
  const receipt = await tx.wait();

  console.log("mint(" + vToken.symbol + ")tx hash: " + receipt.transactionHash);

  return Promise.resolve();
}

/*
* Withdraw all deposits from the vToken contract.
*/
export const redeem = async (vToken: VToken): Promise<void> => {
  const contract = await getVTokenContract(vToken);
  
  const balance = await contract.balanceOf(CONFIG.WALLET);
  if(balance.lte(0)) throw new Error("No balance to redeem!");

  const tx = await contract.redeem(balance);
  const receipt = await tx.wait();

  console.log("redeem(" + vToken.symbol + ")tx hash: " + receipt.transactionHash);

  return Promise.resolve();
}

/*
* Borrow a 'safe' amount: 1/2 of the collateral factor for that vToken.
* Venus uses this amount in their interface. Wraps the borrow function below.
*/
export const borrowSafe = async (vToken: VToken): Promise<void> => {
  const [wallet,] = getConnection();
  const contract = await getUnitrollerContract();

  const [,collateralFactor,] = await contract.markets(vToken.address);

  const vTokenContract = await getVTokenContract(vToken);
  const [,deposit,debt,] = await vTokenContract.getAccountSnapshot(wallet.address);
  //Venus uses 1/2 of the collateral factor as the safe borrow amount
  const maxSafeBorrow: BigNumber = deposit.mul(collateralFactor).div(1e18.toString()).div(2);
  return await borrow(vToken, maxSafeBorrow.sub(debt));
}

/*
* Borrow function with no checks. Shouldn't be called directly.
*/
const borrow = async (vToken: VToken, amount: BigNumber): Promise<void> => {
  const contract = await getVTokenContract(vToken);

  const tx = await contract.borrow(amount);
  const receipt = await tx.wait();

  console.log("borrow(" + vToken.symbol + ") tx hash: " + receipt.transactionHash);

  return Promise.resolve();
}

/*
* Repay the loan in full. Assumes the wallet is able to repay.
*/
export const repay = async (vToken: VToken): Promise<void> => {
  const [wallet,] = getConnection();
  const contract = await getVTokenContract(vToken);

  const [,, debt,] = await contract.getAccountSnapshot(wallet.address);
  const tx = vToken.symbol === "vBNB" ? await contract.repayBorrow({value:debt}) : await contract.repayBorrow(debt);
  const receipt = await tx.wait();

  console.log("repay(" + vToken.symbol + ") tx hash: " + receipt.transactionHash);

  return Promise.resolve();
}

/*
* Get the vToken objects as specified in the ENV.JSON.
* If necessary, approves both the Venus market and the underlying BEP20.
*/
export const getVTokens = async (): Promise<VToken[]> => {
  const [wallet,provider] = getConnection();
  let vTokens: VToken[] = [];
  for(let i = 0; i < CONFIG.VTOKENS.length; i++) {
    const v = CONFIG.VTOKENS[i]
    const contract = new ethers.Contract(v.address,v.symbol === "vBNB" ? VBNB_ABI : VBEP20_ABI, provider);
    const vt = {
      decimals: await contract.decimals(),
      symbol: await contract.symbol(),
      name: await contract.name(),
      address: v.address,
      underlying: v.symbol === "vBNB" ? "" : await contract.underlying()
    };
    const unitroller = await getUnitrollerContract();
    
    if(!await unitroller.checkMembership(CONFIG.WALLET, vt.address)) {
      await unitroller.enterMarkets([vt.address]);
      if(vt.symbol !== "vBNB") {
        const c = new ethers.Contract(vt.underlying, BEP20, wallet);
        if(!(await c.allowance(CONFIG.WALLET, CONFIG.UNITROLLER) > 0)) {
          await c.approve(vt.address, SOLIDITY_INFINITY);
          console.log("Approved: " + v.symbol);
        }
      }
    }
    vTokens.push(vt);
  }
  
  return vTokens;
}