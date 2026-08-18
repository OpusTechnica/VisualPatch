import React from 'react';

export interface VisualPatchProps {
  /** Optional custom keyboard shortcut overrides or settings */
  storageKey?: string;
  defaultVisible?: boolean;
}

/**
 * VisualPatch - In-Browser Visual Feedback Tool for AI Coding Assistants
 */
export declare const VisualPatch: React.FC<VisualPatchProps>;
export default VisualPatch;
