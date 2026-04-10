"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Spinner } from "@/components/pickup-admin-ui";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*_[\]()])/g, "\\$1");
}

function isHorizontalRuleLine(line: string) {
  return /^-{3,}$/.test(line.trim());
}

function isHeadingLine(line: string) {
  return /^#{1,3}\s+/.test(line);
}

function isQuoteLine(line: string) {
  return /^>\s?/.test(line);
}

function isBulletedListLine(line: string) {
  return /^[-*]\s+/.test(line);
}

function isNumberedListLine(line: string) {
  return /^\d+\.\s+/.test(line);
}

function isBlockStarter(line: string) {
  return (
    isHorizontalRuleLine(line) ||
    isHeadingLine(line) ||
    isQuoteLine(line) ||
    isBulletedListLine(line) ||
    isNumberedListLine(line)
  );
}

function parseInlineMarkdown(value: string): string {
  const underlineValues: string[] = [];
  const underlineTokenized = value.replace(/<u>(.*?)<\/u>/gi, (_match, inner: string) => {
    const index = underlineValues.push(inner) - 1;
    return `@@UNDERLINE_TOKEN_${index}@@`;
  });

  let html = escapeHtml(underlineTokenized);

  html = html.replace(
    /!\[([^\]]*)]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_match, alt: string, src: string) =>
      `<img alt="${escapeAttribute(alt)}" src="${escapeAttribute(src)}" />`,
  );

  html = html.replace(
    /\[([^\]]+)]\(([^)\s]+)\)/g,
    (_match, label: string, href: string) =>
      `<a href="${escapeAttribute(href)}">${label}</a>`,
  );

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/@@UNDERLINE_TOKEN_(\d+)@@/g, (_match, index: string) => {
    const underlinedValue = underlineValues[Number(index)] ?? "";
    return `<u>${parseInlineMarkdown(underlinedValue)}</u>`;
  });

  return html;
}

function markdownToEditorHtml(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    if (isHorizontalRuleLine(line)) {
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2] ?? "";
      blocks.push(`<h${level}>${parseInlineMarkdown(text) || "<br />"}</h${level}>`);
      index += 1;
      continue;
    }

    if (isQuoteLine(line)) {
      const quotedLines: string[] = [];
      while (index < lines.length && isQuoteLine(lines[index] ?? "")) {
        quotedLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }

      const quoteBody = quotedLines
        .map((quotedLine) => `<p>${parseInlineMarkdown(quotedLine) || "<br />"}</p>`)
        .join("");
      blocks.push(`<blockquote>${quoteBody}</blockquote>`);
      continue;
    }

    if (isBulletedListLine(line)) {
      const items: string[] = [];
      while (index < lines.length && isBulletedListLine(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ul>${items.map((item) => `<li>${parseInlineMarkdown(item) || "<br />"}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (isNumberedListLine(line)) {
      const items: string[] = [];
      while (index < lines.length && isNumberedListLine(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        `<ol>${items.map((item) => `<li>${parseInlineMarkdown(item) || "<br />"}</li>`).join("")}</ol>`,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentLine = lines[index] ?? "";
      if (currentLine.trim().length === 0 || isBlockStarter(currentLine)) {
        break;
      }

      paragraphLines.push(currentLine);
      index += 1;
    }

    blocks.push(`<p>${paragraphLines.map((paragraphLine) => parseInlineMarkdown(paragraphLine)).join("<br />")}</p>`);
  }

  return blocks.join("") || "<p><br /></p>";
}

function serializeInlineNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownText(node.textContent ?? "");
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();

  switch (tagName) {
    case "br":
      return "\n";
    case "strong":
    case "b":
      return `**${serializeInlineChildren(node)}**`;
    case "em":
    case "i":
      return `_${serializeInlineChildren(node)}_`;
    case "u":
      return `<u>${serializeInlineChildren(node)}</u>`;
    case "code":
      return `\`${node.textContent ?? ""}\``;
    case "a": {
      const href = node.getAttribute("href")?.trim();
      const label = serializeInlineChildren(node).trim() || node.textContent?.trim() || "link";
      return href ? `[${label}](${href})` : label;
    }
    case "img": {
      const src = node.getAttribute("src")?.trim();
      return src ? `![](${src})` : "";
    }
    case "span": {
      const inlineContent = serializeInlineChildren(node);
      const fontWeight = node.style.fontWeight;
      const fontStyle = node.style.fontStyle;
      const textDecoration = node.style.textDecoration;

      if (fontWeight === "bold" || Number(fontWeight) >= 600) {
        return `**${inlineContent}**`;
      }

      if (fontStyle === "italic") {
        return `_${inlineContent}_`;
      }

      if (textDecoration.includes("underline")) {
        return `<u>${inlineContent}</u>`;
      }

      return inlineContent;
    }
    default:
      return serializeInlineChildren(node);
  }
}

function serializeInlineChildren(node: ParentNode) {
  return Array.from(node.childNodes)
    .map((childNode) => serializeInlineNode(childNode))
    .join("");
}

function serializeList(list: HTMLElement, ordered: boolean) {
  const items = Array.from(list.children).filter(
    (child): child is HTMLLIElement => child instanceof HTMLLIElement,
  );

  return items
    .map((item, index) => {
      const prefix = ordered ? `${index + 1}. ` : "- ";
      const text = serializeInlineChildren(item).replace(/\n+/g, " ").trim();
      return `${prefix}${text}`;
    })
    .join("\n");
}

function serializeBlockquote(blockquote: HTMLElement) {
  const blockLines = Array.from(blockquote.childNodes)
    .map((childNode) => serializeBlockNode(childNode))
    .filter((value) => value.length > 0)
    .flatMap((value) => value.split("\n"))
    .map((line) => `> ${line}`.trimEnd());

  return blockLines.join("\n");
}

function serializeBlockNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    return text ? escapeMarkdownText(text) : "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();

  switch (tagName) {
    case "h1":
      return `# ${serializeInlineChildren(node).trim()}`;
    case "h2":
      return `## ${serializeInlineChildren(node).trim()}`;
    case "h3":
      return `### ${serializeInlineChildren(node).trim()}`;
    case "blockquote":
      return serializeBlockquote(node);
    case "ul":
      return serializeList(node, false);
    case "ol":
      return serializeList(node, true);
    case "hr":
      return "---";
    case "img": {
      const src = node.getAttribute("src")?.trim();
      return src ? `![](${src})` : "";
    }
    case "pre": {
      const code = node.textContent?.replace(/\n$/, "") ?? "";
      return `\`\`\`\n${code}\n\`\`\``;
    }
    case "p":
    case "div": {
      const content = serializeInlineChildren(node).trim();
      return content;
    }
    default: {
      const content = serializeInlineChildren(node).trim();
      return content;
    }
  }
}

function editorHtmlToMarkdown(html: string) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  const blocks = Array.from(documentNode.body.childNodes)
    .map((childNode) => serializeBlockNode(childNode))
    .filter((value) => value.length > 0);

  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isMeaningfullyEmpty(editor: HTMLElement) {
  const text = editor.textContent?.replace(/\u200B/g, "").trim() ?? "";
  return text.length === 0 && !editor.querySelector("img, hr");
}

function replaceTag(node: Element, tagName: string) {
  const replacement = document.createElement(tagName);
  for (const attribute of Array.from(node.attributes)) {
    replacement.setAttribute(attribute.name, attribute.value);
  }

  while (node.firstChild) {
    replacement.appendChild(node.firstChild);
  }

  node.replaceWith(replacement);
}

function normalizeEditorMarkup(editor: HTMLElement) {
  editor.querySelectorAll("b").forEach((node) => replaceTag(node, "strong"));
  editor.querySelectorAll("i").forEach((node) => replaceTag(node, "em"));
}

function placeCaretAtEnd(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function readEditorSelection(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return null;
  }

  return range.cloneRange();
}

function restoreEditorSelection(editor: HTMLElement, range: Range | null) {
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  if (!range) {
    placeCaretAtEnd(editor);
    return true;
  }

  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function ToolbarButton({
  icon,
  isDisabled,
  isPending = false,
  label,
  onPress,
}: {
  icon: string;
  isDisabled: boolean;
  isPending?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      className="inline-flex h-8 appearance-none items-center gap-2 rounded-xl border border-white/10 bg-[#262626] px-3 text-sm font-medium text-[#ff5f5f] outline-none transition hover:border-white/20 hover:bg-[#303030] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isDisabled}
      type="button"
      onClick={onPress}
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => event.preventDefault()}
    >
      {isPending ? <Spinner color="current" size="sm" /> : <Icon className="h-4 w-4" icon={icon} />}
      <span>{label}</span>
    </button>
  );
}

export type NewsRichEditorHandle = {
  focus: () => void;
};

export const NewsRichEditor = forwardRef<
  NewsRichEditorHandle,
  {
    disabled?: boolean;
    isUploadingImage?: boolean;
    markdown: string;
    minHeightClassName?: string;
    onMarkdownChange: (markdown: string) => void;
    onRequestImageUpload: (file: File) => Promise<string | null>;
    placeholder?: string;
  }
>(function NewsRichEditor(
  {
    disabled = false,
    isUploadingImage = false,
    markdown,
    minHeightClassName = "min-h-[22rem]",
    onMarkdownChange,
    onRequestImageUpload,
    placeholder = "Write the article content here...",
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const lastAppliedMarkdownRef = useRef("");
  const [isEmpty, setIsEmpty] = useState(markdown.trim().length === 0);

  useImperativeHandle(ref, () => ({
    focus() {
      editorRef.current?.focus();
    },
  }));

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (markdown === lastAppliedMarkdownRef.current) {
      return;
    }

    editor.innerHTML = markdownToEditorHtml(markdown);
    normalizeEditorMarkup(editor);
    lastAppliedMarkdownRef.current = markdown;
    setIsEmpty(isMeaningfullyEmpty(editor));
  }, [markdown]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const handleSelectionChange = () => {
      const range = readEditorSelection(editor);
      if (range) {
        selectionRef.current = range;
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const emitMarkdown = () => {
    const editor = editorRef.current;
    if (!editor) {
      return "";
    }

    normalizeEditorMarkup(editor);

    const nextMarkdown = editorHtmlToMarkdown(editor.innerHTML);
    lastAppliedMarkdownRef.current = nextMarkdown;
    onMarkdownChange(nextMarkdown);
    setIsEmpty(isMeaningfullyEmpty(editor));
    return nextMarkdown;
  };

  const withEditorSelection = (callback: () => void) => {
    const editor = editorRef.current;
    if (!editor || disabled) {
      return;
    }

    editor.focus();
    restoreEditorSelection(editor, selectionRef.current);
    callback();
    emitMarkdown();
    selectionRef.current = readEditorSelection(editor);
  };

  const runExecCommand = (command: string, value?: string) => {
    withEditorSelection(() => {
      document.execCommand(command, false, value);
    });
  };

  const insertHtmlAtSelection = (html: string) => {
    withEditorSelection(() => {
      document.execCommand("insertHTML", false, html);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton
          icon="mdi:format-bold"
          isDisabled={disabled}
          label="Bold"
          onPress={() => runExecCommand("bold")}
        />
        <ToolbarButton
          icon="mdi:format-italic"
          isDisabled={disabled}
          label="Italic"
          onPress={() => runExecCommand("italic")}
        />
        <ToolbarButton
          icon="mdi:format-underline"
          isDisabled={disabled}
          label="Underline"
          onPress={() => runExecCommand("underline")}
        />
        <ToolbarButton
          icon="mdi:format-header-1"
          isDisabled={disabled}
          label="H1"
          onPress={() => runExecCommand("formatBlock", "<h1>")}
        />
        <ToolbarButton
          icon="mdi:format-header-2"
          isDisabled={disabled}
          label="H2"
          onPress={() => runExecCommand("formatBlock", "<h2>")}
        />
        <ToolbarButton
          icon="mdi:format-header-3"
          isDisabled={disabled}
          label="H3"
          onPress={() => runExecCommand("formatBlock", "<h3>")}
        />
        <ToolbarButton
          icon="mdi:format-quote-close"
          isDisabled={disabled}
          label="Quote"
          onPress={() => runExecCommand("formatBlock", "<blockquote>")}
        />
        <ToolbarButton
          icon="mdi:format-list-bulleted"
          isDisabled={disabled}
          label="List"
          onPress={() => runExecCommand("insertUnorderedList")}
        />
        <ToolbarButton
          icon="mdi:format-list-numbered"
          isDisabled={disabled}
          label="Numbered"
          onPress={() => runExecCommand("insertOrderedList")}
        />
        <ToolbarButton
          icon="mdi:link-variant"
          isDisabled={disabled}
          label="Link"
          onPress={() => {
            if (typeof window === "undefined") {
              return;
            }

            const editor = editorRef.current;
            if (!editor) {
              return;
            }

            selectionRef.current = readEditorSelection(editor);
            const url = window.prompt("Enter the link URL")?.trim();
            if (!url) {
              return;
            }

            withEditorSelection(() => {
              const selection = window.getSelection();
              const selectedText = selection?.toString().trim() ?? "";

              if (selectedText.length > 0) {
                document.execCommand("createLink", false, url);
                return;
              }

              document.execCommand(
                "insertHTML",
                false,
                `<a href="${escapeAttribute(url)}">link text</a>`,
              );
            });
          }}
        />
        <ToolbarButton
          icon="mdi:minus"
          isDisabled={disabled}
          label="Divider"
          onPress={() => runExecCommand("insertHorizontalRule")}
        />
        <input
          ref={imageInputRef}
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          className="hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            const editor = editorRef.current;
            if (editor) {
              selectionRef.current = readEditorSelection(editor);
            }

            void onRequestImageUpload(file).then((url) => {
              if (url) {
                insertHtmlAtSelection(`<img alt="" src="${escapeAttribute(url)}" />`);
              }

              if (imageInputRef.current) {
                imageInputRef.current.value = "";
              }
            });
          }}
        />
        <ToolbarButton
          icon="mdi:image-plus"
          isDisabled={disabled}
          isPending={isUploadingImage}
          label="Image"
          onPress={() => imageInputRef.current?.click()}
        />
      </div>

      <div className="relative">
        {isEmpty ? (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-white/25">
            {placeholder}
          </div>
        ) : null}
        <div
          ref={editorRef}
          aria-label="Article content"
          className={`${minHeightClassName} w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#101010] px-4 py-3 text-sm text-white outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-4 [&_blockquote]:text-white/75 [&_h1]:mt-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-white/10 [&_img]:my-4 [&_img]:max-h-80 [&_img]:rounded-2xl [&_img]:object-cover [&_li]:ml-6 [&_li]:list-item [&_ol]:my-3 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-white/5 [&_pre]:p-4 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc`}
          contentEditable={!disabled}
          role="textbox"
          spellCheck
          suppressContentEditableWarning
          onBlur={() => {
            const editor = editorRef.current;
            if (!editor) {
              return;
            }

            selectionRef.current = readEditorSelection(editor);
          }}
          onFocus={() => {
            const editor = editorRef.current;
            if (!editor) {
              return;
            }

            selectionRef.current = readEditorSelection(editor);
          }}
          onInput={() => {
            emitMarkdown();
          }}
          onKeyUp={() => {
            const editor = editorRef.current;
            if (!editor) {
              return;
            }

            selectionRef.current = readEditorSelection(editor);
          }}
          onMouseUp={() => {
            const editor = editorRef.current;
            if (!editor) {
              return;
            }

            selectionRef.current = readEditorSelection(editor);
          }}
        />
      </div>
    </div>
  );
});
