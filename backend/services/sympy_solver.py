"""SymPy math solver functions registered as Vertex AI tools."""

import sympy
from sympy.parsing.sympy_parser import parse_expr


def _parse_input(latex_expr: str, sympy_expr: str | None = None) -> sympy.Expr:
    """Parse input to a SymPy expression. Try sympy_expr fallback first (more reliable)."""
    if sympy_expr:
        try:
            return parse_expr(sympy_expr)
        except Exception:
            pass

    # Try parsing LaTeX
    try:
        from sympy.parsing.latex import parse_latex
        return parse_latex(latex_expr)
    except Exception:
        pass

    # Last resort: try as a SymPy string
    return parse_expr(latex_expr)


def solve_equation(
    equation_latex: str,
    variable: str = "x",
    sympy_expression: str | None = None,
) -> dict:
    """Solve an equation for a given variable."""
    try:
        var = sympy.Symbol(variable)

        if sympy_expression:
            expr = parse_expr(sympy_expression)
        else:
            expr = _parse_input(equation_latex)

        # If it's an Equality, solve it directly; otherwise assume = 0
        if isinstance(expr, sympy.Equality):
            solutions = sympy.solve(expr, var)
        else:
            solutions = sympy.solve(expr, var)

        solution_latex = ", ".join(sympy.latex(s) for s in solutions)
        steps = [
            f"Given: ${equation_latex}$",
            f"Solving for ${variable}$",
            f"Solutions: ${solution_latex}$",
        ]

        return {
            "success": True,
            "solution_latex": solution_latex,
            "steps": steps,
            "num_solutions": len(solutions),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def simplify_expression(
    expression_latex: str,
    sympy_expression: str | None = None,
) -> dict:
    """Simplify a mathematical expression."""
    try:
        expr = _parse_input(expression_latex, sympy_expression)
        simplified = sympy.simplify(expr)

        return {
            "success": True,
            "result_latex": sympy.latex(simplified),
            "original_latex": expression_latex,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def differentiate(
    expression_latex: str,
    variable: str = "x",
    sympy_expression: str | None = None,
) -> dict:
    """Differentiate an expression with respect to a variable."""
    try:
        expr = _parse_input(expression_latex, sympy_expression)
        var = sympy.Symbol(variable)
        derivative = sympy.diff(expr, var)

        return {
            "success": True,
            "result_latex": sympy.latex(derivative),
            "steps": [
                f"$\\frac{{d}}{{d{variable}}} \\left( {expression_latex} \\right)$",
                f"$= {sympy.latex(derivative)}$",
            ],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def integrate(
    expression_latex: str,
    variable: str = "x",
    lower_bound: str | None = None,
    upper_bound: str | None = None,
    sympy_expression: str | None = None,
) -> dict:
    """Integrate an expression, optionally with bounds (definite integral)."""
    try:
        expr = _parse_input(expression_latex, sympy_expression)
        var = sympy.Symbol(variable)

        if lower_bound is not None and upper_bound is not None:
            lo = parse_expr(lower_bound)
            hi = parse_expr(upper_bound)
            result = sympy.integrate(expr, (var, lo, hi))
            steps = [
                f"$\\int_{{{lower_bound}}}^{{{upper_bound}}} {expression_latex} \\, d{variable}$",
                f"$= {sympy.latex(result)}$",
            ]
        else:
            result = sympy.integrate(expr, var)
            steps = [
                f"$\\int {expression_latex} \\, d{variable}$",
                f"$= {sympy.latex(result)} + C$",
            ]

        return {
            "success": True,
            "result_latex": sympy.latex(result),
            "steps": steps,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# Map of tool names to functions for dispatch
TOOL_FUNCTIONS = {
    "solve_equation": solve_equation,
    "simplify_expression": simplify_expression,
    "differentiate": differentiate,
    "integrate": integrate,
}
