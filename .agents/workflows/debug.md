# Debug Workflow

Use this workflow for failures, regressions, and unclear runtime behavior.

## Goal

Move from symptom to confirmed failure mode before changing code.

## Recommended Skill Bundle

- `bug-hunt` for investigation discipline and proof requirements
- `debugging` for evidence gathering
- `systematic-debugging` when multiple hypotheses compete
- `testing-patterns` when the bug should end in a regression test

## Process

1. Reproduce the issue or state why reproduction is blocked.
2. Capture evidence:
   - logs
   - exact error messages
   - failing tests
   - inputs and environment
   - expected vs actual behavior
3. Identify the most likely failure boundary.
4. Form and rank hypotheses.
5. Test hypotheses one by one until the root cause is confirmed.
6. Fix only after the failure mode is understood.
7. Add or update tests when the bug is now well defined.

## Debug Output Should Separate

- symptom
- evidence gathered
- hypotheses considered
- confirmed root cause
- applied fix
- prevention or follow-up

## Rules

- do not jump straight to code changes
- prefer a small fix for the confirmed bug over a speculative rewrite
- if reproduction is impossible, say what signal is missing
- if a fix lands, use the closest verification path from `bug-hunt/verify.md`
