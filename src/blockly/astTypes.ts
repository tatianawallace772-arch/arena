export interface BlocklyBlockNode {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<
    string,
    {
      block?: BlocklyBlockNode;
      shadow?: BlocklyBlockNode;
    }
  >;
  next?: {
    block?: BlocklyBlockNode;
  };
}

export interface SerializedWorkspace {
  blocks?: {
    languageVersion?: number;
    blocks?: BlocklyBlockNode[];
  };
}

export function getInputBlock(
  node: BlocklyBlockNode,
  inputName: string
): BlocklyBlockNode | undefined {
  const slot = node.inputs?.[inputName];
  if (!slot) return undefined;
  return slot.block ?? slot.shadow;
}

export function getTopBlocks(ws: Record<string, unknown> | null | undefined): BlocklyBlockNode[] {
  if (!ws) return [];
  const typed = ws as SerializedWorkspace;
  return typed.blocks?.blocks ?? [];
}
