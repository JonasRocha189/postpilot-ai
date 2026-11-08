"""Split a document's text into overlapping chunks for the RAG.

Sizes are in characters (roughly 4 per token in Portuguese and English), so no
tokenizer is needed: 1,200 characters is about 300 tokens, small enough for a
precise search and big enough to keep a paragraph's context. The overlap
repeats the end of a chunk at the start of the next one, so an idea cut at the
border still appears whole in one of them.
"""

import re

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def normalize(text: str) -> str:
    """Clean extracted text: one space between words, at most one blank line."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split the text into chunks of at most `size` characters, each overlapping the previous."""
    if not 0 <= overlap < size:
        raise ValueError("overlap must be at least 0 and smaller than size")
    chunks: list[str] = []
    current = ""
    # Pieces leave room for the overlap, so `tail + piece` always fits in `size`
    for piece in _pieces(normalize(text), size - overlap - 1):
        candidate = f"{current}\n{piece}" if current else piece
        if len(candidate) <= size:
            current = candidate
            continue
        chunks.append(current)
        tail = _tail(current, overlap)
        current = f"{tail} {piece}" if tail else piece
    if current:
        chunks.append(current)
    return chunks


def _pieces(text: str, limit: int) -> list[str]:
    """Paragraphs; one longer than `limit` is split at sentence ends, then between words."""
    pieces: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            continue
        if len(paragraph) <= limit:
            pieces.append(paragraph)
            continue
        for sentence in _SENTENCE_END.split(paragraph):
            if len(sentence) <= limit:
                pieces.append(sentence)
            else:
                pieces.extend(_split_words(sentence, limit))
    return pieces


def _split_words(text: str, limit: int) -> list[str]:
    """Split between words; a single "word" longer than `limit` (a URL, say) is cut."""
    parts: list[str] = []
    current = ""
    for word in text.split(" "):
        while len(word) > limit:
            if current:
                parts.append(current)
                current = ""
            parts.append(word[:limit])
            word = word[limit:]
        candidate = f"{current} {word}" if current else word
        if len(candidate) <= limit:
            current = candidate
        else:
            parts.append(current)
            current = word
    if current:
        parts.append(current)
    return parts


def _tail(text: str, overlap: int) -> str:
    """The last `overlap` characters of a chunk, starting at a word boundary."""
    if overlap == 0:
        return ""
    tail = text[-overlap:]
    if len(text) <= overlap:
        return tail
    space = tail.find(" ")
    return tail[space + 1 :] if space != -1 else tail
