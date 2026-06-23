/**
 * Staff-auth audience claims. Kept in a dependency-free module so guards (and
 * their unit tests) can import them without pulling in otplib's ESM deps.
 */
export const STAFF_AUD = 'ns.staff';
export const STAFF_MFA_AUD = 'ns.staff.mfa';
