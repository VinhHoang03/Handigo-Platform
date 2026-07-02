# Brainstorm Workflow

Use this workflow for vague feature requests, strategy questions, or architecture exploration.

## Goal

Explore viable directions before committing to implementation. This workflow should reduce ambiguity, not produce code.

## When To Use

- the request is exploratory or under-specified
- the user asks for options, tradeoffs, or recommendations
- architecture or product direction is still open

## Process

1. Restate the goal, audience, and success criteria.
2. Surface missing assumptions:
   - user type
   - constraints
   - non-goals
   - timeline or effort tolerance
3. Present 2-4 realistic options.
4. For each option, include:
   - what it is
   - where it fits
   - key advantages
   - key drawbacks
   - rough implementation effort
5. Recommend one direction and explain why.
6. End with the next decision required to move into `plan` or `create`.

## Output Shape

- short context summary
- option list with tradeoffs
- clear recommendation
- one next-step question or decision

## Rules

- avoid writing code unless the user explicitly pivots to implementation
- do not hide meaningful tradeoffs
- prefer concrete options over abstract principles
- if one option is clearly dominant, say so directly
