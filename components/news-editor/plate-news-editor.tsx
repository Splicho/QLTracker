"use client"

import {
  type ComponentProps,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import type { TLinkElement, TMediaElement, TSelection } from "platejs"
import {
  ParagraphPlugin,
  Plate,
  PlateContent,
  PlateElement,
  type PlateElementProps,
  type PlateEditor,
  usePlateEditor,
} from "platejs/react"
import {
  BoldPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react"
import { FontColorPlugin, FontSizePlugin } from "@platejs/basic-styles/react"
import { upsertLink } from "@platejs/link"
import { LinkPlugin, useLink } from "@platejs/link/react"
import {
  BulletedListPlugin,
  ListItemContentPlugin,
  ListItemPlugin,
  ListPlugin,
  NumberedListPlugin,
} from "@platejs/list-classic/react"
import {
  deserializeMd,
  MarkdownPlugin,
  remarkMdx,
  serializeMd,
} from "@platejs/markdown"
import { insertImage } from "@platejs/media"
import { ImagePlugin } from "@platejs/media/react"
import remarkGfm from "remark-gfm"

import { PlateNewsEditorLinkModal } from "@/components/news-editor/plate-news-editor-link-modal"
import { PlateNewsEditorToolbar } from "@/components/news-editor/plate-news-editor-toolbar"
import { cn } from "@/lib/utils"

/** GFM + MDX so font marks (color, size, etc.) can stringify as `<span style="…">` without errors. */
const newsRemarkPlugins = [remarkGfm, remarkMdx]

const DEFAULT_VALUE = [
  {
    children: [{ text: "" }],
    type: "p",
  },
]

function ParagraphElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="p"
      className="min-h-[1.125rem] text-sm leading-snug text-white/88 [&:not(:last-child)]:mb-1"
    />
  )
}

function HeadingElement({
  className,
  level,
  ...props
}: PlateElementProps & {
  level: "h1" | "h2" | "h3"
}) {
  const sizeClassName =
    level === "h1"
      ? "text-3xl leading-tight font-semibold tracking-tight"
      : level === "h2"
        ? "text-2xl leading-tight font-semibold tracking-tight"
        : "text-xl leading-snug font-semibold"
  const spacingClassName =
    level === "h1"
      ? "mt-7 mb-3 first:mt-0"
      : level === "h2"
        ? "mt-6 mb-2 first:mt-0"
        : "mt-5 mb-1.5 first:mt-0"

  return (
    <PlateElement
      {...props}
      as={level}
      className={cn("text-white", sizeClassName, spacingClassName, className)}
    />
  )
}

function HorizontalRuleElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} as="div" className="my-4">
      <div contentEditable={false}>
        <hr className="border-white/10" />
      </div>
      {props.children}
    </PlateElement>
  )
}

function BulletedListElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="ul"
      className="mb-3 list-disc pl-6 text-white/88"
    />
  )
}

function NumberedListElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="ol"
      className="mb-3 list-decimal pl-6 text-white/88"
    />
  )
}

function ListItemElement(props: PlateElementProps) {
  return <PlateElement {...props} as="li" className="mb-1 last:mb-0" />
}

function ListItemContentElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="div"
      className="min-h-[1.125rem] text-sm leading-snug text-white/88"
    />
  )
}

function LinkElement(props: PlateElementProps<TLinkElement>) {
  const { props: linkProps } = useLink({ element: props.element })

  return (
    <PlateElement
      {...props}
      {...linkProps}
      as="a"
      className="cursor-pointer text-white underline underline-offset-4"
    />
  )
}

function ImageElement(props: PlateElementProps<TMediaElement>) {
  return (
    <PlateElement {...props} as="div" className="my-4">
      <div contentEditable={false}>
        <img
          alt=""
          className="max-h-[28rem] w-full rounded-2xl border border-white/10 object-cover"
          src={props.element.url}
        />
      </div>
      {props.children}
    </PlateElement>
  )
}

function createEditorPlugins() {
  return [
    ParagraphPlugin.withComponent(ParagraphElement),
    BoldPlugin,
    ItalicPlugin,
    UnderlinePlugin,
    FontColorPlugin,
    FontSizePlugin,
    H1Plugin,
    H2Plugin,
    H3Plugin,
    HorizontalRulePlugin,
    H1Plugin.withComponent((props: PlateElementProps) => (
      <HeadingElement {...props} level="h1" />
    )),
    H2Plugin.withComponent((props: PlateElementProps) => (
      <HeadingElement {...props} level="h2" />
    )),
    H3Plugin.withComponent((props: PlateElementProps) => (
      <HeadingElement {...props} level="h3" />
    )),
    HorizontalRulePlugin.withComponent(HorizontalRuleElement),
    LinkPlugin.configure({
      options: {
        defaultLinkAttributes: {
          rel: "noreferrer",
          target: "_blank",
        },
      },
      render: {
        node: LinkElement,
      },
    }),
    ListPlugin,
    BulletedListPlugin.withComponent(BulletedListElement),
    NumberedListPlugin.withComponent(NumberedListElement),
    ListItemPlugin.withComponent(ListItemElement),
    ListItemContentPlugin.withComponent(ListItemContentElement),
    ImagePlugin.configure({
      options: {
        disableEmbedInsert: true,
        disableUploadInsert: true,
      },
      render: {
        node: ImageElement,
      },
    }),
    MarkdownPlugin.configure({
      options: {
        remarkPlugins: newsRemarkPlugins,
      },
    }),
  ]
}

function deserializeMarkdown(editor: PlateEditor, markdown: string) {
  const value = deserializeMd(editor, markdown, {
    preserveEmptyParagraphs: true,
    remarkPlugins: newsRemarkPlugins,
  })

  return value.length > 0 ? value : DEFAULT_VALUE
}

function serializeMarkdown(editor: PlateEditor) {
  return serializeMd(editor, {
    preserveEmptyParagraphs: true,
    remarkPlugins: newsRemarkPlugins,
  })
}

export type PlateNewsEditorHandle = {
  focus: () => void
}

type PlateNewsEditorProps = {
  disabled?: boolean
  isUploadingImage?: boolean
  markdown: string
  minHeightClassName?: string
  onMarkdownChange: (markdown: string) => void
  onRequestImageUpload: (file: File) => Promise<string | null>
}

export const PlateNewsEditor = forwardRef<
  PlateNewsEditorHandle,
  PlateNewsEditorProps
>(function PlateNewsEditor(
  {
    disabled,
    isUploadingImage = false,
    markdown,
    minHeightClassName = "h-[32rem]",
    onMarkdownChange,
    onRequestImageUpload,
  },
  ref
) {
  const plugins = useMemo(() => createEditorPlugins(), [])
  const editor = usePlateEditor(
    {
      plugins,
      value: (nextEditor) => deserializeMarkdown(nextEditor, markdown),
    },
    [plugins]
  )
  const contentRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef<TSelection | null>(null)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const activeMarks = editor.api.marks() ?? {}
  const activeColor =
    typeof activeMarks.color === "string" ? activeMarks.color : null
  const activeFontSize =
    typeof activeMarks.fontSize === "string" ? activeMarks.fontSize : null

  // Only replace the editor when the `markdown` prop truly differs from what the
  // editor would serialize (external updates: load article, save response). Do not
  // compare to a ref updated in onValueChange — that can race parent state and call
  // setValue while the prop is still one keystroke behind, which eats Space and jitters layout.
  useEffect(() => {
    if (!editor) {
      return
    }

    let serialized: string
    try {
      serialized = serializeMarkdown(editor)
    } catch {
      return
    }

    if (serialized === markdown) {
      return
    }

    editor.tf.setValue(deserializeMarkdown(editor, markdown))
  }, [editor, markdown])

  const storeSelection = () => {
    selectionRef.current = editor.selection
  }

  const restoreSelection = () => {
    if (!selectionRef.current) {
      return
    }

    editor.tf.select(selectionRef.current)
  }

  const handleImageUpload = async (file: File) => {
    const uploadedUrl = await onRequestImageUpload(file)
    if (!uploadedUrl) {
      return
    }

    restoreSelection()
    insertImage(editor, uploadedUrl)
    contentRef.current?.focus()
  }

  const applyTextColor = (value: string | null) => {
    restoreSelection()
    if (value) {
      editor.tf.addMark("color", value)
    } else {
      editor.tf.removeMark("color")
    }
    contentRef.current?.focus()
  }

  const applyTextSize = (value: string | null) => {
    restoreSelection()
    if (value) {
      editor.tf.addMark("fontSize", value)
    } else {
      editor.tf.removeMark("fontSize")
    }
    contentRef.current?.focus()
  }

  useImperativeHandle(ref, () => ({
    focus: () => {
      contentRef.current?.focus()
    },
  }))

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
        <PlateNewsEditorToolbar
          activeColor={activeColor}
          activeFontSize={activeFontSize}
          applyTextColor={applyTextColor}
          applyTextSize={applyTextSize}
          disabled={disabled}
          editor={editor}
          isUploadingImage={isUploadingImage}
          onOpenLinkDialog={() => setIsLinkModalOpen(true)}
          onStoreSelection={storeSelection}
          onUploadImage={handleImageUpload}
        />

        <Plate
          editor={editor}
          readOnly={disabled}
          onValueChange={() => {
            try {
              onMarkdownChange(serializeMarkdown(editor))
            } catch {
              /* avoid breaking typing if serialize throws mid-edit */
            }
          }}
        >
          {/* Native overflow instead of Radix ScrollArea: ScrollArea’s viewport handles Space for
              scrolling and blocks inserting spaces in the contenteditable editor. */}
          <div
            className={cn(
              "w-full overflow-y-auto overscroll-contain",
              minHeightClassName
            )}
          >
            <div className="flex min-h-full w-full flex-col">
              <PlateContent
                ref={contentRef}
                className="flex min-h-full w-full flex-1 flex-col bg-transparent px-4 py-3 text-sm leading-snug break-words whitespace-pre-wrap text-white [caret-color:white] outline-none [&_.slate-selected]:bg-white/10 [&_[data-slate-leaf]]:!inline [&_[data-slate-node='text']]:!inline [&_[data-slate-node='text']]:!min-w-0 [&_[data-slate-string]]:!inline [&_em]:italic [&_strong]:inline [&_strong]:font-semibold [&_u]:underline [&_u]:underline-offset-4"
                disableDefaultStyles
                placeholder="Write your article..."
              />
            </div>
          </div>
        </Plate>
      </div>

      <PlateNewsEditorLinkModal
        key={isLinkModalOpen ? `open:${markdown.length}` : "closed"}
        defaultText=""
        defaultUrl=""
        open={isLinkModalOpen}
        onOpenChange={setIsLinkModalOpen}
        onSubmit={({ text, url }) => {
          restoreSelection()
          upsertLink(editor, {
            target: "_blank",
            text: text || undefined,
            url,
          })
          setIsLinkModalOpen(false)
          contentRef.current?.focus()
        }}
      />
    </>
  )
})

export const NewsRichEditor = forwardRef<
  PlateNewsEditorHandle,
  ComponentProps<typeof PlateNewsEditor>
>(function NewsRichEditor(props, ref) {
  return <PlateNewsEditor {...props} ref={ref} />
})
