import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CountdownRing } from "./CountdownRing";

describe("CountdownRing", () => {
  it("renders without crashing", () => {
    const { container } = render(<CountdownRing period={30} progress={0.5} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("sets --ring-progress CSS custom property to progress percentage", () => {
    const { container } = render(<CountdownRing period={30} progress={0.75} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue("--ring-progress")).toBe("75%");
  });

  it("clamps progress to [0, 1]", () => {
    const { container } = render(<CountdownRing period={30} progress={1.2} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue("--ring-progress")).toBe("100%");
  });

  it("renders danger color class when ttl <= 5 seconds", () => {
    const { container } = render(<CountdownRing period={30} progress={0.1} danger />);
    expect(container.firstChild as HTMLElement).toHaveClass("countdown-ring--danger");
  });
});
