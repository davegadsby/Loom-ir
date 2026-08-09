/** Structural path — component/section/slug chain (architecture §5.5). Never derived from prose. */
export type NodeId = string;

/** A reference to another spec file, e.g. a base spec named in `extends`. */
export type SpecRef = string;

/**
 * Provenance (§5.4): `'own'` for a node declared directly on the component, or
 * the base spec it was inherited from plus whether the child overrode it.
 * Carried in the envelope so backends see one flat tree while validators and
 * IDE tooling can still report "this invariant came from `overlay-base`."
 */
export type NodeOrigin = "own" | { inheritedFrom: SpecRef; overridden: boolean };

export type VerifyRoute = "unit" | "interaction" | "a11y" | "visual";

/** A single file a backend (emitter) produces by walking the tree (§4). */
export interface EmittedFile {
  path: string;
  contents: string;
}

/** The envelope every node kind carries (§5.4). */
export interface LoomNodeEnvelope {
  id: NodeId;
  kind: string;
  origin: NodeOrigin;
  assertable: boolean;
  verify?: VerifyRoute;
}
