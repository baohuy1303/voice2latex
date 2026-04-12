"""Post-processing sanitizer for Gemini LaTeX output.

Catches common mistakes that break KaTeX rendering and fixes them
before the output reaches the frontend. Zero latency cost.
"""

import re


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
    # Split on \\ within align and wrap each line in $$
    def convert_align(match: re.Match) -> str:
        body = match.group(1)
        # Remove alignment characters &
        body = body.replace('&', '')
        # Split on \\ (line breaks)
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

    # 6. Remove \label{...} and \tag{...} (unless simple tag)
    latex = re.sub(r'\\label\{[^}]*\}', '', latex)

    # 7. Remove preamble commands that sometimes leak through
    latex = re.sub(r'\\usepackage\{[^}]*\}', '', latex)
    latex = re.sub(r'\\documentclass\{[^}]*\}', '', latex)

    # 8. Fix unmatched braces (simple heuristic: count { and })
    open_count = latex.count('{')
    close_count = latex.count('}')
    if open_count > close_count:
        latex += '}' * (open_count - close_count)
    elif close_count > open_count:
        # Remove trailing extra }
        for _ in range(close_count - open_count):
            idx = latex.rfind('}')
            if idx != -1:
                latex = latex[:idx] + latex[idx + 1:]

    # 9. Clean up excessive blank lines
    latex = re.sub(r'\n{3,}', '\n\n', latex)

    return latex.strip()
