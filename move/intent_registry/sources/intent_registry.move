/// Intent Registry - Stores and manages encrypted trading intents
/// 
/// This module provides:
/// - Storage of Seal-encrypted trading intents
/// - Lifecycle management (create, cancel, execute)
/// - Event emission for indexing
/// - Authorization for enclave execution
module intent_registry::intent_registry {
    use sui::event;
    use sui::clock::Clock;

    // ============== Constants ==============
    
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_EXECUTING: u8 = 1;
    const STATUS_EXECUTED: u8 = 2;
    const STATUS_CANCELLED: u8 = 3;
    const STATUS_EXPIRED: u8 = 4;
    const STATUS_FAILED: u8 = 5;

    const TRIGGER_PRICE_BELOW: u8 = 0;
    const TRIGGER_PRICE_ABOVE: u8 = 1;

    // ============== Error Codes ==============
    
    const ENotOwner: u64 = 0;
    const EInvalidStatus: u64 = 1;
    const EIntentExpired: u64 = 2;
    const EAlreadyExecuting: u64 = 3;
    const EInvalidSignature: u64 = 4;
    const EInvalidTriggerType: u64 = 5;

    // ============== Types ==============

    /// Registry for tracking all intents (shared object for stats)
    public struct IntentRegistry has key {
        id: UID,
        total_intents: u64,
        active_intents: u64,
        executed_intents: u64,
    }

    /// Individual trading intent (shared object)
    public struct Intent has key, store {
        id: UID,
        /// Owner of the intent (user who created it)
        owner: address,
        /// Seal-encrypted intent data (contains trading logic)
        encrypted_data: vector<u8>,
        /// Creation timestamp (milliseconds)
        created_at: u64,
        /// Expiry timestamp (milliseconds)
        expires_at: u64,
        /// Current status
        status: u8,
        /// Trigger type: 0=price_below, 1=price_above
        trigger_type: u8,
        /// Trigger value (fixed-point, 6 decimals)
        trigger_value: u64,
        /// Hash of trading pair (for filtering without decryption)
        pair_hash: vector<u8>,
        /// Execution timestamp (populated after execution)
        executed_at: Option<u64>,
        /// Actual execution price (populated after execution)
        executed_price: Option<u64>,
        /// Transaction digest (populated after execution)
        tx_digest: Option<vector<u8>>,
    }

    /// Capability for enclave to execute intents
    public struct EnclaveCap has key, store {
        id: UID,
        /// Enclave public key for signature verification
        enclave_pk: vector<u8>,
    }

    // ============== Events ==============

    public struct IntentCreated has copy, drop {
        intent_id: ID,
        owner: address,
        trigger_type: u8,
        trigger_value: u64,
        pair_hash: vector<u8>,
        expires_at: u64,
    }

    public struct IntentCancelled has copy, drop {
        intent_id: ID,
        cancelled_at: u64,
    }

    public struct IntentExecuting has copy, drop {
        intent_id: ID,
        timestamp: u64,
    }

    public struct IntentExecuted has copy, drop {
        intent_id: ID,
        executed_at: u64,
        executed_price: u64,
    }

    public struct IntentFailed has copy, drop {
        intent_id: ID,
        failed_at: u64,
        reason: vector<u8>,
    }

    // ============== Init ==============

    fun init(ctx: &mut TxContext) {
        let registry = IntentRegistry {
            id: object::new(ctx),
            total_intents: 0,
            active_intents: 0,
            executed_intents: 0,
        };
        transfer::share_object(registry);
    }

    // ============== User Functions ==============

    /// Create a new trading intent
    public entry fun create_intent(
        registry: &mut IntentRegistry,
        encrypted_data: vector<u8>,
        trigger_type: u8,
        trigger_value: u64,
        pair_hash: vector<u8>,
        expires_at: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock.timestamp_ms();
        assert!(expires_at > now, EIntentExpired);
        assert!(trigger_type <= TRIGGER_PRICE_ABOVE, EInvalidTriggerType);

        let intent = Intent {
            id: object::new(ctx),
            owner: ctx.sender(),
            encrypted_data,
            created_at: now,
            expires_at,
            status: STATUS_ACTIVE,
            trigger_type,
            trigger_value,
            pair_hash,
            executed_at: option::none(),
            executed_price: option::none(),
            tx_digest: option::none(),
        };

        let intent_id = object::id(&intent);

        // Update registry stats
        registry.total_intents = registry.total_intents + 1;
        registry.active_intents = registry.active_intents + 1;

        // Emit event
        event::emit(IntentCreated {
            intent_id,
            owner: ctx.sender(),
            trigger_type,
            trigger_value,
            pair_hash,
            expires_at,
        });

        // Share the intent object so enclave can access it
        transfer::share_object(intent);
    }

    /// Cancel an active intent (only owner can cancel)
    public entry fun cancel_intent(
        registry: &mut IntentRegistry,
        intent: &mut Intent,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == intent.owner, ENotOwner);
        assert!(intent.status == STATUS_ACTIVE, EInvalidStatus);

        intent.status = STATUS_CANCELLED;
        registry.active_intents = registry.active_intents - 1;

        event::emit(IntentCancelled {
            intent_id: object::uid_to_inner(&intent.id),
            cancelled_at: clock.timestamp_ms(),
        });
    }

    // ============== View Functions ==============

    /// Get intent status
    public fun get_status(intent: &Intent): u8 {
        intent.status
    }

    /// Get intent owner
    public fun get_owner(intent: &Intent): address {
        intent.owner
    }

    /// Check if intent is active
    public fun is_active(intent: &Intent): bool {
        intent.status == STATUS_ACTIVE
    }

    /// Check if intent has expired
    public fun is_expired(intent: &Intent, clock: &Clock): bool {
        intent.expires_at <= clock.timestamp_ms()
    }

    /// Get trigger info
    public fun get_trigger(intent: &Intent): (u8, u64) {
        (intent.trigger_type, intent.trigger_value)
    }

    /// Get pair hash
    public fun get_pair_hash(intent: &Intent): vector<u8> {
        intent.pair_hash
    }

    /// Get encrypted data
    public fun get_encrypted_data(intent: &Intent): vector<u8> {
        intent.encrypted_data
    }

    /// Get registry stats
    public fun get_stats(registry: &IntentRegistry): (u64, u64, u64) {
        (registry.total_intents, registry.active_intents, registry.executed_intents)
    }

    // ============== Enclave Functions (for future integration) ==============

    /// Mark intent as executing (to be called by enclave via PTB)
    public fun mark_executing(
        intent: &mut Intent,
        clock: &Clock,
    ) {
        let now = clock.timestamp_ms();
        
        // Check intent is still valid
        assert!(intent.status == STATUS_ACTIVE, EAlreadyExecuting);
        assert!(intent.expires_at > now, EIntentExpired);

        // Mark as executing
        intent.status = STATUS_EXECUTING;

        event::emit(IntentExecuting {
            intent_id: object::uid_to_inner(&intent.id),
            timestamp: now,
        });
    }

    /// Mark intent as executed
    public fun mark_executed(
        registry: &mut IntentRegistry,
        intent: &mut Intent,
        executed_price: u64,
        tx_digest: vector<u8>,
        clock: &Clock,
    ) {
        assert!(intent.status == STATUS_EXECUTING, EInvalidStatus);

        let now = clock.timestamp_ms();

        // Update intent
        intent.status = STATUS_EXECUTED;
        intent.executed_at = option::some(now);
        intent.executed_price = option::some(executed_price);
        intent.tx_digest = option::some(tx_digest);

        // Update registry stats
        registry.active_intents = registry.active_intents - 1;
        registry.executed_intents = registry.executed_intents + 1;

        event::emit(IntentExecuted {
            intent_id: object::uid_to_inner(&intent.id),
            executed_at: now,
            executed_price,
        });
    }

    /// Mark intent as failed
    public fun mark_failed(
        registry: &mut IntentRegistry,
        intent: &mut Intent,
        reason: vector<u8>,
        clock: &Clock,
    ) {
        assert!(intent.status == STATUS_EXECUTING, EInvalidStatus);

        intent.status = STATUS_FAILED;
        registry.active_intents = registry.active_intents - 1;

        event::emit(IntentFailed {
            intent_id: object::uid_to_inner(&intent.id),
            failed_at: clock.timestamp_ms(),
            reason,
        });
    }

    /// Reset executing intent back to active (timeout recovery)
    public fun reset_to_active(
        intent: &mut Intent,
    ) {
        assert!(intent.status == STATUS_EXECUTING, EInvalidStatus);
        intent.status = STATUS_ACTIVE;
    }

    // ============== Admin Functions ==============

    /// Create enclave capability (admin only, for future use)
    public fun create_enclave_cap(
        enclave_pk: vector<u8>,
        ctx: &mut TxContext,
    ): EnclaveCap {
        EnclaveCap {
            id: object::new(ctx),
            enclave_pk,
        }
    }

    // ============== Test Functions ==============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
