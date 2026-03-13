/**
 * Custom search prompt extending @inquirer/search with two additional keybindings:
 *   Ctrl+O — resolve with parentDir: true (navigate to parent directory)
 *   Ctrl+Y — copy selected path to clipboard, stay in prompt
 */
import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  usePagination,
  useEffect,
  useMemo,
  isDownKey,
  isEnterKey,
  isTabKey,
  isUpKey,
  Separator,
  makeTheme,
  type KeypressEvent,
} from "@inquirer/core";
import colors from "yoctocolors-cjs";
import figures from "@inquirer/figures";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectSearchResult {
  path: string;
  parentDir: boolean;
}

type Choice = {
  value: string;
  name?: string;
  description?: string;
  short?: string;
  disabled?: boolean | string;
};

type ChoiceOrSeparator = string | Separator | Choice;

interface ProjectSearchConfig {
  message: string;
  source: (
    term: string | undefined,
    opt: { signal: AbortSignal }
  ) => readonly ChoiceOrSeparator[] | Promise<readonly ChoiceOrSeparator[]>;
  pageSize?: number;
  validate?: (
    value: string
  ) => boolean | string | Promise<string | boolean>;
}

// ─── Internal normalised choice ───────────────────────────────────────────────

type NormalizedChoice = {
  value: string;
  name: string;
  short: string;
  disabled: boolean | string;
  description?: string;
};

// ─── Theme ───────────────────────────────────────────────────────────────────

const searchTheme = {
  icon: { cursor: figures.pointer },
  style: {
    disabled: (text: string) => colors.dim(`- ${text}`),
    searchTerm: (text: string) => colors.cyan(text),
    description: (text: string) => colors.cyan(text),
    keysHelpTip: (keys: [key: string, action: string][]) =>
      keys
        .map(([key, action]) => `${colors.bold(key)} ${colors.dim(action)}`)
        .join(colors.dim(" \u2022 ")),
  },
  helpMode: "always" as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSelectable(
  item: NormalizedChoice | Separator
): item is NormalizedChoice {
  return !Separator.isSeparator(item) && !(item as NormalizedChoice).disabled;
}

function normalizeChoices(
  choices: readonly ChoiceOrSeparator[]
): (NormalizedChoice | Separator)[] {
  return choices.map((choice) => {
    if (Separator.isSeparator(choice)) return choice;
    if (typeof choice === "string") {
      return { value: choice, name: choice, short: choice, disabled: false };
    }
    const name = choice.name ?? String(choice.value);
    const normalized: NormalizedChoice = {
      value: choice.value,
      name,
      short: choice.short ?? name,
      disabled: choice.disabled ?? false,
    };
    if (choice.description) normalized.description = choice.description;
    return normalized;
  });
}

async function copyToClipboard(text: string): Promise<void> {
  const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" });
  proc.stdin.write(text);
  proc.stdin.end();
  await proc.exited;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

export default createPrompt<ProjectSearchResult, ProjectSearchConfig>(
  (config, done) => {
    const { pageSize = 7, validate = () => true } = config;
    const theme = makeTheme(searchTheme, undefined);

    const [status, setStatus] = useState<
      "loading" | "idle" | "done"
    >("loading");
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<
      (NormalizedChoice | Separator)[]
    >([]);
    const [searchError, setSearchError] = useState<string | undefined>(
      undefined
    );
    const [copiedFeedback, setCopiedFeedback] = useState(false);

    const prefix = usePrefix({ status, theme });

    const bounds = useMemo(() => {
      const first = searchResults.findIndex(isSelectable);
      const last = searchResults.findLastIndex(isSelectable);
      return { first, last };
    }, [searchResults]);

    const [active = bounds.first, setActive] = useState<number | undefined>(
      undefined
    );

    useEffect(() => {
      const controller = new AbortController();
      setStatus("loading");
      setSearchError(undefined);

      const fetchResults = async () => {
        try {
          const results = await config.source(searchTerm || undefined, {
            signal: controller.signal,
          });
          if (!controller.signal.aborted) {
            setActive(undefined);
            setSearchError(undefined);
            setSearchResults(normalizeChoices(results));
            setStatus("idle");
          }
        } catch (error) {
          if (!controller.signal.aborted && error instanceof Error) {
            setSearchError(error.message);
          }
        }
      };

      void fetchResults();
      return () => {
        controller.abort();
      };
    }, [searchTerm]);

    const selectedChoice =
      active !== undefined
        ? (searchResults[active] as NormalizedChoice | undefined)
        : undefined;

    useKeypress(async (key: KeypressEvent, rl) => {
      // Ctrl+O: navigate to parent directory
      if (key.ctrl && key.name === "o") {
        if (selectedChoice && isSelectable(selectedChoice)) {
          setStatus("done");
          done({ path: selectedChoice.value, parentDir: true });
        }
        return;
      }

      // Ctrl+Y: copy selected path to clipboard, stay in prompt
      if (key.ctrl && key.name === "y") {
        if (selectedChoice && isSelectable(selectedChoice)) {
          void copyToClipboard(selectedChoice.value).then(() => {
            setCopiedFeedback(true);
            setTimeout(() => setCopiedFeedback(false), 1500);
          });
        }
        return;
      }

      // Enter: select current item
      if (isEnterKey(key)) {
        if (selectedChoice && isSelectable(selectedChoice)) {
          setStatus("loading");
          const isValid = await validate(selectedChoice.value);
          setStatus("idle");
          if (isValid === true) {
            setStatus("done");
            done({ path: selectedChoice.value, parentDir: false });
          } else if (selectedChoice.name === searchTerm) {
            setSearchError(
              typeof isValid === "string"
                ? isValid
                : "You must provide a valid value"
            );
          } else {
            rl.write(selectedChoice.name);
            setSearchTerm(selectedChoice.name);
          }
        } else {
          rl.write(searchTerm);
        }
        return;
      }

      // Tab: autocomplete with selected item's name
      if (isTabKey(key) && selectedChoice && isSelectable(selectedChoice)) {
        rl.clearLine(0);
        rl.write(selectedChoice.name);
        setSearchTerm(selectedChoice.name);
        return;
      }

      // Up/Down: navigate results
      if (status !== "loading" && (isUpKey(key) || isDownKey(key))) {
        rl.clearLine(0);
        if (
          (isUpKey(key) && active !== bounds.first) ||
          (isDownKey(key) && active !== bounds.last)
        ) {
          const offset = isUpKey(key) ? -1 : 1;
          let next = active ?? 0;
          do {
            next = (next + offset + searchResults.length) % searchResults.length;
          } while (!isSelectable(searchResults[next]!));
          setActive(next);
        }
        return;
      }

      // Any other key: update search term
      setSearchTerm(rl.line);
    });

    // ─── Render ────────────────────────────────────────────────────────────────

    const message = theme.style.message(config.message, status);

    const helpLine = theme.style.keysHelpTip([
      ["↑↓", "navigate"],
      ["⏎", "select"],
      ["ctrl+o", "parent dir"],
      ["ctrl+y", "copy path"],
    ]);

    if (status === "done" && selectedChoice) {
      return [prefix, message, theme.style.answer(selectedChoice.short)]
        .filter(Boolean)
        .join(" ")
        .trimEnd();
    }

    const searchStr = theme.style.searchTerm(searchTerm);
    const header = [prefix, message, searchStr]
      .filter(Boolean)
      .join(" ")
      .trimEnd();

    const page = usePagination({
      items: searchResults,
      active: active ?? bounds.first,
      renderItem({
        item,
        isActive,
      }: {
        item: NormalizedChoice | Separator;
        isActive: boolean;
      }) {
        if (Separator.isSeparator(item)) {
          return ` ${item.separator}`;
        }
        if (item.disabled) {
          const disabledLabel =
            typeof item.disabled === "string" ? item.disabled : "(disabled)";
          return theme.style.disabled(`${item.name} ${disabledLabel}`);
        }
        const color = isActive ? theme.style.highlight : (x: string) => x;
        const cursor = isActive ? theme.icon.cursor : ` `;
        return color(`${cursor} ${item.name}`);
      },
      pageSize,
      loop: false,
    });

    let errorOrPage: string;
    if (searchError) {
      errorOrPage = theme.style.error(searchError);
    } else if (
      searchResults.length === 0 &&
      searchTerm !== "" &&
      status === "idle"
    ) {
      errorOrPage = theme.style.error("No results found");
    } else {
      errorOrPage = page;
    }

    // Description area: show "Copied!" feedback or normal description
    let descriptionLine: string;
    if (copiedFeedback) {
      descriptionLine = colors.green("✓ Copied to clipboard");
    } else {
      const desc =
        selectedChoice && isSelectable(selectedChoice)
          ? selectedChoice.description
          : undefined;
      descriptionLine = desc ? theme.style.description(desc) : "";
    }

    const body = [errorOrPage, " ", descriptionLine, helpLine]
      .filter(Boolean)
      .join("\n")
      .trimEnd();

    return [header, body];
  }
);

export { Separator };
