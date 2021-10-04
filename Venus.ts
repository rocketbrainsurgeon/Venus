import { ethers, BigNumber } from "ethers";
import { VBNB, VBEP20, UNITROLLER } from "./ABI/vToken";
import * as CONFIG from "./env.json";

export interface VToken {
  decimals: number,
  symbol: string,
  name: string,
  address: string,
  underlying: string | null
}

export const getConnection = (): [ethers.Wallet, ethers.providers.JsonRpcProvider] => {
  const p = new ethers.providers.JsonRpcProvider(CONFIG.RPC);
  return [new ethers.Wallet(CONFIG.KEY, p),p];
}

const getVTokenContract = async (token: VToken): Promise<ethers.Contract> => {
  const [wallet,] = getConnection();
  const contract = new ethers.Contract(token.address, token.symbol === "vBNB" ? VBNB: VBEP20, wallet);
  if(!await contract.isVToken()) throw new Error("Isn't a vToken contract!");

  return contract;
}

const getUnitrollerContract = async (): Promise<ethers.Contract> => {
  const [wallet,] = getConnection();
  const contract = new ethers.Contract(CONFIG.UNITROLLER, UNITROLLER, wallet);
  return contract;
}

//supply
export const mint = async (vToken: VToken, amount: BigNumber): Promise<void> => {
  const [wallet,] = getConnection();
  const contract = await getVTokenContract(vToken);
  const balance: BigNumber = await wallet.getBalance();

  if(balance.lt(amount)) throw new Error("Don't have enough BNB.");

  let overrides = {value:amount};

  const tx = vToken.symbol === "vBNB" ? await contract.mint(overrides) : await contract.mint(amount, overrides);
  const receipt = await tx.wait();

  console.log(receipt);

  return Promise.resolve();
}

//redeems all of outstanding balance
export const redeem = async (vToken: VToken): Promise<void> => {
  const method = vToken.symbol === "vBNB" ? "redeemUnderlying(uint256)" : "redeem(uint256)";

  const contract = await getVTokenContract(vToken);
  
  const balance = await contract.balanceOf(CONFIG.WALLET);
  if(balance.lte(0)) throw new Error("No balance to redeem!");

  const tx = await contract[method](balance);
  const receipt = await tx.wait();

  console.log(receipt);

  return Promise.resolve();
}

//will borrow a max of half of the collateral factor
export const borrowSafe = async (vToken: VToken): Promise<void> => {
  const [wallet,] = getConnection();
  const contract = await getUnitrollerContract();

  const [,collateralFactor,] = await contract.markets(vToken.address);
  const safePercent = BigNumber.from(collateralFactor / 1e18 / 2);
  
  const vTokenContract = await getVTokenContract(vToken);
  const [,deposit,debt,] = await vTokenContract.getAccountSnapshot(wallet.address);
  
  const maxSafeBorrow = deposit.multipliedBy(safePercent);

  return await borrow(vToken, BigNumber.from(maxSafeBorrow - debt));
}

//borrow method without checks
export const borrow = async (vToken: VToken, amount: BigNumber): Promise<void> => {
  const contract = await getVTokenContract(vToken);

  const tx = await contract.borrow(amount);
  const receipt = await tx.wait();

  console.log(receipt);

  return Promise.resolve();
}

//repay borrow
//assumes I wasn't an idiot and can repay
export const repay = async (vToken: VToken): Promise<void> => {
  const [wallet,] = getConnection();
  const contract = await getVTokenContract(vToken);

  const [,, borrowBalance,] = await contract.getAccountSnapshot(wallet.address);

  const tx = await contract.repayBorrow(borrowBalance);
  const receipt = await tx.wait();

  console.log(receipt);

  return Promise.resolve();
}

export const getVTokens = async (): Promise<VToken[]> => {
  const [,provider] = getConnection();
  let vTokens: VToken[] = [];
  for(let i = 0; i < CONFIG.VTOKENS.length; i++) {
    const v = CONFIG.VTOKENS[i]
    const contract = new ethers.Contract(v.address,v.name === "vBNB" ? VBNB : VBEP20, provider);
    const vt = {
      decimals: await contract.decimals(),
      symbol: await contract.symbol(),
      name: await contract.name(),
      address: v.address,
      underlying: v.name === "vBNB" ? null : await contract.underlying()
    };
    vTokens.push(vt);
  }
  return vTokens;
}