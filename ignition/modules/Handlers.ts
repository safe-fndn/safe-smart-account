import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import { deployViaSafeSingletonFactory } from "../helpers/safeSingletonFactory";

const HandlersModule = buildModule("Handlers", (m) => {
    const tokenCallbackHandler = m.contract("TokenCallbackHandler", [], {
        id: "TokenCallbackHandler",
    });

    const compatibilityFallbackHandler = m.contract("CompatibilityFallbackHandler", [], {
        id: "CompatibilityFallbackHandler",
    });

    const extensibleFallbackHandler = m.contract("ExtensibleFallbackHandler", [], {
        id: "ExtensibleFallbackHandler",
    });

    return {
        tokenCallbackHandler,
        compatibilityFallbackHandler,
        extensibleFallbackHandler,
    };
});

export default HandlersModule;

/**
 * Deploy all handlers via Safe Singleton Factory (for use outside of Ignition)
 */
export async function deployHandlers() {
    const tokenCallbackHandler = await deployViaSafeSingletonFactory(hre, "TokenCallbackHandler", []);
    const compatibilityFallbackHandler = await deployViaSafeSingletonFactory(hre, "CompatibilityFallbackHandler", []);
    const extensibleFallbackHandler = await deployViaSafeSingletonFactory(hre, "ExtensibleFallbackHandler", []);

    return {
        tokenCallbackHandler,
        compatibilityFallbackHandler,
        extensibleFallbackHandler,
    };
}
