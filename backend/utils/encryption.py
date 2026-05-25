import base64
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Read master key from environment variables.
# We hash the key using SHA-256 to guarantee we get a 32-byte key for AES-256-GCM,
# making it robust against varying length input configurations.
MASTER_VAULT_KEY_RAW = os.getenv("MASTER_VAULT_KEY", "synq-development-secret-vault-key-change-me")
MASTER_VAULT_KEY_BYTES = hashlib.sha256(MASTER_VAULT_KEY_RAW.encode("utf-8")).digest()


def encrypt_payload(plaintext: str) -> str:
    """
    Encrypts a plaintext string using AES-256-GCM.
    Returns a combined string format: nonce_base64:ciphertext_base64
    """
    if not plaintext:
        return ""
        
    aesgcm = AESGCM(MASTER_VAULT_KEY_BYTES)
    # Generate a random 12-byte initialization vector (nonce)
    nonce = os.urandom(12)
    
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    
    nonce_b64 = base64.b64encode(nonce).decode("utf-8")
    ciphertext_b64 = base64.b64encode(ciphertext).decode("utf-8")
    
    return f"{nonce_b64}:{ciphertext_b64}"


def decrypt_payload(encrypted_string: str) -> str:
    """
    Decrypts a combined string format (nonce_base64:ciphertext_base64) using AES-256-GCM.
    Returns the original decrypted plaintext string.
    """
    if not encrypted_string:
        return ""
        
    try:
        parts = encrypted_string.split(":", 1)
        if len(parts) != 2:
            raise ValueError("Invalid encrypted payload format. Missing delimiter ':'.")
            
        nonce_b64, ciphertext_b64 = parts
        
        nonce = base64.b64decode(nonce_b64.encode("utf-8"))
        ciphertext = base64.b64decode(ciphertext_b64.encode("utf-8"))
        
        aesgcm = AESGCM(MASTER_VAULT_KEY_BYTES)
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}") from e
