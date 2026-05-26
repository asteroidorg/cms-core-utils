"use client";

// Provider
export { AsteroidCMSProvider } from "./provider/AsteroidCMSProvider";
export type { AsteroidCMSProviderProps } from "./provider/AsteroidCMSProvider";
export { useAsteroidCMSConfig } from "./provider/context";

// Hooks
export { useCmsContent } from "./hooks/useCmsContent";
export type { UseCmsContentOptions } from "./hooks/useCmsContent";
export { useCmsMutate } from "./hooks/useCmsMutate";
export type { UseCmsMutateOptions } from "./hooks/useCmsMutate";

// Hook variant of cmsImage
export { useCmsImage } from "./utils/cmsImage";

// Rich text component
export { RichTextContent } from "./components/RichTextContent";

// Re-export heading helpers from the client entry for convenience.
export {
  slugify,
  extractHeadingsFromHtml,
  extractHeadingsFromElement,
} from "./utils/extractHeadings";
export type {
  HeadingLevel,
  ExtractedHeading,
  ExtractHeadingsOptions,
} from "./utils/extractHeadings";
