import type { Node } from "typescript";

type RecursiveLocal = {
  next?: RecursiveLocal;
  label: string;
};

export type RecursiveLocalAlias = RecursiveLocal;
export type ExternalNodeAlias = Node;
