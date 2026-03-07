import { requireConfig, saveCache } from "../config/manager";
import { scanProjects } from "../core/scanner";
import { Spinner, bold, green, gray, typeBadge, registerCustomTypes } from "../ui/format";
import type { Cache, ProjectType } from "../config/schema";
import { refreshTemplateCacheBackground, TEMPLATES_SOURCE_URL } from "../core/templates";

export async function scan(): Promise<void> {
  const config = await requireConfig();

  if (config.scanRoots.length === 0) {
    console.log('No scan roots configured. Run "wd setup" first.');
    return;
  }

  registerCustomTypes(config.customTypes);

  const spinner = new Spinner("Scanning projects...");
  spinner.start();

  const startTime = Date.now();
  let count = 0;

  const projects = await scanProjects(config.scanRoots, {
    ignore: config.preferences.scanIgnore,
    customTypes: config.customTypes,
    onProgress: (n) => {
      count = n;
      spinner.update(`Scanning... (${n} projects found)`);
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  const cache: Cache = {
    version: 1,
    lastScan: new Date().toISOString(),
    projects,
  };

  await saveCache(cache);

  spinner.stop();

  // Summary
  console.log(
    `\n${green("✓")} Scanned ${config.scanRoots.length} root${config.scanRoots.length !== 1 ? "s" : ""} in ${elapsed}s`
  );
  console.log(`  Found ${bold(String(projects.length))} projects\n`);

  // Breakdown by category
  const byCategory = new Map<string, number>();
  for (const p of projects) {
    const key = p.label ?? "Other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  }
  for (const [label, n] of byCategory) {
    console.log(`  ${gray(label.padEnd(12))} ${n} projects`);
  }

  // Breakdown by type
  const byType = new Map<ProjectType, number>();
  for (const p of projects) {
    byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
  }

  console.log("\n  Types:");
  for (const [type, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    if (type === "unknown") continue;
    console.log(`    ${typeBadge(type).padEnd(20)} ${n}`);
  }

  console.log();

  // Background template cache refresh
  const gistUrl = config.projectConstructor?.templates?.gistUrl || TEMPLATES_SOURCE_URL;
  if (gistUrl) {
    void refreshTemplateCacheBackground(gistUrl);
  }
}
