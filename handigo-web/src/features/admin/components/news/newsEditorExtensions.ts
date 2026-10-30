import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { isSafeNewsLink } from "@/features/content/utils/newsRichContent";

export const newsEditorExtensions = () => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] }, code: false, codeBlock: false,
    link: { openOnClick: false, defaultProtocol: "https", isAllowedUri: isSafeNewsLink },
    bulletList: { keepMarks: true }, orderedList: { keepMarks: true },
  }),
  TextStyleKit,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];
