import * as Venus from './Venus';
import { ethers, BigNumber} from "ethers";

const init = async (): Promise<void> => {
  const vTokens = await Venus.getVTokens();
  const vBNB = vTokens.find(t=>t.symbol === "vBNB");
  if(!vBNB) throw new Error("Can't find vBNB");
  const [wallet, provider] = Venus.getConnection();
  
  const balance = await wallet.getBalance();
  const eth = ethers.utils.parseEther(""+Math.floor(parseFloat(ethers.utils.formatEther(balance))));

  //mint
/*
  try {
    await Venus.mint(vBNB as Venus.VToken, eth);
  } catch(e) {
    console.log(e);
  }

  //borrow
  try {
    await Venus.borrowSafe(vBNB as Venus.VToken);
  } catch(e) {
    console.log(e);
  }

  //repay
  try {
    await Venus.repay(vBNB as Venus.VToken);
  } catch(e) {
    console.log(e);
  }
*/
  //redeem
  try {
    await Venus.redeem(vBNB as Venus.VToken);
  } catch(e) {
    console.log(e);
  }

}


init();