export function isValidUsername(username: string): boolean {
  if (!username) return false;
  // only letters, underscore and hyphen (3-16 chars). No spaces or digits allowed.
  const re = /^[A-Za-z_-]{3,16}$/;
  return re.test(username);
}

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return re.test(email);
}

export function isUsernameOrEmail(value: string): boolean {
  return isValidUsername(value) || isValidEmail(value);
}

export function isValidPassword(password: string): boolean {
  if (!password) return false;
  // 8-12 chars, at least one uppercase, one digit and one symbol
  const re = /^(?=.{8,12}$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;
  return re.test(password);
}

export function sanitizeDisplayName(input: string | null | undefined): string {
  if (!input) return '';
  // remove tags
  const stripped = input.replace(/<.*?>/g, '');
  // allow letters (unicode), numbers (unicode), underscore and hyphen only
  const cleaned = stripped.replace(/[^\p{L}\p{N}_-]/gu, '');
  return cleaned.trim().slice(0, 16);
}
export function isValidDisplayName(name: string | null | undefined): boolean {
  if (!name) return false;
  // allow unicode letters, numbers, underscore and hyphen. 1-16 chars
  const re = /^[\p{L}\p{N}_-]{1,16}$/u;
  return re.test(name);
}

export function containsMaliciousPayload(s: string | null | undefined): boolean {
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower.includes('<script') || lower.includes('javascript:') || lower.includes('--') || lower.includes(';drop ') || lower.includes('/*') || lower.includes('*/')) {
    return true;
  }
  return false;
}
