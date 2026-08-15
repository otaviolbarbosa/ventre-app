export function sanitizeClausesHtml(html: string): string {
  return html.replace(/font-family\s*:[^;}"']+[;}"']/g, "");
}
