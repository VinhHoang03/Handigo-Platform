---
name: parallel-agents
description: Use only when the user explicitly wants delegation, subagents, or parallel task decomposition across independent workstreams.
---

# Native Parallel Agents

> Orchestration through Codex subagents and bounded parallel work

## Overview

This skill enables coordinating multiple specialized subagents through Codex-native delegation. Unlike external orchestration scripts, this approach keeps planning, delegation, and synthesis inside the same Codex workflow.

## When to Use Orchestration

✅ **Good for:**
- Complex tasks requiring multiple expertise domains
- Code analysis from security, performance, and quality perspectives
- Comprehensive reviews (architecture + security + testing)
- Feature implementation needing backend + frontend + database work

❌ **Not for:**
- Simple, single-domain tasks
- Quick fixes or small changes
- Tasks where one agent suffices

---

## Native Agent Invocation

### Single Agent
```
Use the security_auditor subagent to review authentication
```

### Sequential Chain
```
First, use the explorer subagent to discover project structure.
Then, use the backend_specialist subagent to review API endpoints.
Finally, use the test_writer subagent to identify test gaps.
```

### With Context Passing
```
Use the frontend_specialist subagent to analyze React components.
Based on those findings, have the test_writer subagent generate component tests.
```

### Resume Previous Work
```
Resume agent [agentId] and continue with additional requirements.
```

---

## Orchestration Patterns

### Pattern 1: Comprehensive Analysis
```
Agents: explorer → [domain-subagents] → synthesis

1. explorer: Map codebase structure
2. security_auditor: Security posture
3. backend_specialist: API quality
4. frontend_specialist: UI/UX patterns
5. test_writer: Test coverage
6. Synthesize all findings
```

### Pattern 2: Feature Review
```
Agents: affected-domain-subagents → test_writer

1. Identify affected domains (backend? frontend? both?)
2. Invoke relevant domain subagents
3. test_writer verifies changes
4. Synthesize recommendations
```

### Pattern 3: Security Audit
```
Agents: security_auditor → reviewer or backend_specialist → synthesis

1. security_auditor: Configuration and code review
2. reviewer or backend_specialist: Confirm impact in changed code paths
3. Synthesize with prioritized remediation
```

---

## Available Subagents

| Subagent | Expertise | Trigger Phrases |
|-------|-----------|-----------------|
| `planner` | Planning | "plan", "roadmap", "milestones" |
| `explorer` | Discovery | "explore", "map", "structure" |
| `security_auditor` | Security | "security", "auth", "vulnerabilities" |
| `backend_specialist` | Backend | "API", "server", "Node.js", "Express" |
| `frontend_specialist` | Frontend | "React", "UI", "components", "Next.js" |
| `test_writer` | Testing | "tests", "coverage", "TDD" |
| `devops_engineer` | DevOps | "deploy", "CI/CD", "infrastructure" |
| `database_architect` | Database | "schema", "Prisma", "migrations" |
| `mobile_developer` | Mobile | "React Native", "Flutter", "mobile" |
| `debugger` | Debugging | "bug", "error", "not working" |
| `documentation_writer` | Documentation | "write docs", "create README", "generate API docs" |
| `performance_optimizer` | Performance | "slow", "optimize", "profiling" |
| `seo_specialist` | SEO | "SEO", "meta tags", "search ranking" |
| `reviewer` | Review | "review", "regression", "correctness" |
| `docs_researcher` | External docs | "docs", "API behavior", "framework docs" |

---

## Built-in Generalists

These can work alongside specialized subagents:

| Agent | Model | Purpose |
|-------|-------|---------|
| **Explore-like read-only agent** | lightweight model | Fast read-only repository search |
| **Planning-focused agent** | reasoning-oriented model | Research during planning |
| **General-purpose agent** | coding model | Complex multi-step modifications |

Use generalist discovery for quick searches, and specialized subagents for domain-specific analysis or implementation.

---

## Synthesis Protocol

After all agents complete, synthesize:

```markdown
## Orchestration Synthesis

### Task Summary
[What was accomplished]

### Agent Contributions
| Agent | Finding |
|-------|---------|
| security_auditor | Found X |
| backend_specialist | Identified Y |

### Consolidated Recommendations
1. **Critical**: [Issue from Agent A]
2. **Important**: [Issue from Agent B]
3. **Nice-to-have**: [Enhancement from Agent C]

### Action Items
- [ ] Fix critical security issue
- [ ] Refactor API endpoint
- [ ] Add missing tests
```

---

## Best Practices

1. **Available subagents** - Orchestrate only the roles that materially improve the task
2. **Logical order** - Discovery → Analysis → Implementation → Testing
3. **Share context** - Pass relevant findings to subsequent agents
4. **Single synthesis** - One unified report, not separate outputs
5. **Verify changes** - Include `test_writer` or another validation-oriented subagent for code modifications when useful

---

## Key Benefits

- ✅ **Single session** - All agents share context
- ✅ **Codex-controlled** - Orchestration stays inside the same Codex workflow
- ✅ **Native integration** - Works with repository skills, workflows, and subagents
- ✅ **Resume support** - Can continue previous agent work
- ✅ **Context passing** - Findings flow between agents
