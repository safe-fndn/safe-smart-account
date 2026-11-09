import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { getSafe, getMock } from "../utils/setup";
import { executeContractCallWithSigners } from "../../src/utils/execution";
import { AddressOne } from "../../src/utils/constants";
import { MAX_GUARDS, deployTestGuards, guardChecks, guardListStorage, readStorage } from "../utils/guards";

describe("ModuleManager", () => {
    const MODULE_GUARD_STORAGE_SLOT = ethers.keccak256(ethers.toUtf8Bytes("module_manager.module_guard.address"));

    const setupTests = deployments.createFixture(async ({ deployments }) => {
        await deployments.fixture();
        const signers = await ethers.getSigners();
        const [user1] = signers;

        const safe = await getSafe({ owners: [user1.address] });

        const validModuleGuardMock = await getMock();
        const moduleGuardContract = await hre.ethers.getContractAt("IModuleGuard", AddressZero);
        const moduleGuardEip165Calldata = moduleGuardContract.interface.encodeFunctionData("supportsInterface", ["0x58401ed8"]);
        await validModuleGuardMock.givenCalldataReturnBool(moduleGuardEip165Calldata, true);

        return {
            safe,
            validModuleGuardMock,
            mock: await getMock(),
            signers,
        };
    });

    describe("enableModule", () => {
        it("can only be called from Safe itself", async () => {
            const {
                safe,
                signers: [, user2],
            } = await setupTests();
            await expect(safe.enableModule(user2.address)).to.be.revertedWith("GS031");
        });

        it("can not set sentinel", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [AddressOne], [user1])).to.revertedWith("GS101");
        });

        it("can not set 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [AddressZero], [user1])).to.revertedWith("GS101");
        });

        it("can not add module twice", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            // Use module for execution to see error
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1])).to.revertedWith("GS102");
        });

        it("emits event for a new module", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user2.address);

            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;

            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address], AddressOne]);
        });

        it("can enable multiple", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user1.address);

            await expect(await safe.isModuleEnabled(user1.address)).to.be.true;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user1.address], AddressOne]);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user2.address);

            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address, user1.address], AddressOne]);
        });
    });

    describe("disableModule", () => {
        it("can only be called from Safe itself", async () => {
            const {
                safe,
                signers: [, user2],
            } = await setupTests();
            await expect(safe.disableModule(AddressOne, user2.address)).to.be.revertedWith("GS031");
        });

        it("can not set sentinel", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();

            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, AddressOne], [user1])).to.revertedWith(
                "GS101",
            );
        });

        it("can not set 0 Address", async () => {
            const {
                safe,
                signers: [user1],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, AddressZero], [user1])).to.revertedWith(
                "GS101",
            );
        });

        it("Invalid prevModule, module pair provided - Invalid target", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, user1.address], [user1])).to.revertedWith(
                "GS103",
            );
        });

        it("Invalid prevModule, module pair provided - Invalid sentinel", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [AddressZero, user2.address], [user1]),
            ).to.revertedWith("GS103");
        });

        it("Invalid prevModule, module pair provided - Invalid source", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(
                executeContractCallWithSigners(safe, safe, "disableModule", [user1.address, user2.address], [user1]),
            ).to.revertedWith("GS103");
        });

        it("emits event for disabled module", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);
            await expect(await safe.isModuleEnabled(user1.address)).to.be.true;
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address, user1.address], AddressOne]);

            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [user2.address, user1.address], [user1]))
                .to.emit(safe, "DisabledModule")
                .withArgs(user1.address);
            await expect(await safe.isModuleEnabled(user1.address)).to.be.false;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[user2.address], AddressOne]);

            await expect(executeContractCallWithSigners(safe, safe, "disableModule", [AddressOne, user2.address], [user1]))
                .to.emit(safe, "DisabledModule")
                .withArgs(user2.address);
            await expect(await safe.isModuleEnabled(user2.address)).to.be.false;
            await expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[], AddressOne]);
        });
    });

    describe("execTransactionFromModule", () => {
        it("can not be called from sentinel", async () => {
            const { safe, mock } = await setupTests();
            const mockAddress = await mock.getAddress();
            const readOnlySafe = safe.connect(hre.ethers.provider);
            await expect(
                readOnlySafe.execTransactionFromModule.staticCall(mockAddress, 0, "0xbaddad", 0, { from: AddressOne }),
            ).to.be.revertedWith("GS104");
        });

        it("can only be called from enabled module", async () => {
            const {
                safe,
                mock,
                signers: [, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await expect(user2Safe.execTransactionFromModule(mockAddress, 0, "0xbaddad", 0)).to.be.revertedWith("GS104");
        });

        it("emits event on execution success", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(user2Safe.execTransactionFromModule(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleSuccess")
                .withArgs(user2.address);
            expect(await mock.invocationCountForCalldata.staticCall("0xbaddad")).to.equal(1n);
        });

        it("emits event on execution failure", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenAnyRevert();
            await expect(user2Safe.execTransactionFromModule(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleFailure")
                .withArgs(user2.address);
        });

        it("reverts if the pre hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user1.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkModuleTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModule(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("reverts if the post hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();

            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const guardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkAfterModuleExecutionTxData = guardInterface.encodeFunctionData("checkAfterModuleExecution", [
                `0x${"0".repeat(64)}`,
                true,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkAfterModuleExecutionTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModule(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("preserves the hash returned by checkModuleTransaction and passes it to checkAfterModuleExecution", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [[validModuleGuardMockAddress]], [user1]);

            const hash = ethers.hexlify(ethers.randomBytes(32));

            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            const checkAfterModuleExecutionTxData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [hash, true]);
            await validModuleGuardMock.givenCalldataReturnBytes32(checkModuleTxData, hash);

            await safe.connect(user2).execTransactionFromModule(user2.address, 0, "0xbeef73", 1);

            expect(await validModuleGuardMock.invocationCountForCalldata(checkAfterModuleExecutionTxData)).to.equal(1);
        });
    });

    describe("execTransactionFromModuleReturnData", () => {
        it("can not be called from sentinel", async () => {
            const { safe, mock } = await setupTests();
            const mockAddress = await mock.getAddress();
            const readOnlySafe = safe.connect(hre.ethers.provider);
            await expect(
                readOnlySafe.execTransactionFromModuleReturnData.staticCall(mockAddress, 0, "0xbaddad", 0, { from: AddressOne }),
            ).to.be.revertedWith("GS104");
        });

        it("can only be called from enabled module", async () => {
            const {
                safe,
                mock,
                signers: [, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await expect(user2Safe.execTransactionFromModuleReturnData(mockAddress, 0, "0xbaddad", 0)).to.be.revertedWith("GS104");
        });

        it("emits event on execution failure", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenAnyRevert();
            await expect(user2Safe.execTransactionFromModuleReturnData(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleFailure")
                .withArgs(user2.address);
        });

        it("emits event on execution success", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await expect(user2Safe.execTransactionFromModuleReturnData(mockAddress, 0, "0xbaddad", 0))
                .to.emit(safe, "ExecutionFromModuleSuccess")
                .withArgs(user2.address);
            expect(await mock.invocationCountForCalldata.staticCall("0xbaddad")).to.equal(1n);
        });

        it("Returns expected from contract on success", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenCalldataReturn("0xbaddad", "0xdeaddeed");
            await expect(await user2Safe.execTransactionFromModuleReturnData.staticCall(mockAddress, 0, "0xbaddad", 0)).to.be.deep.eq([
                true,
                "0xdeaddeed",
            ]);
        });

        it("Returns expected from contract on failure", async () => {
            const {
                safe,
                mock,
                signers: [user1, user2],
            } = await setupTests();
            const mockAddress = await mock.getAddress();
            const user2Safe = safe.connect(user2);
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            await mock.givenCalldataRevertWithMessage("0xbaddad", "Some random message");
            await expect(await user2Safe.execTransactionFromModuleReturnData.staticCall(mockAddress, 0, "0xbaddad", 0)).to.be.deep.eq([
                false,
                "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d652072616e646f6d206d65737361676500000000000000000000000000",
            ]);
        });

        it("correctly returns the return data if the module guard allows the transaction", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            // Enabling the Module.
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            // Creating a MockContract and creating dummy calldata and return values.
            const mock = await getMock();
            const mockAddress = await mock.getAddress();
            const callData = "0xbeef73";
            const returnBytes = "0xdeaddeed";
            await mock.givenCalldataReturn(callData, returnBytes);

            // Getting the Module Guard Address and Interface.
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;

            // Creating the calldata for the Guard before & after Module TX Execution.
            const checkModuleTxDataByGuard = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                callData,
                0,
                user2.address,
            ]);
            await validModuleGuardMock.givenCalldataReturnBytes32(checkModuleTxDataByGuard, ethers.ZeroHash);
            const checkAfterModuleExecutionTxDataByGuard = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [
                ethers.ZeroHash,
                true,
            ]);
            await validModuleGuardMock.givenCalldataReturn(checkAfterModuleExecutionTxDataByGuard, "0x1337");

            await expect(
                await safe.connect(user2).execTransactionFromModuleReturnData.staticCall(mockAddress, 0, callData, 0),
            ).to.be.deep.eq([true, returnBytes]);
        });

        it("reverts if the pre hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkModuleTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModuleReturnData(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("reverts if the post hook of the module guard reverts", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkAfterModuleExecutionTxData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [
                `0x${"0".repeat(64)}`,
                true,
            ]);

            await validModuleGuardMock.givenCalldataRevertWithMessage(checkAfterModuleExecutionTxData, "Computer says Nah");

            await expect(safe.execTransactionFromModuleReturnData(user2.address, 0, "0xbeef73", 1)).to.be.reverted;
        });

        it("preserves the hash returned by checkModuleTransaction and passes it to checkAfterModuleExecution", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1, user2],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [[validModuleGuardMockAddress]], [user1]);

            const hash = ethers.hexlify(ethers.randomBytes(32));

            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkModuleTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [
                user2.address,
                0,
                "0xbeef73",
                1,
                user2.address,
            ]);

            const checkAfterModuleExecutionTxData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [hash, true]);
            await validModuleGuardMock.givenCalldataReturnBytes32(checkModuleTxData, hash);

            await safe.connect(user2).execTransactionFromModuleReturnData(user2.address, 0, "0xbeef73", 1);

            expect(await validModuleGuardMock.invocationCountForCalldata(checkAfterModuleExecutionTxData)).to.equal(1);
        });
    });

    describe("getModulesPaginated", () => {
        it("requires page size to be greater than 0", async () => {
            const { safe } = await setupTests();
            await expect(safe.getModulesPaginated(AddressOne, 0)).to.be.revertedWith("GS106");
        });

        it("requires start to be a module or start pointer", async () => {
            const {
                safe,
                signers: [user1, user2],
            } = await setupTests();

            await expect(safe.getModulesPaginated(AddressZero, 1)).to.be.reverted;
            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);
            expect(await safe.getModulesPaginated(user1.address, 1)).to.be.deep.equal([[], AddressOne]);
            await expect(safe.getModulesPaginated(user2.address, 1)).to.be.revertedWith("GS105");
        });

        it("Returns all modules over multiple pages", async () => {
            const {
                safe,
                signers: [user1, user2, user3],
            } = await setupTests();
            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user1.address);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user2.address);

            await expect(executeContractCallWithSigners(safe, safe, "enableModule", [user3.address], [user1]))
                .to.emit(safe, "EnabledModule")
                .withArgs(user3.address);

            await expect(await safe.isModuleEnabled(user1.address)).to.be.true;
            await expect(await safe.isModuleEnabled(user2.address)).to.be.true;
            await expect(await safe.isModuleEnabled(user3.address)).to.be.true;
            /*
            This will pass the test which is not correct
            await expect(await safe.getModulesPaginated(AddressOne, 1)).to.be.deep.equal([[user3.address], user2.address])
            await expect(await safe.getModulesPaginated(user2.address, 1)).to.be.deep.equal([[user1.address], AddressOne])
            */
            await expect(await safe.getModulesPaginated(AddressOne, 1)).to.be.deep.equal([[user3.address], user3.address]);
            await expect(await safe.getModulesPaginated(user3.address, 1)).to.be.deep.equal([[user2.address], user2.address]);
            await expect(await safe.getModulesPaginated(user2.address, 1)).to.be.deep.equal([[user1.address], AddressOne]);
        });

        it("returns an empty array and end pointer for a safe with no modules", async () => {
            const { safe } = await setupTests();
            expect(await safe.getModulesPaginated(AddressOne, 10)).to.be.deep.equal([[], AddressOne]);
        });
    });

    describe("setModuleGuards", () => {
        it("reverts if the module guard does not implement the ERC165 Module Guard Interface", async () => {
            const {
                signers: [user1, user2],
            } = await setupTests();
            const safe = await getSafe({ owners: [user1.address] });

            await expect(
                executeContractCallWithSigners(safe, safe, "setModuleGuards", [[user2.address]], [user1]),
            ).to.be.revertedWithoutReason();
        });

        it("emits an event when the module guard is changed", async () => {
            const {
                validModuleGuardMock,
                signers: [user1],
            } = await setupTests();
            const validGuardMockAddress = await validModuleGuardMock.getAddress();
            const safe = await getSafe({ owners: [user1.address] });

            await expect(executeContractCallWithSigners(safe, safe, "setModuleGuards", [[validGuardMockAddress]], [user1]))
                .to.emit(safe, "ChangedModuleGuards")
                .withArgs([validGuardMockAddress]);

            await expect(executeContractCallWithSigners(safe, safe, "setModuleGuards", [[]], [user1]))
                .to.emit(safe, "ChangedModuleGuards")
                .withArgs([]);
        });

        it("is not called when setting initially", async () => {
            const {
                validModuleGuardMock,
                signers: [user1],
            } = await setupTests();

            const invocationCountBefore = await validModuleGuardMock.invocationCount();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            const safe = await getSafe({ owners: [user1.address] });

            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [[validModuleGuardMockAddress]], [user1]);

            // Check guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), MODULE_GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validModuleGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            // Guard should not be called, as it was not set before the transaction execution
            expect(await validModuleGuardMock.invocationCount()).to.be.eq(invocationCountBefore);
        });

        it("is called when removed", async () => {
            const {
                safe,
                validModuleGuardMock,
                signers: [user1],
            } = await setupTests();
            const validModuleGuardMockAddress = await validModuleGuardMock.getAddress();
            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [[validModuleGuardMockAddress]], [user1]);

            // Check module guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), MODULE_GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + validModuleGuardMockAddress.toLowerCase().slice(2).padStart(64, "0"),
            );

            await executeContractCallWithSigners(safe, safe, "enableModule", [user1.address], [user1]);

            const data = safe.interface.encodeFunctionData("setModuleGuards", [[]]);

            const moduleGuardInterface = (await hre.ethers.getContractAt("IModuleGuard", validModuleGuardMockAddress)).interface;
            const checkTxData = moduleGuardInterface.encodeFunctionData("checkModuleTransaction", [safe.target, 0, data, 0, user1.address]);

            const guardHash = ethers.randomBytes(32);

            await validModuleGuardMock.givenCalldataReturnBytes32(checkTxData, guardHash);

            await expect(await safe.connect(user1).execTransactionFromModule(safe, 0, data, 0))
                .to.emit(safe, "ChangedModuleGuards")
                .withArgs([]);

            // Check module guard
            await expect(await hre.ethers.provider.getStorage(await safe.getAddress(), MODULE_GUARD_STORAGE_SLOT)).to.be.eq(
                "0x" + "".padStart(64, "0"),
            );

            expect(await validModuleGuardMock.invocationCountForCalldata.staticCall(checkTxData)).to.be.eq(1);
            // Module Guard should also be called for post exec check, even if it is removed with the Safe tx
            const checkExecData = moduleGuardInterface.encodeFunctionData("checkAfterModuleExecution", [guardHash, true]);

            expect(await validModuleGuardMock.invocationCountForCalldata.staticCall(checkExecData)).to.be.eq(1);
        });
    });

    describe("multiple module guards", () => {
        const setupWithModuleGuards = deployments.createFixture(async ({ deployments }) => {
            await deployments.fixture();
            const signers = await ethers.getSigners();
            const [user1, user2] = signers;
            const safe = await getSafe({ owners: [user1.address] });
            // user2 acts as the module.
            await executeContractCallWithSigners(safe, safe, "enableModule", [user2.address], [user1]);
            const guards = await deployTestGuards(MAX_GUARDS + 1);
            const guardAddresses = await Promise.all(guards.map((guard) => guard.getAddress()));
            return { safe, safeAddress: await safe.getAddress(), guards, guardAddresses, signers };
        });

        const moduleGuardMock = async (supported: boolean) => {
            const mock = await getMock();
            const guardInterface = (await hre.ethers.getContractAt("IModuleGuard", AddressZero)).interface;
            await mock.givenCalldataReturnBool(guardInterface.encodeFunctionData("supportsInterface", ["0x58401ed8"]), supported);
            return { mock, guardInterface };
        };

        // The hash a TestGuard returns from checkModuleTransaction.
        const testGuardHash = (guardAddress: string) => ethers.zeroPadValue(guardAddress, 32);

        it("can only be called from Safe itself", async () => {
            const { safe, guardAddresses } = await setupWithModuleGuards();

            await expect(safe.setModuleGuards([guardAddresses[0]])).to.be.revertedWith("GS031");
        });

        it("returns no module guards for a new Safe", async () => {
            const { safe } = await setupWithModuleGuards();

            expect(await safe.getModuleGuards()).to.deep.eq([]);
        });

        it("sets the module guards in order and emits an event", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithModuleGuards();
            const guards = guardAddresses.slice(0, 3);

            await expect(executeContractCallWithSigners(safe, safe, "setModuleGuards", [guards], [user1]))
                .to.emit(safe, "ChangedModuleGuards")
                .withArgs(guards);
            expect(await safe.getModuleGuards()).to.deep.eq(guards);
        });

        it("stores the first module guard with the number of other module guards, followed by the other module guards", async () => {
            const {
                safe,
                safeAddress,
                guardAddresses,
                signers: [user1],
            } = await setupWithModuleGuards();

            for (const count of [1, 2, MAX_GUARDS]) {
                const guards = guardAddresses.slice(0, count);
                await executeContractCallWithSigners(safe, safe, "setModuleGuards", [guards], [user1]);
                expect(await readStorage(safeAddress, MODULE_GUARD_STORAGE_SLOT, count)).to.deep.eq(guardListStorage(guards));
            }
        });

        it("replaces all module guards, and removes all module guards with an empty array", async () => {
            const {
                safe,
                safeAddress,
                guardAddresses,
                signers: [user1],
            } = await setupWithModuleGuards();
            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [guardAddresses.slice(0, 3)], [user1]);

            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [[guardAddresses[3]]], [user1]);
            expect(await safe.getModuleGuards()).to.deep.eq([guardAddresses[3]]);

            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [[]], [user1]);
            expect(await safe.getModuleGuards()).to.deep.eq([]);
            expect(await hre.ethers.provider.getStorage(safeAddress, MODULE_GUARD_STORAGE_SLOT)).to.eq(ethers.ZeroHash);
        });

        it("reverts for the zero address", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithModuleGuards();

            await expect(
                executeContractCallWithSigners(safe, safe, "setModuleGuards", [[guardAddresses[0], AddressZero]], [user1]),
            ).to.be.revertedWith("GS301");
        });

        it("reverts if a module guard does not support the Module Guard interface", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithModuleGuards();
            const { mock } = await moduleGuardMock(false);

            await expect(
                executeContractCallWithSigners(safe, safe, "setModuleGuards", [[guardAddresses[0], await mock.getAddress()]], [user1]),
            ).to.be.revertedWith("GS301");
        });

        it("reverts if a module guard is listed twice", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithModuleGuards();
            const guards = [guardAddresses[0], guardAddresses[1], guardAddresses[1]];

            await expect(executeContractCallWithSigners(safe, safe, "setModuleGuards", [guards], [user1])).to.be.revertedWith("GS302");
        });

        it("reverts for more than 8 module guards", async () => {
            const {
                safe,
                guardAddresses,
                signers: [user1],
            } = await setupWithModuleGuards();

            await expect(executeContractCallWithSigners(safe, safe, "setModuleGuards", [guardAddresses], [user1])).to.be.revertedWith(
                "GS303",
            );
        });

        it("keeps a module guard set by Safe v1.5.0", async () => {
            const {
                safe,
                safeAddress,
                guards,
                guardAddresses,
                signers: [, user2],
            } = await setupWithModuleGuards();
            await hre.network.provider.send("hardhat_setStorageAt", [
                safeAddress,
                MODULE_GUARD_STORAGE_SLOT,
                ethers.zeroPadValue(guardAddresses[0], 32),
            ]);

            expect(await safe.getModuleGuards()).to.deep.eq([guardAddresses[0]]);
            const tx = safe.connect(user2).execTransactionFromModule(user2.address, 0, "0x", 0);
            expect(await guardChecks(tx, guards)).to.deep.eq(["0:CheckModuleTransaction", "0:CheckAfterModuleExecution"]);
        });

        for (const method of ["execTransactionFromModule", "execTransactionFromModuleReturnData"] as const) {
            it(`${method} runs the checks in order and in reverse order, passing each module guard its own hash`, async () => {
                const {
                    safe,
                    guards,
                    guardAddresses,
                    signers: [user1, user2],
                } = await setupWithModuleGuards();
                await executeContractCallWithSigners(safe, safe, "setModuleGuards", [guardAddresses.slice(0, MAX_GUARDS)], [user1]);

                const tx = safe.connect(user2)[method](user2.address, 0, "0xbeef73", 0);
                const indices = [...Array(MAX_GUARDS).keys()];
                expect(await guardChecks(tx, guards)).to.deep.eq([
                    ...indices.map((i) => `${i}:CheckModuleTransaction`),
                    ...[...indices].reverse().map((i) => `${i}:CheckAfterModuleExecution`),
                ]);
                for (const i of indices) {
                    await expect(tx).to.emit(guards[i], "CheckAfterModuleExecution").withArgs(testGuardHash(guardAddresses[i]), true);
                }
            });
        }

        it("runs the post-execution checks of the module guards read before execution", async () => {
            const {
                safe,
                safeAddress,
                guards,
                guardAddresses,
                signers: [user1, user2],
            } = await setupWithModuleGuards();
            await executeContractCallWithSigners(safe, safe, "setModuleGuards", [guardAddresses.slice(0, 2)], [user1]);

            // A module transaction replacing module guards 0 and 1 with module guards 2 and 3 runs the post-execution checks of 0 and 1 only.
            const data = safe.interface.encodeFunctionData("setModuleGuards", [guardAddresses.slice(2, 4)]);
            const tx = safe.connect(user2).execTransactionFromModule(safeAddress, 0, data, 0);
            expect(await guardChecks(tx, guards)).to.deep.eq([
                "0:CheckModuleTransaction",
                "1:CheckModuleTransaction",
                "1:CheckAfterModuleExecution",
                "0:CheckAfterModuleExecution",
            ]);
            expect(await safe.getModuleGuards()).to.deep.eq(guardAddresses.slice(2, 4));
        });

        for (const check of ["checkModuleTransaction", "checkAfterModuleExecution"] as const) {
            it(`reverts if the ${check} of any module guard reverts`, async () => {
                const {
                    safe,
                    guardAddresses,
                    signers: [user1, user2],
                } = await setupWithModuleGuards();
                const { mock, guardInterface } = await moduleGuardMock(true);
                const guards = [guardAddresses[0], await mock.getAddress(), guardAddresses[1]];
                await executeContractCallWithSigners(safe, safe, "setModuleGuards", [guards], [user1]);
                await mock.givenMethodRevertWithMessage(guardInterface.getFunction(check).selector, "Computer says Nah");

                await expect(safe.connect(user2).execTransactionFromModule(user2.address, 0, "0xbeef73", 0)).to.be.revertedWith(
                    "Computer says Nah",
                );
            });
        }
    });
});
