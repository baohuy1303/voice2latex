"""Post-processing sanitizer for Gemini LaTeX output.

Catches common mistakes that break KaTeX rendering and fixes them
before the output reaches the frontend. Zero latency cost.
"""

import re


def _fix_braces_in_block(block: str) -> str:
    """Fix unmatched braces within a single $$ block."""
    open_count = block.count('{')
    close_count = block.count('}')
    if open_count > close_count:
        block += '}' * (open_count - close_count)
    elif close_count > open_count:
        for _ in range(close_count - open_count):
            idx = block.rfind('}')
            if idx != -1:
                block = block[:idx] + block[idx + 1:]
    return block


def sanitize_latex(latex: str) -> str:
    """Fix common KaTeX-incompatible patterns in LaTeX output."""

    # 1. Convert \[...\] display math to $$...$$
    latex = re.sub(r'\\\[', '$$', latex)
    latex = re.sub(r'\\\]', '$$', latex)

    # 2. Remove spacing hacks like \[1em], \[2em], \[0.5em]
    latex = re.sub(r'\\\[\d+(\.\d+)?\s*em\]', '\n\n', latex)

    # 3. Remove \vspace{...}, \hspace{...}, \newpage
    latex = re.sub(r'\\vspace\{[^}]*\}', '\n\n', latex)
    latex = re.sub(r'\\hspace\{[^}]*\}', ' ', latex)
    latex = re.sub(r'\\newpage', '', latex)

    # 4. Convert \begin{equation}...\end{equation} to $$...$$
    latex = re.sub(
        r'\\begin\{equation\*?\}(.*?)\\end\{equation\*?\}',
        r'$$\1$$',
        latex,
        flags=re.DOTALL,
    )

    # 5. Convert \begin{align}...\end{align} to separate $$ blocks
    def convert_align(match: re.Match) -> str:
        body = match.group(1)
        body = body.replace('&', '')
        lines = re.split(r'\\\\', body)
        result = []
        for line in lines:
            line = line.strip()
            if line:
                result.append(f"$${line}$$")
        return '\n\n'.join(result)

    latex = re.sub(
        r'\\begin\{align\*?\}(.*?)\\end\{align\*?\}',
        convert_align,
        latex,
        flags=re.DOTALL,
    )

    # 6. Remove \label{...}
    latex = re.sub(r'\\label\{[^}]*\}', '', latex)

    # 7. Remove preamble commands
    latex = re.sub(r'\\usepackage\{[^}]*\}', '', latex)
    latex = re.sub(r'\\documentclass\{[^}]*\}', '', latex)

    # 8. Fix \text{} blocks that contain unbalanced braces — a common Gemini mistake
    # e.g., $$\text{Step 1: Isolate the } x^2 \text{ term}}$$ -> pull text out
    # Remove $$ blocks that are purely text descriptions (no actual math)
    def clean_text_only_blocks(match: re.Match) -> str:
        content = match.group(1).strip()
        # If the block is just \text{...} with no math, convert to plain text
        stripped = re.sub(r'\\text\{([^}]*)\}', r'\1', content).strip()
        # Check if there's any remaining LaTeX commands
        if not re.search(r'[\\^_{}]', stripped):
            return stripped
        return f"$${content}$$"

    latex = re.sub(r'\$\$((?:\\text\{[^}]*\}\s*)+)\$\$', clean_text_only_blocks, latex)

    # 9. Fix braces within each $$ block individually
    parts = latex.split('$$')
    fixed_parts = []
    for i, part in enumerate(parts):
        if i % 2 == 1:  # Inside $$ block (math content)
            fixed_parts.append(_fix_braces_in_block(part))
        else:
            fixed_parts.append(part)
    latex = '$$'.join(fixed_parts)

    # 10. Remove duplicate $$ (e.g., $$$$ from bad concatenation)
    latex = re.sub(r'\${3,}', '$$', latex)

    # 11. Clean up excessive blank lines
    latex = re.sub(r'\n{3,}', '\n\n', latex)

    return latex.strip()
