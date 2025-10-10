const TIER_REWRITES = {
  standard: "basic",
  standard_monthly: "basic",
  standard_month: "basic",
  standard_plan: "basic",
  starter: "basic",
  plus: "medium",
  professional: "medium",
  enterprise: "intensive",
};

const PLAN_ALLOWANCES = {
  basic: 200,
  medium: 400,
  intensive: 2000,
  total: 6000,
};

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

export function canonicalizeTier(raw) {
  if (typeof raw !== "string") return "";
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "";
  return TIER_REWRITES[normalized] || normalized;
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
    profile?.billing?.planTier,
    profile?.billing?.tier,
    profile?.stripe?.planTier,
    profile?.stripe?.tier,
    profile?.tier,
  ];

  const normalized = [];
  for (const raw of rawCandidates) {
    const value = canonicalizeTier(raw);
    if (value) normalized.push(value);
  }

  if (normalized.length === 0) return "";

  const paidOrUpgraded = normalized.find((value) => value !== "free");
  return paidOrUpgraded || normalized[0];
}

function allowanceForTier(tier) {
  const canonical = canonicalizeTier(tier);
  const value = PLAN_ALLOWANCES[canonical];
  return Number.isFinite(value) ? value : null;
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

  const tierAllowance = allowanceForTier(tier);
  if (Number.isFinite(tierAllowance) && tierAllowance > 0) {
    return {
      unlimited: false,
      baseAllowance: tierAllowance,
      courtesyAllowance: null,
      courtesyUsed: false,
      messageAllowance: tierAllowance,
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
