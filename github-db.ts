import crypto from 'crypto';
import axios from 'axios';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_32_byte_key_for_dev_only!';
const ALGO = 'aes-256-cbc';

// GitHub API setup
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_REPO = process.env.GITHUB_REPO;

function getHeaders() {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is missing");
  return {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'XeroxYT-Auth'
  };
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  // Ensure the key is exactly 32 bytes
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export function hashId(id: string): string {
  return crypto.createHash('sha256').update(id).digest('hex');
}

export async function getGitHubFile(filename: string): Promise<{ content: any, sha: string } | null> {
  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) return null;
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filename}`;
  try {
    const response = await axios.get(url, { headers: getHeaders() });
    const contentStr = Buffer.from(response.data.content, 'base64').toString('utf-8');
    return { content: JSON.parse(contentStr), sha: response.data.sha };
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    console.error("Error fetching file from GitHub:", error.message);
    throw error;
  }
}

export async function putGitHubFile(filename: string, content: any, sha?: string): Promise<string> {
  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !GITHUB_REPO) {
    console.warn("GitHub credentials missing, skipping put.");
    return "";
  }
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filename}`;
  const contentBase64 = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
  
  const payload: any = {
    message: `Update ${filename}`,
    content: contentBase64
  };
  if (sha) payload.sha = sha;

  try {
    const response = await axios.put(url, payload, { headers: getHeaders() });
    return response.data.content.sha;
  } catch (error: any) {
    console.error("Error writing file to GitHub:", error.message);
    throw error;
  }
}
