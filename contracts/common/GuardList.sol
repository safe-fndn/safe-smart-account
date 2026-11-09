// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ErrorMessage} from "./ErrorMessage.sol";
import {IERC165} from "./../interfaces/IERC165.sol";

/**
 * @title Guard List
 * @notice Storage for an ordered list of up to {MAX_GUARDS} guards.
 * @dev A list of `n` guards is stored from a base slot: the base slot packs the first guard (lower 160 bits) with
 *      `n - 1` (upper 96 bits), and the other guards follow in the next `n - 1` slots. An empty list is a zero base
 *      slot. The base slots are the guard slots of Safe v1.5.0, which holds its guard as a clean address, so that a
 *      Safe upgrading from v1.5.0 keeps its guard, as a list of one.
 */
abstract contract GuardList is ErrorMessage {
    /**
     * @dev The maximum number of guards in a list. It bounds the storage reads and guard calls of every transaction.
     */
    uint256 internal constant MAX_GUARDS = 8;

    /**
     * @dev Returns the guards of the list at `slot`, in order.
     */
    function readGuards(bytes32 slot) internal view returns (address[] memory guards) {
        uint256 head = load(slot, 0);
        if (head == 0) return guards;
        guards = new address[]((head >> 160) + 1);
        guards[0] = address(uint160(head));
        for (uint256 i = 1; i < guards.length; ++i) {
            guards[i] = address(uint160(load(slot, i)));
        }
    }

    /**
     * @dev Replaces the list at `slot` with `guards`. Reverts with `invalidGuardError` if a guard is the zero address or
     *      reports no support for the ERC-165 interface `interfaceId` (a guard without code reverts without data), and
     *      reverts if a guard is listed twice or if there are too many guards.
     *      Slots past the end of the new list keep their values: they are never read.
     */
    function writeGuards(bytes32 slot, address[] calldata guards, bytes4 interfaceId, bytes5 invalidGuardError) internal {
        uint256 count = guards.length;
        if (count > MAX_GUARDS) revertWithError("GS303");
        uint256 head = 0;
        for (uint256 i = 0; i < count; ++i) {
            address guard = guards[i];
            if (guard == address(0) || !IERC165(guard).supportsInterface(interfaceId)) revertWithError(invalidGuardError);
            for (uint256 j = 0; j < i; ++j) {
                if (guards[j] == guard) revertWithError("GS302");
            }
            if (i == 0) head = uint256(uint160(guard)) | ((count - 1) << 160);
            else store(slot, i, uint256(uint160(guard)));
        }
        store(slot, 0, head);
    }

    /**
     * @dev Loads the word at `index` slots after `slot`.
     */
    function load(bytes32 slot, uint256 index) private view returns (uint256 value) {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            value := sload(add(slot, index))
        }
        /* solhint-enable no-inline-assembly */
    }

    /**
     * @dev Stores `value` at `index` slots after `slot`.
     */
    function store(bytes32 slot, uint256 index, uint256 value) private {
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            sstore(add(slot, index), value)
        }
        /* solhint-enable no-inline-assembly */
    }
}
