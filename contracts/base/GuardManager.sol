// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

import {GuardList} from "./../common/GuardList.sol";
import {SelfAuthorized} from "./../common/SelfAuthorized.sol";
import {IERC165} from "./../interfaces/IERC165.sol";
import {IGuardManager} from "./../interfaces/IGuardManager.sol";
import {Enum} from "./../interfaces/Enum.sol";
import {GUARD_STORAGE_SLOT} from "../libraries/SafeStorage.sol";

/**
 * @title ITransactionGuard Interface
 */
interface ITransactionGuard is IERC165 {
    /**
     * @notice Checks the transaction details.
     * @dev The function needs to implement transaction validation logic.
     * @param to The address to which the transaction is intended.
     * @param value The native token value of the transaction in Wei.
     * @param data The transaction data.
     * @param operation Operation type (0 for `CALL`, 1 for `DELEGATECALL`).
     * @param safeTxGas Gas used for the transaction.
     * @param baseGas The base gas for the transaction.
     * @param gasPrice The price of gas in Wei for the transaction.
     * @param gasToken The token used to pay for gas.
     * @param refundReceiver The address which should receive the refund.
     * @param signatures The signatures of the transaction.
     * @param msgSender The address of the message sender.
     */
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external;

    /**
     * @notice Checks after execution of the transaction.
     * @dev The function needs to implement a check after the execution of the transaction.
     * @param hash The hash of the executed transaction.
     * @param success The status of the transaction execution.
     */
    function checkAfterExecution(bytes32 hash, bool success) external;
}

/**
 * @title Base Transaction Guard
 */
abstract contract BaseTransactionGuard is ITransactionGuard {
    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {
        return
            interfaceId == type(ITransactionGuard).interfaceId || // 0xe6d7a83a
            interfaceId == type(IERC165).interfaceId; // 0x01ffc9a7
    }
}

/**
 * @title Guard Manager
 * @notice A contract managing transaction guards which perform pre- and post-checks on Safe transactions.
 * @author Richard Meissner - @rmeissner
 */
abstract contract GuardManager is SelfAuthorized, GuardList, IGuardManager {
    /**
     * @inheritdoc IGuardManager
     */
    function setGuards(address[] calldata guards) external override authorized {
        writeGuards(GUARD_STORAGE_SLOT, guards, type(ITransactionGuard).interfaceId, "GS300");
        emit ChangedGuards(guards);
    }

    /**
     * @inheritdoc IGuardManager
     */
    function getGuards() public view override returns (address[] memory guards) {
        return readGuards(GUARD_STORAGE_SLOT);
    }

    /**
     * @notice Runs pre-execution checks for Safe transactions with every enabled guard, in order.
     * @param to Destination address of Safe transaction.
     * @param value Native token value of Safe transaction.
     * @param data Data payload of Safe transaction.
     * @param operation Operation type of Safe transaction.
     * @param safeTxGas Gas that should be used for the Safe transaction.
     * @param baseGas Gas costs that are independent of the transaction execution.
     * @param gasPrice Gas price that should be used for the payment calculation.
     * @param gasToken Token address (or 0 if native token) that is used for the payment.
     * @param refundReceiver Address of receiver of gas payment (or 0 if `tx.origin`).
     * @param signatures Signature data that should be verified.
     * @return guards Guards to be used for the post-execution checks. Reading them once means that a guard
     *         disabled by the transaction still runs its post-execution check, and a guard enabled by it runs none.
     */
    function preExecutionChecks(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) internal returns (address[] memory guards) {
        guards = getGuards();
        for (uint256 i = 0; i < guards.length; ++i) {
            ITransactionGuard(guards[i]).checkTransaction(
                // Transaction info:
                to,
                value,
                data,
                operation,
                safeTxGas,
                // Payment info:
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                // Signature info:
                signatures,
                msg.sender
            );
        }
    }

    /**
     * @notice Runs post-execution checks for Safe transactions with the guards of the pre-execution checks, in reverse order.
     * @param guards Guards returned by {preExecutionChecks}.
     * @param txHash Hash of the Safe transaction.
     * @param success Boolean flag indicating if the call succeeded.
     */
    function postExecutionChecks(address[] memory guards, bytes32 txHash, bool success) internal {
        for (uint256 i = guards.length; i > 0; --i) {
            ITransactionGuard(guards[i - 1]).checkAfterExecution(txHash, success);
        }
    }
}
