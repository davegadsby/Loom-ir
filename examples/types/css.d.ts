// Side-effect CSS imports are resolved by a bundler, not by TypeScript.
//
// NOTE: this declaration deliberately does not verify the file exists, and there
// is a real defect it therefore cannot catch — `generated/react/Checkbox.tsx`
// emits `import "./Checkbox.css"` while `regenerate.ts` writes the stylesheet to
// `generated/styles/Checkbox.css`, so the path does not resolve in a real app.
// Fixing it changes committed output, so it belongs in a reviewed normalization
// commit rather than being silently patched here.
declare module "*.css";
