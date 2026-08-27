import DOMPurify from "isomorphic-dompurify";

const MESSAGE_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["p", "strong", "em", "ul", "ol", "li", "br", "a"],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

export function sanitizeMessageHtml(html: string): string {
  return DOMPurify.sanitize(html, MESSAGE_SANITIZE_CONFIG);
}
