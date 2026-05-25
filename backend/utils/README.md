# Utilities Module 🛠️

This directory hosts system utilities for security encryption and proxy network tunneling.

## Components

*   [**`encryption.py`**](encryption.py):
    *   **Cryptographic Standard:** Encrypts and decrypts connection strings using AES-256-GCM (`AESGCM`).
    *   **Key Masking:** Hashes environmental `MASTER_VAULT_KEY` values to verify exactly 32-byte master parameters.
    
*   [**`tunneling.py`**](tunneling.py):
    *   **Context forwarding:** Establishes `sshtunnel` links through bastion hosts to secure database ports.
    *   **In-Memory Keys:** Evaluates PEM private keys purely in-memory (using `StringIO`), avoiding disk storage.
    *   **Resource teardown:** Disposes tunnel threads in a `finally` block to prevent port exhaustion.
