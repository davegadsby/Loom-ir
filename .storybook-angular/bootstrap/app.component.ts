import { Component } from "@angular/core";

// Never actually mounted at runtime — @storybook/angular bootstraps its own
// dynamic host per story. This exists only because start-storybook's own
// schema (start-schema.json) has no default for `browserTarget`, unlike
// build-storybook's (which defaults to null) — so the dev server always
// requires a real, resolvable Architect target here, even though the build
// works fine without one.
@Component({
  selector: "app-root",
  standalone: true,
  template: "",
})
export class AppComponent {}
