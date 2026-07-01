# Bug Hunt Verification

Use this after the suspected fix is in place.

## Required Proof

1. Reproduce the original failure on the old path, or explain why reproduction is no longer possible.
2. Show the updated behavior on the same path.
3. Add or update at least one test that would fail without the fix.
4. Check for the nearest sibling regression:
   - same feature with a different input shape
   - same code path under an empty or error state
   - same behavior in the adjacent environment when relevant
5. State anything still unverified.

## Good Verification Summary

- original failure signal
- proof the failure is gone
- regression test added
- nearby behavior spot-checked
- residual risk
