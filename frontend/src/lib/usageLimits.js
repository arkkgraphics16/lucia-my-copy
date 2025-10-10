export function coerceNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return !!value;
}

function extractCandidateAllowance(candidate) {
  const coerced = coerceNumber(candidate);
  return coerced !== null && coerced >= 0 ? coerced : null;
}

export function extractMessageAllowance(profile) {
  if (!profile || typeof profile !== "object") return null;
  const candidates = [
    profile?.billing?.messageAllowance,
    profile?.stripe?.messageAllowance,
    profile?.messageAllowance,
    profile?.billing?.message_allowance,
    profile?.stripe?.message_allowance,
  ];
  for (const candidate of candidates) {
    const value = extractCandidateAllowance(candidate);
    if (value !== null) return value;
  }
  return null;
}

export function resolveTier(profile) {
  const rawCandidates = [
    profile?.tier,
    profile?.billing?.planTier,
    profile?.billing?.tier,
    profile?.stripe?.planTier,
    profile?.stripe?.tier,
  ];
  for (const raw of rawCandidates) {
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim().toLowerCase();
    }
  }
  return "";
}

export function resolveUsageLimits(profile) {
  const tier = resolveTier(profile);
  const messageAllowance = extractMessageAllowance(profile);
  const courtesyUsed = coerceBoolean(profile?.courtesy_used);

  if (Number.isFinite(messageAllowance) && messageAllowance > 0) {
    return {
      unlimited: false,
      baseAllowance: messageAllowance,
      courtesyAllowance: null,
      courtesyUsed,
      messageAllowance,
    };
  }

  if (tier === "pro") {
    return {
      unlimited: true,
      baseAllowance: null,
      courtesyAllowance: null,
      courtesyUsed: false,
      messageAllowance: null,
    };
  }

  return {
    unlimited: false,
    baseAllowance: 10,
    courtesyAllowance: 12,
    courtesyUsed,
    messageAllowance: null,
  };
}
