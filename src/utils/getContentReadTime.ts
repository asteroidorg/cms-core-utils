type ReadTimeUnit = "short" | "long";

interface GetContentReadTimeOptions {
  /**
   * Average words read per minute
   * @default 200
   */
  wordsPerMinute?: number;

  /**
   * Output style
   * short => "3 min read"
   * long => "3 minutes read"
   *
   * @default "short"
   */
  format?: ReadTimeUnit;

  /**
   * Round mode for minutes
   * ceil => always round up
   * round => normal rounding
   * floor => round down
   *
   * @default "ceil"
   */
  round?: "ceil" | "round" | "floor";

  /**
   * Minimum minutes returned
   * @default 1
   */
  minMinutes?: number;
}

export function getContentReadTime(
  content: string,
  options: GetContentReadTimeOptions = {},
): string {
  const {
    wordsPerMinute = 200,
    format = "short",
    round = "ceil",
    minMinutes = 1,
  } = options;

  if (!content || typeof content !== "string") {
    return format === "short"
      ? `${minMinutes} min read`
      : `${minMinutes} minute read`;
  }

  // Remove scripts/styles
  let text = content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  // Replace some semantic tags with spacing
  text = text
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|code|br|tr)>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');

  // Cleanup whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Count words
  const words = text.split(" ").filter(Boolean).length;

  // Calculate minutes
  const rawMinutes = words / wordsPerMinute;

  const roundMap = {
    ceil: Math.ceil,
    round: Math.round,
    floor: Math.floor,
  };

  const minutes = Math.max(minMinutes, roundMap[round](rawMinutes));

  if (format === "long") {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} read`;
  }

  return `${minutes} min read`;
}
