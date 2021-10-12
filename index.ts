import * as Venus from './Venus';
import { BigNumber} from "ethers";

const example = async (): Promise<void> => {
  
  //Get all vTokens from the ENV.JSON file
  //Automatically approves both the vToken and the underlying BEP20
  const vTokens = await Venus.getVTokens();
  const vBNB: Venus.VToken | undefined = vTokens.find(t=>t.symbol === "vBNB");
  if(!vBNB) throw new Error("Can't find vBNB");

  const eth = BigNumber.from(1e10);

  try {
    //deposit
    await Venus.mint(vBNB, eth);
    //borrow an amount that won't be liquidated
    await Venus.borrowSafe(vBNB);
    //repay the loan
    await Venus.repay(vBNB);
    //withdraw
    await Venus.redeem(vBNB);
  } catch(e) {
    console.log(e);
  }
}

example();