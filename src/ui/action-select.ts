/**
 * Lightweight custom select prompt built on @inquirer/core.
 * Always supports Escape → resolves with ESCAPE_VALUE.
 * Supports an optional Ctrl+<key> shortcut that resolves with a custom value.
 */
import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  usePagination,
  useMemo,
  isDownKey,
  isEnterKey,
  isUpKey,
  makeTheme,
  type KeypressEvent,
} from "@inquirer/core";
import colors from "yoctocolors-cjs";
import figures from "@inquirer/figures";

// ─── Sentinel value for Escape ────────────────────────────────────────────────

export const ESCAPE_VALUE = "__escape__" as const;

export function isEscape(v: string): boolean {
  return v === ESCAPE_VALUE;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionChoice {
  value: string;
  name: string;
}

export interface ActionSelectConfig {
  message: string;
  choices: ActionChoice[];
  /** Optional extra Ctrl+key shortcut */
  shortcut?: {
    key: string; // single lowercase letter, e.g. "e"
    value: string; // resolved value when triggered, e.g. "editor"
    label: string; // shown in help line, e.g. "open in editor"
    /** If true, resolved value is "${value}:${selectedChoice.value}" */
    includeChoice?: boolean;
  };
  loop?: boolean; // default false
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const actionSelectTheme = {
  icon: { cursor: figures.pointer },
  helpMode: "always" as const,
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

export const actionSelect = createPrompt<string, ActionSelectConfig>(
  (config, done) => {
    const { choices, shortcut, loop = false } = config;
    const theme = makeTheme(actionSelectTheme, undefined);
    const prefix = usePrefix({ status: "idle", theme });

    const [status, setStatus] = useState<"idle" | "done">("idle");

    const bounds = useMemo(
      () => ({ first: 0, last: choices.length - 1 }),
      [choices],
    );

    const [active = 0, setActive] = useState<number | undefined>(undefined);
    const selectedChoice = choices[active] ?? choices[0]!;

    useKeypress((key: KeypressEvent, rl) => {
      if (key.name === "backspace") {
        setStatus("done");
        done(ESCAPE_VALUE);
        return;
      }

      // Ctrl+shortcut key
      if (shortcut && key.ctrl && key.name === shortcut.key) {
        setStatus("done");
        const resolvedValue = shortcut.includeChoice
          ? `${shortcut.value}:${selectedChoice.value}`
          : shortcut.value;
        done(resolvedValue);
        return;
      }

      // Enter: resolve with selected choice
      if (isEnterKey(key)) {
        setStatus("done");
        done(selectedChoice.value);
        return;
      }

      // Up/Down navigation
      if (isUpKey(key) || isDownKey(key)) {
        rl.clearLine(0);
        const isUp = isUpKey(key);
        if (isUp && active === bounds.first) return;
        if (!isUp && active === bounds.last) return;
        const offset = isUp ? -1 : 1;
        let next = active + offset;
        if (loop) {
          next = (active + offset + choices.length) % choices.length;
        }
        setActive(next);
        return;
      }
    });

    // ─── Render ───────────────────────────────────────────────────────────────

    const message = theme.style.message(config.message, status);

    if (status === "done") {
      return `${prefix} ${message} ${theme.style.answer(selectedChoice.name)}`;
    }

    const header = `${prefix} ${message}`;

    const page = usePagination({
      items: choices,
      active,
      renderItem({
        item,
        isActive,
      }: {
        item: ActionChoice;
        isActive: boolean;
      }) {
        const color = isActive ? theme.style.highlight : (x: string) => x;
        const cursor = isActive ? theme.icon.cursor : " ";
        return color(`${cursor} ${item.name}`);
      },
      pageSize: choices.reduce((sum, c) => sum + c.name.split("\n").length, 0),
      loop: false,
    });

    const helpParts: string[] = [
      `${colors.bold("↑↓")} ${colors.dim("navigate")}`,
      `${colors.bold("enter")} ${colors.dim("select")}`,
      `${colors.bold("⌫")} ${colors.dim("back")}`,
    ];
    if (shortcut) {
      helpParts.push(
        `${colors.bold(`ctrl+${shortcut.key}`)} ${colors.dim(shortcut.label)}`,
      );
    }
    const helpLine = helpParts.join(colors.dim("  •  "));

    const body = [page, " ", helpLine].filter(Boolean).join("\n");

    return [header, body];
  },
);
