import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import { deployViaSafeSingletonFactory } from "../helpers/safeSingletonFactory";

const LibrariesModule = buildModule("Libraries", (m) => {
    const createCall = m.contract("CreateCall", [], {
        id: "CreateCall",
    });

    const multiSend = m.contract("MultiSend", [], {
        id: "MultiSend",
    });

    const multiSendCallOnly = m.contract("MultiSendCallOnly", [], {
        id: "MultiSendCallOnly",
    });

    const signMessageLib = m.contract("SignMessageLib", [], {
        id: "SignMessageLib",
    });

    const safeToL2Setup = m.contract("SafeToL2Setup", [], {
        id: "SafeToL2Setup",
    });

    return {
        createCall,
        multiSend,
        multiSendCallOnly,
        signMessageLib,
        safeToL2Setup,
    };
});

export default LibrariesModule;

/**
 * Deploy all libraries via Safe Singleton Factory (for use outside of Ignition)
 */
export async function deployLibraries() {
    const createCall = await deployViaSafeSingletonFactory(hre, "CreateCall", []);
    const multiSend = await deployViaSafeSingletonFactory(hre, "MultiSend", []);
    const multiSendCallOnly = await deployViaSafeSingletonFactory(hre, "MultiSendCallOnly", []);
    const signMessageLib = await deployViaSafeSingletonFactory(hre, "SignMessageLib", []);
    const safeToL2Setup = await deployViaSafeSingletonFactory(hre, "SafeToL2Setup", []);

    return {
        createCall,
        multiSend,
        multiSendCallOnly,
        signMessageLib,
        safeToL2Setup,
    };
}
