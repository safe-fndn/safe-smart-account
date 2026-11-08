import { expect } from "chai";
import { Wallet } from "ethers";
import {
    EIP712_SAFE_TX_TYPE,
    buildSafeTransaction,
    calculateSafeTransactionHash,
    safeSignMessage,
    safeSignTypedData,
    signHash,
} from "../../src/utils/execution";

describe("Offline signing with an explicit zero chain ID", () => {
    const signer = new Wallet("0x" + "11".repeat(32));
    const safeAddress = "0x" + "22".repeat(20);
    const tx = buildSafeTransaction({ to: safeAddress, nonce: 0 });

    for (const chainId of [0, 0n, "0"]) {
        it(`signs typed data with ${typeof chainId} zero without a provider`, async () => {
            const signature = await safeSignTypedData(signer, safeAddress, tx, chainId);
            expect(signature.data).to.equal(
                await signer.signTypedData({ verifyingContract: safeAddress, chainId }, EIP712_SAFE_TX_TYPE, tx),
            );
        });

        it(`signs a message with ${typeof chainId} zero without a provider`, async () => {
            const signature = await safeSignMessage(signer, safeAddress, tx, chainId);
            const expected = await signHash(signer, calculateSafeTransactionHash(safeAddress, tx, chainId));
            expect(signature).to.deep.equal(expected);
        });
    }
});
