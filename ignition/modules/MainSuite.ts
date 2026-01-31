import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SafeSingletonModule from "./SafeSingleton";
import SafeL2Module from "./SafeL2";
import SafeProxyFactoryModule from "./SafeProxyFactory";
import HandlersModule from "./Handlers";
import AccessorsModule from "./Accessors";
import LibrariesModule from "./Libraries";

/**
 * MainSuite module - equivalent to the "main-suite" tag in hardhat-deploy
 *
 * Deploys:
 * - Safe (singleton)
 * - SafeL2
 * - SafeProxyFactory
 * - TokenCallbackHandler
 * - CompatibilityFallbackHandler
 * - ExtensibleFallbackHandler
 * - SimulateTxAccessor
 * - CreateCall
 * - MultiSend
 * - MultiSendCallOnly
 * - SignMessageLib
 * - SafeToL2Setup
 */
const MainSuiteModule = buildModule("MainSuite", (m) => {
    const { safe } = m.useModule(SafeSingletonModule);
    const { safeL2 } = m.useModule(SafeL2Module);
    const { safeProxyFactory } = m.useModule(SafeProxyFactoryModule);
    const { tokenCallbackHandler, compatibilityFallbackHandler, extensibleFallbackHandler } = m.useModule(HandlersModule);
    const { simulateTxAccessor } = m.useModule(AccessorsModule);
    const { createCall, multiSend, multiSendCallOnly, signMessageLib, safeToL2Setup } = m.useModule(LibrariesModule);

    return {
        safe,
        safeL2,
        safeProxyFactory,
        tokenCallbackHandler,
        compatibilityFallbackHandler,
        extensibleFallbackHandler,
        simulateTxAccessor,
        createCall,
        multiSend,
        multiSendCallOnly,
        signMessageLib,
        safeToL2Setup,
    };
});

export default MainSuiteModule;
