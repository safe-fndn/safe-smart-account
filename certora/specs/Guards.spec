/* A specification of the safe guard and module guard */

using ModuleGuardMock as modGuardMock;
using ModuleGuardMockDuplicate as modGuardMock2;
using TxnGuardMock as txnGuardMock;
using TxnGuardMockDuplicate as txnGuardMock2;
using SafeHarness as safe;

// ---- Methods block ----------------------------------------------------------
methods {
    function getModuleGuardExternal() external returns (address) envfree;
    function getModuleGuardCount() external returns (uint256) envfree;
    function getSafeGuard() external returns (address) envfree;
    function getSafeGuardCount() external returns (uint256) envfree;
    
    function txnGuardMock.preCheckedTransactions() external returns (bool) envfree;
    function txnGuardMock.postCheckedTransactions() external returns (bool) envfree;
    function modGuardMock.preCheckedTransactions() external returns (bool) envfree;
    function modGuardMock.postCheckedTransactions() external returns (bool) envfree;

    function _.checkModuleTransaction(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        address module
    ) external => DISPATCHER(true) ;

    function _.checkAfterModuleExecution(bytes32 txHash, bool success) external
        => DISPATCHER(true) ;

    function _.checkTransaction(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes signatures,
        address msgSender
    ) external => DISPATCHER(true) ;

    function _.checkAfterExecution(bytes32 hash, bool success) external 
        => DISPATCHER(true);

    function Executor.execute(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 txGas
    ) internal returns (bool) => NONDET;

    function SecuredTokenTransfer.transferToken(address token, address receiver, uint256 amount) internal returns (bool) => NONDET ;
    function Safe.handlePayment(
        uint256 gasUsed,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver
    ) internal returns (uint256) => NONDET ;

}

// ---- Functions and ghosts ---------------------------------------------------


// ---- Invariants -------------------------------------------------------------


// ---- Rules ------------------------------------------------------------------

/// @dev the only method that can change the guards is setGuards
rule guardAddressChange(method f) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector &&
         f.selector != sig:getStorageAt(uint256,uint256).selector
} {
    address guardBefore = getSafeGuard();
    uint256 countBefore = getSafeGuardCount();

    calldataarg args; env e;
    f(e, args);

    address guardAfter = getSafeGuard();
    uint256 countAfter = getSafeGuardCount();

    assert guardBefore != guardAfter || countBefore != countAfter =>
        f.selector == sig:setGuards(address[]).selector;
}

/// @dev the only method that can change the module guards is setModuleGuards
rule moduleGuardAddressChange(method f) filtered {
    f -> f.selector != sig:simulateAndRevert(address,bytes).selector &&
         f.selector != sig:getStorageAt(uint256,uint256).selector
} {
    address guardBefore = getModuleGuardExternal();
    uint256 countBefore = getModuleGuardCount();
    
    calldataarg args; env e;
    f(e,args);
    
    address guardAfter = getModuleGuardExternal();
    uint256 countAfter = getModuleGuardCount();

    assert guardBefore != guardAfter || countBefore != countAfter => 
        f.selector == sig:setModuleGuards(address[]).selector;
}

/// @dev set-get correspondence for (regular) guards
rule setGetCorrespondenceGuard(address[] guards) {
    env e;
    setGuards(e,guards);
    assert getSafeGuardCount() == guards.length;
    assert guards.length > 0 => getSafeGuard() == guards[0];
}

/// @dev set-get correspondence for module guards
rule setGetCorrespondenceModuleGuard(address[] guards) {
    env e;
    setModuleGuards(e,guards);
    assert getModuleGuardCount() == guards.length;
    assert guards.length > 0 => getModuleGuardExternal() == guards[0];
}

/// @dev setGuards can only be called by contract itself.
rule setGuardReentrant(address[] guards) {
    env e;
    setGuards(e,guards); // a successful call to setGuards
    assert (e.msg.sender == safe);
}

/// @dev setModuleGuards can only be called by contract itself.
rule setModuleGuardReentrant(address[] guards) {
    env e;
    setModuleGuards(e,guards);
    assert(e.msg.sender == safe);
}


/// @dev the transaction guard gets called both pre- and post- any execTransaction
rule txnGuardCalled(
    address to,
    uint256 value,
    bytes data,
    Enum.Operation operation,
    uint256 safeTxGas,
    uint256 baseGas,
    uint256 gasPrice,
    address gasToken,
    address refundReceiver,
    bytes signatures
) {
    env e;
    // the txn guard is the mock, and the only one
    require (getSafeGuard() == txnGuardMock);
    require (getSafeGuardCount() == 1);

    txnGuardMock.resetChecks(e); // reset the check triggers
    txnGuardMock2.resetChecks(e);

    execTransaction(e,to,value,data,operation,safeTxGas,baseGas,
        gasPrice,gasToken,refundReceiver,signatures);
    
    // the pre- and post- module transaction guards were called
    assert (
        txnGuardMock.preCheckedTransactions() && 
        txnGuardMock.postCheckedTransactions() &&
        // the right guard was called
        !txnGuardMock2.preCheckedTransactions(e) && 
        !txnGuardMock2.postCheckedTransactions(e)
    );
}

/// @dev the module guard gets called both pre- and post- any execTransactionFromModule
rule moduleGuardCalled(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation) {
    env e;
    // the module guard is the mock, and the only one
    require (getModuleGuardExternal() == modGuardMock);
    require (getModuleGuardCount() == 1);
    
    modGuardMock.resetChecks(e); // reset the check triggers
    modGuardMock2.resetChecks(e);
    
    execTransactionFromModule(e,to,value,data,operation);

    // the pre- and post- module transaction guards were called
    assert (
        modGuardMock.preCheckedTransactions() && 
        modGuardMock.postCheckedTransactions() &&
        // the correct guard was called
        !modGuardMock2.preCheckedTransactions(e) && 
        !modGuardMock2.postCheckedTransactions(e)
    );
}

/// @dev the module guard gets called both pre- and post- any execTransactionFromModuleReturnData
rule moduleGuardCalledReturn(
        address to,
        uint256 value,
        bytes data,
        Enum.Operation operation) {
    env e;
    // the module guard is the mock, and the only one
    require (getModuleGuardExternal() == modGuardMock);
    require (getModuleGuardCount() == 1);
    
    modGuardMock.resetChecks(e); // reset the check triggers
    modGuardMock2.resetChecks(e);

    execTransactionFromModuleReturnData(e,to,value,data,operation);

    // the pre- and post- module transaction guards were called
    assert (
        modGuardMock.preCheckedTransactions() && 
        modGuardMock.postCheckedTransactions() &&
        // the correct guard was called
        !modGuardMock2.preCheckedTransactions(e) && 
        !modGuardMock2.postCheckedTransactions(e)
    );
}

