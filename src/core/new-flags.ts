import type { Variant } from "../config/schema";

export interface FilteredVariantDynamicFlags {
  acceptedFlags: Map<string, string>;
  ignoredFlags: string[];
}

export function filterDynamicFlagsForVariant(
  cliFlags: Map<string, string>,
  variant: Variant,
): FilteredVariantDynamicFlags {
  const acceptedFlags = new Map<string, string>();
  const allowedFlags = new Set(
    (variant.additionalParameters ?? [])
      .map((param) => param.wizardParameter?.default)
      .filter((flag): flag is string => flag !== undefined),
  );

  for (const [flag, value] of cliFlags) {
    if (allowedFlags.has(flag)) {
      acceptedFlags.set(flag, value);
    }
  }

  return {
    acceptedFlags,
    ignoredFlags: [...cliFlags.keys()].filter((flag) => !allowedFlags.has(flag)),
  };
}
