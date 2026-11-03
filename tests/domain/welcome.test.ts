import { test, expect } from "vitest";
import { chooseWelcomeImage, welcomeImages } from "../../src/welcome/images";
test("welcome picks cover the local licensed library and never select a customer URL", () => {
  expect(welcomeImages).toHaveLength(4);
  for (let i = 0; i < 4; i++) {
    expect(chooseWelcomeImage((i + 0.5) / 4)).toBe(welcomeImages[i]);
    expect(welcomeImages[i].src).toMatch(/^\/images\//);
    expect(welcomeImages[i].source).toContain("Original community illustration");
  }
});
