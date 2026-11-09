// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {BaseGuard} from "../examples/guards/BaseGuard.sol";
import {Enum} from "../interfaces/Enum.sol";

/**
 * @title Test Guard
 * @notice A transaction and module guard that logs every check, to test which guards a Safe runs and in which order.
 */
contract TestGuard is BaseGuard {
    event CheckTransaction();
    event CheckAfterExecution(bytes32 txHash, bool success);
    event CheckModuleTransaction(bytes32 moduleTxHash);
    event CheckAfterModuleExecution(bytes32 moduleTxHash, bool success);

    function checkTransaction(
        address,
        uint256,
        bytes memory,
        Enum.Operation,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes memory,
        address
    ) external override {
        emit CheckTransaction();
    }

    function checkAfterExecution(bytes32 txHash, bool success) external override {
        emit CheckAfterExecution(txHash, success);
    }

    /**
     * @dev Returns a hash unique to this guard, to test that every guard gets its own hash back.
     */
    function checkModuleTransaction(
        address,
        uint256,
        bytes memory,
        Enum.Operation,
        address
    ) external override returns (bytes32 moduleTxHash) {
        moduleTxHash = bytes32(uint256(uint160(address(this))));
        emit CheckModuleTransaction(moduleTxHash);
    }

    function checkAfterModuleExecution(bytes32 moduleTxHash, bool success) external override {
        emit CheckAfterModuleExecution(moduleTxHash, success);
    }
}
