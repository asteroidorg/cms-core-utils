// Provider
export { AsteroidCMSProvider } from "./provider/AsteroidCMSProvider";
export type { AsteroidCMSProviderProps } from "./provider/AsteroidCMSProvider";
export { useAsteroidCMSConfig } from "./provider/context";
export type { AsteroidCMSConfig, ResolvedAsteroidCMSConfig } from "./provider/types";

// Apollo (escape hatch — most consumers won't need these directly)
export { createApolloClient } from "./apollo/createApolloClient";

// Hooks
export { useCmsContent } from "./hooks/useCmsContent";
export type { UseCmsContentOptions } from "./hooks/useCmsContent";
export { useCmsMutate } from "./hooks/useCmsMutate";
export type { UseCmsMutateOptions } from "./hooks/useCmsMutate";

// Utilities
export { cmsImage, useCmsImage } from "./utils/cmsImage";

// Rich text
export { RichTextContent } from "./components/RichTextContent";
export { parseRichText, removeEmptyParagraphs } from "./components/richTextParser";
export type {
  RichTextClassKey,
  RichTextClassMap,
  ParseRichTextOptions,
} from "./components/richTextParser";
