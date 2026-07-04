import { LocaleToggle } from "./LocaleToggle";
import { ScreenTitle } from "./ScreenTitle";

// App top bar: screen title on the left, language switch on the right. The
// signed-in user and logout now live in the Sidebar footer. Space to the right
// of LocaleToggle is intentionally reserved for a future notifications control.
export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-[58px] items-center gap-4 border-b border-[var(--color-line)] bg-white px-6">
      <ScreenTitle />
      <LocaleToggle />
    </header>
  );
}
