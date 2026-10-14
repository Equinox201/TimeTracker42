import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Reads the real design tokens from globals.css and checks WCAG contrast for the pairs the
// UI actually puts text on, in both themes. Changing a token to something unreadable fails CI.

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

type Rgb = [number, number, number];

function tokensIn(selector: string): Record<string, Rgb> {
  const block = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  if (!block) {
    throw new Error(`No ${selector} block in globals.css`);
  }
  const tokens: Record<string, Rgb> = {};
  for (const match of block[1].matchAll(/--tt42-([a-z0-9-]+)-rgb:\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])];
  }
  return tokens;
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const themes = {
  light: tokensIn(":root"),
  dark: tokensIn(":root.dark")
};

// [foreground, background, minimum ratio]. 4.5 is AA for body text.
const TEXT_PAIRS: Array<[string, string, number]> = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text", "surface-2", 4.5],
  ["text-muted", "bg", 4.5],
  ["text-muted", "surface", 4.5],
  ["text-muted", "surface-2", 4.5],
  ["accent", "bg", 4.5],
  ["accent", "surface", 4.5],
  ["accent", "surface-2", 4.5],
  ["on-accent", "accent", 4.5],
  ["warn", "surface", 4.5],
  ["danger", "surface", 4.5]
];

describe.each(Object.entries(themes))("%s theme", (_name, tokens) => {
  it("defines every token the pairs rely on", () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      expect(tokens[fg], `--tt42-${fg}`).toBeDefined();
      expect(tokens[bg], `--tt42-${bg}`).toBeDefined();
    }
  });

  it.each(TEXT_PAIRS)("%s on %s meets %s:1", (fg, bg, minimum) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(minimum);
  });
});
