import json
import sys

from pypdf import PdfReader


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing_pdf_path"}))
        return 1

    pdf_path = sys.argv[1]

    try:
        reader = PdfReader(pdf_path)
        text_parts = []

        for page in reader.pages:
            try:
                text_parts.append(page.extract_text() or "")
            except Exception:
                text_parts.append("")

        print(
            json.dumps(
                {
                    "text": "\n".join(text_parts),
                    "pageCount": len(reader.pages),
                },
                ensure_ascii=False,
            )
        )
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
