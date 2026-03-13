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
      id: "base-color",
      wizardParameter: { default: "base-color", shorthand: "bc" },
      optional: false,
      description: "Base color",
      type: "select",
      options: ["zinc", "stone"],
      parameterKey: "BASE_COLOR",
    },
  ],
};

describe("filterDynamicFlagsForVariant", () => {
  test("keeps only flags declared for the selected variant", () => {
    const cliFlags = new Map([
      ["base-color", "zinc"],
      ["router-type", "app"],
    ]);

    const result = filterDynamicFlagsForVariant(cliFlags, variant);

    expect(result.acceptedFlags.get("base-color")).toBe("zinc");
    expect(result.acceptedFlags.has("router-type")).toBe(false);
    expect(result.ignoredFlags).toEqual(["router-type"]);
  });

  test("returns all flags as ignored when variant has no dynamic parameters", () => {
    const result = filterDynamicFlagsForVariant(
      new Map([["base-color", "zinc"]]),
      { ...variant, additionalParameters: [] },
    );

    expect(result.acceptedFlags.size).toBe(0);
    expect(result.ignoredFlags).toEqual(["base-color"]);
  });
});
