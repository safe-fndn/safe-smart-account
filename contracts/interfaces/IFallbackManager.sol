// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title Fallback Manager Interface
 * @notice Interface for managing fallback calls made to this contract.
 * @author @safe-global/safe-protocol
 */
interface IFallbackManager {
    /**
     * @notice The fallback handler has changed.
     * @param handler The address of the new fallback handler.
     */
    event ChangedFallbackHandler(address indexed handler);

    /**
     * @notice Set Fallback Handler to `handler` for the Safe.
     * @dev 1. Only fallback calls without value and with data will be forwarded.
     *      2. Changing the fallback handler can only be done via a Safe transaction.
     *      3. Cannot be set to the Safe itself.
     *      4. ⚠️⚠️⚠️ IMPORTANT! SECURITY RISK! The fallback handler can be set to any address and all the calls will be forwarded to it,
     *         bypassing all the Safe's access control mechanisms. When setting the fallback handler, make sure to check the address
     *         is a trusted contract and if it supports state changes, it implements the necessary checks. ⚠️⚠️⚠️
     * @param handler contract to handle fallback calls.
     */
    function setFallbackHandler(address handler) external;

    /**
     * @notice Forwards all calls to the fallback handler if set.
     *         Returns empty data if no handler is set.
     * @dev The call to the handler is made via the `CALL` opcode (not `DELEGATECALL`), so:
     *      - In the handler's call frame, `msg.sender` is the Safe's own address, not the original external caller.
     *      - The handler executes in its own storage context; it cannot read or write Safe storage directly.
     *      - `CALL` is used intentionally to limit the attack surface: `DELEGATECALL` would execute handler code
     *        in the Safe's storage context, giving the handler unrestricted write access to all Safe state.
     *
     *      ⚠️ IMPORTANT SECURITY NOTE: Because `msg.sender` equals the Safe address inside the handler, the
     *      handler can take actions on behalf of the Safe in other contracts. For example, if the fallback
     *      handler is set to a token contract, any external caller can trigger token operations
     *      (e.g. `transfer`, `approve`) on behalf of the Safe. Only set trusted, purpose-built contracts as
     *      fallback handlers and verify they do not expose state-changing functions that rely solely on
     *      `msg.sender` for authorisation.
     *
     *      The original caller address is appended (non-padded) to the calldata before forwarding.
     *      The handler can use {HandlerContext._msgSender()} to recover it. This pattern is based on ERC-2771.
     */
    fallback() external;
}
