type Attrs = Record<string, unknown>;

export function renderContent(content: string): string {
  try {
    const doc = JSON.parse(content);
    return renderNode(doc);
  } catch {
    return content;
  }
}

export function renderTextOnly(content: string, maxLength = 200): string {
  try {
    const doc = JSON.parse(content);
    return extractText(doc).slice(0, maxLength);
  } catch {
    return content.slice(0, maxLength);
  }
}

function renderDrawing(strokes?: string): string {
  if (!strokes) return "";
  try {
    const data = JSON.parse(strokes);
    if (data.svgPreview) {
      return `<div class="drawing-block"><div class="border border-border rounded-lg overflow-hidden">${data.svgPreview}</div></div>`;
    }
    return "";
  } catch {
    return "";
  }
}

function extractText(node: Record<string, unknown>): string {
  if (!node) return "";
  if (node.type === "text") return (node.text as string) || "";
  if (Array.isArray(node.content)) {
    return node.content.map((c: Record<string, unknown>) => extractText(c)).join(" ");
  }
  return "";
}

export function renderNode(node: Record<string, unknown>): string {
  if (!node) return "";

  const attrs = (node.attrs as Attrs | undefined) || {};

  const childrenHtml = Array.isArray(node.content)
    ? node.content.map((child: Record<string, unknown>) => renderNode(child)).join("")
    : "";

  let html = node.type === "text" ? ((node.text as string) || "") : childrenHtml;

  const marks = Array.isArray(node.marks)
    ? node.marks as Array<{ type: string; attrs?: Attrs }>
    : [];

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link":
        html = `<a href="${mark.attrs?.href || "#"}" target="_blank" rel="noopener noreferrer">${html}</a>`;
        break;
      case "textStyle": {
        const styles: string[] = [];
        if (mark.attrs?.color) styles.push(`color:${mark.attrs.color}`);
        if (mark.attrs?.fontFamily) styles.push(`font-family:${mark.attrs.fontFamily}`);
        if (styles.length > 0) {
          html = `<span style="${styles.join(";")}">${html}</span>`;
        }
        break;
      }
    }
  }

  switch (node.type) {
    case "doc":
      return html;
    case "paragraph":
      return `<p>${html || "<br>"}</p>`;
    case "heading":
      return `<h${attrs.level || 2}>${html}</h${attrs.level || 2}>`;
    case "bulletList":
      return `<ul>${html}</ul>`;
    case "orderedList":
      return `<ol>${html}</ol>`;
    case "listItem":
      return `<li>${html}</li>`;
    case "blockquote":
      return `<blockquote>${html}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${html}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "hardBreak":
      return "<br>";
    case "image":
      return `<img src="${attrs.src || ""}" alt="${attrs.alt || ""}" />`;
    case "drawing":
      return renderDrawing(attrs.strokes as string | undefined);
    case "text":
      return html;
    default:
      return html;
  }
}
