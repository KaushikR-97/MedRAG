async function getAesKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = enc.encode(secret);
  const hash = await window.crypto.subtle.digest("SHA-256", rawKey);
  return window.crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(text: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await getAesKey(secret);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );
  
  // Combine IV and Ciphertext for transport/storage
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherBytes = new Uint8Array(encrypted);
  const cipherHex = Array.from(cipherBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ivHex}:${cipherHex}`;
}

export async function decryptMessage(combinedHex: string, secret: string): Promise<string> {
  try {
    const parts = combinedHex.split(":");
    if (parts.length !== 2) return "[Decryption error: invalid ciphertext]";
    const [ivHex, cipherHex] = parts;
    
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const key = await getAesKey(secret);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBytes
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    return "[Decryption error: invalid signature or key]";
  }
}
