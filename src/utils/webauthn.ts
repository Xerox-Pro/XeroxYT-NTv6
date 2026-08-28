export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  const base64String = btoa(str);
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function registerPasskey(): Promise<string> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const options: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: "XeroxYT", id: window.location.hostname },
    user: {
      id: userId,
      name: "user",
      displayName: "User"
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" },
      { alg: -257, type: "public-key" }
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      requireResidentKey: true,
      userVerification: "required"
    },
    timeout: 60000,
    attestation: "none"
  };

  const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
  if (!credential) throw new Error("Registration failed or was cancelled.");
  
  return bufferToBase64url(credential.rawId);
}

export async function authenticatePasskey(): Promise<string> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const options: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    userVerification: "required"
  };

  const assertion = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential;
  if (!assertion) throw new Error("Authentication failed or was cancelled.");
  
  return bufferToBase64url(assertion.rawId);
}
