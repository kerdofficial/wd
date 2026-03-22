import { describe, expect, test } from "bun:test";
import { filterDynamicFlagsForVariant } from "../new-flags";
import type { Variant } from "../../config/schema";

const variant: Variant = {
  type: "default",
  name: "Default",
  command: "create {PROJECT_NAME}",
  supportedPackageManagers: [
    { name: "bun", command: "bunx --bun", commandParam: "bun" },
  ],
  additionalParameters: [
    {
      id: "preset",
      wizardParameter: { default: "preset", shorthand: "p" },
      optional: false,
      description: "Preset",
      type: "select",
      options: ["nova", "vega"],
      parameterKey: "PRESET",
    },
  ],
};

describe("filterDynamicFlagsForVariant", () => {
  test("keeps only flags declared for the selected variant", () => {
    const cliFlags = new Map([
      ["preset", "nova"],
      ["router-type", "app"],
    ]);

    const result = filterDynamicFlagsForVariant(cliFlags, variant);

    expect(result.acceptedFlags.get("preset")).toBe("nova");
    expect(result.acceptedFlags.has("router-type")).toBe(false);
    expect(result.ignoredFlags).toEqual(["router-type"]);
  });

  test("returns all flags as ignored when variant has no dynamic parameters", () => {
    const result = filterDynamicFlagsForVariant(
      new Map([["preset", "nova"]]),
      { ...variant, additionalParameters: [] },
    );

    expect(result.acceptedFlags.size).toBe(0);
    expect(result.ignoredFlags).toEqual(["preset"]);
  });
});
