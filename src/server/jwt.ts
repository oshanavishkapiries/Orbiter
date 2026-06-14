import crypto from 'crypto';
import { DatabaseConnection } from '../memory/database/connection.js';

export interface JwkKeyInfo {
  privateKeyPem: string;
  publicKeyPem: string;
  kid: string;
}

let cachedKeys: JwkKeyInfo | null = null;

export async function getOrGenerateKeys(): Promise<JwkKeyInfo> {
  if (cachedKeys) return cachedKeys;

  const pool = DatabaseConnection.getInstance().getPool();

  try {
    const res = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('auth.jwt.privateKey', 'auth.jwt.publicKey', 'auth.jwt.kid')"
    );
    const keysMap = new Map<string, string>();
    for (const row of res.rows) {
      keysMap.set(row.key, row.value);
    }

    const privateKeyPem = keysMap.get('auth.jwt.privateKey');
    const publicKeyPem = keysMap.get('auth.jwt.publicKey');
    const kid = keysMap.get('auth.jwt.kid');

    if (privateKeyPem && publicKeyPem && kid) {
      cachedKeys = { privateKeyPem, publicKeyPem, kid };
      return cachedKeys;
    }
  } catch (err) {
    // Ignore error if table settings does not exist or database is starting
  }

  // Generate new key pair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string;
  const publicKeyPem = publicKey.export({ type: 'pkcs1', format: 'pem' }) as string;
  const kid = `kid_${crypto.randomBytes(8).toString('hex')}`;

  try {
    const timestamp = Date.now();
    await pool.query(
      `INSERT INTO settings (key, value, value_type, category, description, updated_at) 
       VALUES 
         ('auth.jwt.privateKey', $1, 'string', 'auth', 'JWT RSA Private Key (PEM)', $4),
         ('auth.jwt.publicKey', $2, 'string', 'auth', 'JWT RSA Public Key (PEM)', $4),
         ('auth.jwt.kid', $3, 'string', 'auth', 'JWT Key ID (kid)', $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [privateKeyPem, publicKeyPem, kid, timestamp]
    );
  } catch (err) {
    // Fallback in case settings table is not yet migrated
  }

  cachedKeys = { privateKeyPem, publicKeyPem, kid };
  return cachedKeys;
}

export async function signJwt(payload: any): Promise<string> {
  const { privateKeyPem, kid } = await getOrGenerateKeys();
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${base64Header}.${base64Payload}`);
  const signature = signer.sign(privateKeyPem, 'base64url');

  return `${base64Header}.${base64Payload}.${signature}`;
}

export async function verifyJwt(token: string): Promise<any> {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    if (!headerB64 || !payloadB64 || !signature) return null;

    const { publicKeyPem } = await getOrGenerateKeys();

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const isValid = verifier.verify(publicKeyPem, signature, 'base64url');
    if (!isValid) return null;

    const decodedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) return null;

    return decodedPayload;
  } catch {
    return null;
  }
}
