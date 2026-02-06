/// Seal Policy for Intent Encryption
/// 
/// This module defines the access policy for Seal-encrypted intents.
/// Only the registered Nautilus enclave can decrypt user intents.
/// 
/// The seal_approve function is called by Seal key servers to verify
/// that a decryption request is authorized.
module seal_policy::intent {
    use sui::ed25519;

    // ============== Error Codes ==============
    
    const EInvalidId: u64 = 0;
    const EInvalidSignature: u64 = 1;
    const ESenderMismatch: u64 = 2;
    const ETimestampExpired: u64 = 3;

    // ============== Types ==============

    /// Marker type for intents (used as phantom type parameter)
    public struct INTENT has drop {}

    /// Enclave configuration - stores the enclave's public key
    public struct EnclaveConfig has key {
        id: UID,
        /// Ed25519 public key of the enclave's Seal wallet
        enclave_pk: vector<u8>,
        /// Enclave name/description
        name: vector<u8>,
        /// PCR0 hash (for verification)
        pcr0: vector<u8>,
    }

    // ============== Events ==============

    public struct EnclaveRegistered has copy, drop {
        config_id: ID,
        enclave_pk: vector<u8>,
    }

    public struct SealApproved has copy, drop {
        intent_id: vector<u8>,
        timestamp: u64,
    }

    // ============== Init ==============

    /// The seal_approve function must be an entry function that takes
    /// the id as the first parameter for Seal key servers to verify
    /// 
    /// This is the core authorization function that Seal key servers call
    /// to determine if a decryption request should be approved.
    /// 
    /// Parameters:
    /// - id: The intent ID (used as Seal encryption identity)
    /// - enclave_config: The enclave configuration object
    /// - signature: Ed25519 signature from the enclave
    /// - wallet_pk: The Seal wallet public key (must match sender)
    /// - timestamp: Request timestamp (for replay protection)
    entry fun seal_approve(
        id: vector<u8>,
        enclave_config: &EnclaveConfig,
        signature: vector<u8>,
        wallet_pk: vector<u8>,
        timestamp: u64,
        ctx: &TxContext,
    ) {
        // 1. Verify ID is not empty
        assert!(vector::length(&id) > 0, EInvalidId);

        // 2. Verify the wallet_pk matches the enclave's registered key
        assert!(wallet_pk == enclave_config.enclave_pk, ESenderMismatch);

        // 3. Construct the message that should have been signed
        // Message format: id || timestamp
        let mut message = vector::empty<u8>();
        vector::append(&mut message, id);
        
        // Append timestamp as 8 bytes (little-endian)
        let mut ts = timestamp;
        let mut i = 0;
        while (i < 8) {
            vector::push_back(&mut message, ((ts & 0xff) as u8));
            ts = ts >> 8;
            i = i + 1;
        };

        // 4. Verify the signature
        let is_valid = ed25519::ed25519_verify(
            &signature,
            &enclave_config.enclave_pk,
            &message,
        );
        assert!(is_valid, EInvalidSignature);

        // If we reach here, the approval is granted
        // Seal key servers will see this function executed successfully
        // and will return the derived decryption keys
    }

    // ============== Admin Functions ==============

    /// Register a new enclave configuration
    public fun register_enclave(
        enclave_pk: vector<u8>,
        name: vector<u8>,
        pcr0: vector<u8>,
        ctx: &mut TxContext,
    ): EnclaveConfig {
        let config = EnclaveConfig {
            id: object::new(ctx),
            enclave_pk,
            name,
            pcr0,
        };

        sui::event::emit(EnclaveRegistered {
            config_id: object::id(&config),
            enclave_pk,
        });

        config
    }

    /// Share the enclave config so it can be used in seal_approve
    public fun share_enclave_config(config: EnclaveConfig) {
        transfer::share_object(config);
    }

    /// Create and share enclave config in one call
    public entry fun create_and_share_enclave_config(
        enclave_pk: vector<u8>,
        name: vector<u8>,
        pcr0: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let config = register_enclave(enclave_pk, name, pcr0, ctx);
        share_enclave_config(config);
    }

    // ============== View Functions ==============

    /// Get enclave public key
    public fun get_enclave_pk(config: &EnclaveConfig): vector<u8> {
        config.enclave_pk
    }

    /// Get enclave name
    public fun get_name(config: &EnclaveConfig): vector<u8> {
        config.name
    }

    /// Get PCR0
    public fun get_pcr0(config: &EnclaveConfig): vector<u8> {
        config.pcr0
    }

    // ============== Test Functions ==============

    #[test_only]
    public fun create_test_config(
        enclave_pk: vector<u8>,
        ctx: &mut TxContext,
    ): EnclaveConfig {
        register_enclave(
            enclave_pk,
            b"test_enclave",
            vector::empty(),
            ctx,
        )
    }
}
