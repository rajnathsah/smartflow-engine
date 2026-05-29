import base64
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from backend.config import settings

MASTER_VAULT_KEY_RAW = settings.MASTER_VAULT_KEY
MASTER_VAULT_KEY_BYTES = hashlib.sha256(MASTER_VAULT_KEY_RAW.encode("utf-8")).digest()

def encrypt_payload(plaintext: str) -> str:
    """Encrypts a plaintext string using AES-256-GCM.

    Args:
        plaintext: The string to encrypt.

    Returns:
        str: Nonce and ciphertext formatted as nonce_base64:ciphertext_base64.
    """
    if not plaintext:
        return ""

    aesgcm = AESGCM(MASTER_VAULT_KEY_BYTES)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    nonce_b64 = base64.b64encode(nonce).decode("utf-8")
    ciphertext_b64 = base64.b64encode(ciphertext).decode("utf-8")
    return f"{nonce_b64}:{ciphertext_b64}"

def decrypt_payload(encrypted_string: str) -> str:
    """Decrypts a combined string format using AES-256-GCM.

    Args:
        encrypted_string: The string format (nonce_base64:ciphertext_base64).

    Returns:
        str: The original decrypted plaintext string.

    Raises:
        ValueError: If decryption fails or format is invalid.
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
