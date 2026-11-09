import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getMock, getSafe } from "../utils/setup";
import {
    buildContractCall,
    buildSafeTransaction,
    buildSignatureBytes,
    calculateSafeTransactionHash,
    executeContractCallWithSigners,
    executeTx,
    executeTxWithSigners,
    safeApproveHash,
} from "../../src/utils/execution";
import { chainId } from "../utils/encoding";
import { getSenderAddressFromContractRunner } from "../utils/contracts";
import { MAX_GUARDS, deployTestGuards, guardChecks, guardListStorage, readStorage } from "../utils/guards";

describe("GuardManager", () => {
    const GUARD_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes("guard_manager.guard.address"));

    const setupWithTemplate = hre.deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const validGuardMock = await getMock();
        const validGuardMockAddress = await validGuardMock.getAddress();
        const signers = await hre.ethers.getSigners();
        const [, user2] = signers;

        const guardContract = await hre.ethers.getContractAt("ITransactionGuard", AddressZero);
        const guardEip165Calldata = guardContract.interface.encodeFunctionData("supportsInterface", ["0xe6d7a83a"]);
        await validGuardMock.givenCalldataReturnBool(guardEip165Calldata, true);
        const safe = await getSafe({ owners: [user2.address] });
        await executeContractCallWithSigners(safe, safe, "setGuards", [[validGuardMockAddress]], [user2]);
        return {
            safe,
            validGuardMock,
            guardEip165Calldata,
            signers,
        };
    });

    describe("setGuards", () => {
        it("reverts if the guard does not implement the ERC165 ITransactionGuard Interface", async () => {
            const {
                signers: [user1, user2],
            } = await setupWithTemplate();
            const safe = await getSafe({ owners: [user1.address] });

            await expect(executeContractCallWithSigners(safe, safe, "setGuards", [[user2.address]], [user1])).to.be.reverted;
        });

        it("emits an event when the guard is changed", async () => {
            const {
                validGuardMock,
                signers: [user1],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safe = await getSafe({ owners: [user1.address] });

            await expect(executeContractCallWithSigners(safe, safe, "setGuards", [[validGuardMockAddress]], [user1]))
                .to.emit(safe, "ChangedGuards")
                .withArgs([validGuardMockAddress]);

            await expect(executeContractCallWithSigners(safe, safe, "setGuards", [[]], [user1]))
                .to.emit(safe, "ChangedGuards")
                .withArgs([]);
        });

        it("is not called when setting initially", async () => {
            const {
                validGuardMock,
                signers: [user1],
            } = await setupWithTemplate();

            const invocationCountBefore = await validGuardMock.invocationCount();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safe = await getSafe({ owners: [user1.address] });

            await executeContractCallWithSigners(safe, safe, "setGuards", [[validGuardMockAddress]], [user1]);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            // Transaction Guard should not be called, as it was not set before the transaction execution
            expect(await validGuardMock.invocationCount()).to.be.eq(invocationCountBefore);
        });

        it("is called when removed", async () => {
            const {
                safe,
                validGuardMock,
                signers: [, user2],
            } = await setupWithTemplate();
            const invocationCountBefore = await validGuardMock.invocationCount();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safeAddress = await safe.getAddress();
            const safeMsgSender = getSenderAddressFromContractRunner(safe);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            const safeTx = await buildContractCall(safe, "setGuards", [[]], await safe.nonce());
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);

            await expect(executeTx(safe, safeTx, [signature]))
                .to.emit(safe, "ChangedGuards")
                .withArgs([]);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + "".padStart(64, "0"),
            );

            expect(await validGuardMock.invocationCount()).to.be.eq(invocationCountBefore + 2n);
            const guardInterface = (await hre.ethers.getContractAt("ITransactionGuard", validGuardMockAddress)).interface;
            const checkTxData = guardInterface.encodeFunctionData("checkTransaction", [
                safeTx.to,
                safeTx.value,
                safeTx.data,
                safeTx.operation,
                safeTx.safeTxGas,
                safeTx.baseGas,
                safeTx.gasPrice,
                safeTx.gasToken,
                safeTx.refundReceiver,
                signatureBytes,
                safeMsgSender,
            ]);
            expect(await validGuardMock.invocationCountForCalldata.staticCall(checkTxData)).to.be.eq(1);
            // Transaction Guard should also be called for post exec check, even if it is removed with the Safe tx
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);
            expect(await validGuardMock.invocationCountForCalldata.staticCall(checkExecData)).to.be.eq(1);
        });
    });

    describe("execTransaction", () => {
        it("reverts if the pre hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safeAddress = await safe.getAddress();
            const safeMsgSender = getSenderAddressFromContractRunner(safe);

            const safeTx = buildSafeTransaction({ to: validGuardMockAddress, data: "0xbaddad42", nonce: await safe.nonce() });
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);
            const guardInterface = (await hre.ethers.getContractAt("ITransactionGuard", validGuardMockAddress)).interface;
            const checkTxData = guardInterface.encodeFunctionData("checkTransaction", [
                safeTx.to,
                safeTx.value,
                safeTx.data,
                safeTx.operation,
                safeTx.safeTxGas,
                safeTx.baseGas,
                safeTx.gasPrice,
                safeTx.gasToken,
                safeTx.refundReceiver,
                signatureBytes,
                safeMsgSender,
            ]);
            await validGuardMock.givenCalldataRevertWithMessage(checkTxData, "Computer says Nah");
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);

            await expect(executeTx(safe, safeTx, [signature])).to.be.revertedWith("Computer says Nah");

            await validGuardMock.reset();

            await expect(executeTx(safe, safeTx, [signature])).to.emit(safe, "ExecutionSuccess");

            expect(await validGuardMock.invocationCount()).to.eq(3n);
            expect(await validGuardMock.invocationCountForCalldata(checkTxData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata(checkExecData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata("0xbaddad42")).to.eq(1n);
        });

        it("reverts if the post hook of the guard reverts", async () => {
            const {
                safe,
                validGuardMock,
                signers: [, user2],
            } = await setupWithTemplate();
            const validGuardMockAddress = await validGuardMock.getAddress();
            const safeAddress = await safe.getAddress();
            const safeMsgSender = getSenderAddressFromContractRunner(safe);

            const safeTx = buildSafeTransaction({ to: validGuardMockAddress, data: "0xbaddad42", nonce: await safe.nonce() });
            const signature = await safeApproveHash(user2, safe, safeTx);
            const signatureBytes = buildSignatureBytes([signature]);
            const guardInterface = (await hre.ethers.getContractAt("ITransactionGuard", validGuardMockAddress)).interface;
            const checkTxData = guardInterface.encodeFunctionData("checkTransaction", [
                safeTx.to,
                safeTx.value,
                safeTx.data,
                safeTx.operation,
                safeTx.safeTxGas,
                safeTx.baseGas,
                safeTx.gasPrice,
                safeTx.gasToken,
                safeTx.refundReceiver,
                signatureBytes,
                safeMsgSender,
            ]);
            const checkExecData = guardInterface.encodeFunctionData("checkAfterExecution", [
                calculateSafeTransactionHash(safeAddress, safeTx, await chainId()),
                true,
            ]);
            await validGuardMock.givenCalldataRevertWithMessage(checkExecData, "Computer says Nah");

            await expect(executeTx(safe, safeTx, [signature])).to.be.revertedWith("Computer says Nah");

            await validGuardMock.reset();

            await expect(executeTx(safe, safeTx, [signature])).to.emit(safe, "ExecutionSuccess");

            expect(await validGuardMock.invocationCount()).to.eq(3n);
            expect(await validGuardMock.invocationCountForCalldata(checkTxData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata(checkExecData)).to.eq(1n);
            expect(await validGuardMock.invocationCountForCalldata("0xbaddad42")).to.eq(1n);
        });
    });

    describe("multiple guards", () => {
        const setupWithGuards = hre.deployments.createFixture(async ({ deployments }) => {
            await deployments.fixture();
            const signers = await hre.ethers.getSigners();
            const safe = await getSafe({ owners: [signers[0].address] });
            const guards = await deployTestGuards(MAX_GUARDS + 1);
            const guardAddresses = await Promise.all(guards.map((guard) => guard.getAddress()));
            return { safe, safeAddress: await safe.getAddress(), guards, guardAddresses, signers };
        });

        const guardMock = async (supported: boolean) => {
            const mock = await getMock();
            const guardInterface = (await hre.ethers.getContractAt("ITransactionGuard", AddressZero)).interface;
            await mock.givenCalldataReturnBool(guardInterface.encodeFunctionData("supportsInterface", ["0xe6d7a83a"]), supported);
            return { mock, guardInterface };
        };

        it("can only be called from Safe itself", async () => {
            const { safe, guardAddresses } = await setupWithGuards();

            await expect(safe.setGuards([guardAddresses[0]])).to.be.revertedWith("GS031");
        });

        it("returns no guards for a new Safe", async () => {
            const { safe } = await setupWithGuards();

            expect(await safe.getGuards()).to.deep.eq([]);
        });

        it("sets the guards in order and emits an event", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithGuards();
            const guards = guardAddresses.slice(0, 3);

            await expect(executeContractCallWithSigners(safe, safe, "setGuards", [guards], [user1]))
                .to.emit(safe, "ChangedGuards")
                .withArgs(guards);
            expect(await safe.getGuards()).to.deep.eq(guards);
        });

        it("stores the first guard with the number of other guards, followed by the other guards", async () => {
            const {
                safe,
                safeAddress,
                guardAddresses,
                signers: [user1],
            } = await setupWithGuards();

            for (const count of [1, 2, MAX_GUARDS]) {
                const guards = guardAddresses.slice(0, count);
                await executeContractCallWithSigners(safe, safe, "setGuards", [guards], [user1]);
                expect(await readStorage(safeAddress, GUARD_STORAGE_SLOT, count)).to.deep.eq(guardListStorage(guards));
            }
            // A single guard is a clean address, as in Safe v1.5.0.
            expect(guardListStorage([guardAddresses[0]])).to.deep.eq([ethers.zeroPadValue(guardAddresses[0], 32)]);
        });

        it("replaces all guards, and removes all guards with an empty array", async () => {
            const {
                safe,
                safeAddress,
                guards,
                guardAddresses,
                signers: [user1, user2],
            } = await setupWithGuards();
            await executeContractCallWithSigners(safe, safe, "setGuards", [guardAddresses.slice(0, 3)], [user1]);

            await executeContractCallWithSigners(safe, safe, "setGuards", [[guardAddresses[3]]], [user1]);
            expect(await safe.getGuards()).to.deep.eq([guardAddresses[3]]);
            // The slots of the previous guards past the end of the list are ignored.
            const safeTx = buildSafeTransaction({ to: user2.address, nonce: await safe.nonce() });
            expect(await guardChecks(executeTxWithSigners(safe, safeTx, [user1]), guards)).to.deep.eq([
                "3:CheckTransaction",
                "3:CheckAfterExecution",
            ]);

            await executeContractCallWithSigners(safe, safe, "setGuards", [[]], [user1]);
            expect(await safe.getGuards()).to.deep.eq([]);
            expect(await hre.ethers.provider.getStorage(safeAddress, GUARD_STORAGE_SLOT)).to.eq(ethers.ZeroHash);
        });

        it("reverts for the zero address", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithGuards();

            await expect(
                executeContractCallWithSigners(safe, safe, "setGuards", [[guardAddresses[0], AddressZero]], [user1]),
            ).to.be.revertedWith("GS300");
        });

        it("reverts if a guard does not support the ITransactionGuard interface", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithGuards();
            const { mock } = await guardMock(false);

            await expect(
                executeContractCallWithSigners(safe, safe, "setGuards", [[guardAddresses[0], await mock.getAddress()]], [user1]),
            ).to.be.revertedWith("GS300");
        });

        it("reverts if a guard is listed twice", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithGuards();
            const guards = [guardAddresses[0], guardAddresses[1], guardAddresses[0]];

            await expect(executeContractCallWithSigners(safe, safe, "setGuards", [guards], [user1])).to.be.revertedWith("GS302");
        });

        it("reverts for more than 8 guards", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithGuards();

            await expect(executeContractCallWithSigners(safe, safe, "setGuards", [guardAddresses], [user1])).to.be.revertedWith("GS303");
        });

        it("keeps a guard set by Safe v1.5.0", async () => {
            const {
                safe,
                safeAddress,
                guards,
                guardAddresses,
                signers: [user1, user2],
            } = await setupWithGuards();
            await hre.network.provider.send("hardhat_setStorageAt", [
                safeAddress,
                GUARD_STORAGE_SLOT,
                ethers.zeroPadValue(guardAddresses[0], 32),
            ]);

            expect(await safe.getGuards()).to.deep.eq([guardAddresses[0]]);
            const safeTx = buildSafeTransaction({ to: user2.address, nonce: await safe.nonce() });
            expect(await guardChecks(executeTxWithSigners(safe, safeTx, [user1]), guards)).to.deep.eq([
                "0:CheckTransaction",
                "0:CheckAfterExecution",
            ]);
        });

        it("runs the pre-execution checks in order and the post-execution checks in reverse order", async () => {
            const {
                safe,
                guards,
                guardAddresses,
                signers: [user1, user2],
            } = await setupWithGuards();
            await executeContractCallWithSigners(safe, safe, "setGuards", [guardAddresses.slice(0, MAX_GUARDS)], [user1]);

            const safeTx = buildSafeTransaction({ to: user2.address, nonce: await safe.nonce() });
            const indices = [...Array(MAX_GUARDS).keys()];
            expect(await guardChecks(executeTxWithSigners(safe, safeTx, [user1]), guards)).to.deep.eq([
                ...indices.map((i) => `${i}:CheckTransaction`),
                ...[...indices].reverse().map((i) => `${i}:CheckAfterExecution`),
            ]);
        });

        it("runs the post-execution checks of the guards read before execution", async () => {
            const {
                safe,
                guards,
                guardAddresses,
                signers: [user1],
            } = await setupWithGuards();
            await executeContractCallWithSigners(safe, safe, "setGuards", [guardAddresses.slice(0, 2)], [user1]);

            // A transaction replacing guards 0 and 1 with guards 2 and 3 runs the post-execution checks of 0 and 1 only.
            const tx = executeContractCallWithSigners(safe, safe, "setGuards", [guardAddresses.slice(2, 4)], [user1]);
            expect(await guardChecks(tx, guards)).to.deep.eq([
                "0:CheckTransaction",
                "1:CheckTransaction",
                "1:CheckAfterExecution",
                "0:CheckAfterExecution",
            ]);
            expect(await safe.getGuards()).to.deep.eq(guardAddresses.slice(2, 4));
        });

        for (const check of ["checkTransaction", "checkAfterExecution"] as const) {
            it(`reverts if the ${check} of any guard reverts`, async () => {
                const {
                    safe,
                    guardAddresses,
                    signers: [user1, user2],
                } = await setupWithGuards();
                const { mock, guardInterface } = await guardMock(true);
                const guards = [guardAddresses[0], await mock.getAddress(), guardAddresses[1]];
                await executeContractCallWithSigners(safe, safe, "setGuards", [guards], [user1]);
                await mock.givenMethodRevertWithMessage(guardInterface.getFunction(check).selector, "Computer says Nah");

                const safeTx = buildSafeTransaction({ to: user2.address, nonce: await safe.nonce() });
                await expect(executeTxWithSigners(safe, safeTx, [user1])).to.be.revertedWith("Computer says Nah");
            });
        }
    });
});
