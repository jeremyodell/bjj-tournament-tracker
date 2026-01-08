# Subagents in Claude Code Are Awesome... Until They Start Having Children

*How I spent 4 million tokens on 3 simple coding tasks*

## The Setup

I built a Claude Code plugin to orchestrate parallel development. Feed it a parent ticket with sub-tasks, and it spawns agents to work on independent tasks simultaneously. Ship faster, right?

Last night I tested it on three simple tickets:
- **ODE-44**: Add cross-org gym search (1 query function)
- **ODE-45**: Add 3 fields to a TypeScript type
- **ODE-46**: Create a scheduled Lambda

Total complexity? Maybe 100 lines of code. A senior dev knocks this out before lunch.

## The Bill

**Expected:** ~1.5 million tokens
**Actual:** 4 million tokens

At Claude Sonnet rates, that's ~$15-20 instead of ~$5-8. At Opus rates? $75-100 instead of $25-30.

For adding three fields to a type.

## The Investigation

I dug into the plugin architecture. Here's what I found:

### How It Should Work

Three agents, each with ~500k token context. Parallel execution, shared cost. Total: ~1.5M tokens.

![Expected Architecture](/images/subagent-expected.png)

### What Actually Happened

Each agent ran a workflow that included a "quality gate" phase. That phase spawned a code review agent. Inside each subagent.

Three agents became six. Each with full context duplication. Total: ~4M tokens.

![Actual Architecture](/images/subagent-actual.png)

## Why This Hurts

Subagents aren't threads. They're not lightweight. Every subagent gets:
- Full system prompt (~15k tokens)
- All plugin instructions (~50k tokens)
- Project context and CLAUDE.md (~5k tokens)
- Conversation history

That's ~70-80k tokens just to *start*. Before any actual work.

Then there's the **triangle accumulation problem**. Every tool call includes all previous context:

```
Call 1:  80k context
Call 2:  85k context
Call 3:  90k context
...
Call 30: 230k context
```

The tokens compound. For a 30-call task, you're looking at roughly:

```
(80k + 230k) × 30 / 2 = ~4.6M tokens
```

Per agent.

Nest agents inside agents? Multiply that.

## The Real Kicker

My tasks were *trivial*. ODE-45 was literally "add 3 fields to a TypeScript interface."

But the workflow didn't know that. It ran:
- **Brainstorm phase**: "Consider 2-3 alternative approaches" (for adding 3 fields?)
- **Planning phase**: "Create acceptance criteria" (for adding 3 fields?)
- **Quality gate**: Spawn a fresh code review agent (for adding 3 fields?)

Every task got the enterprise treatment. The 3-line change got the same ceremony as a full feature rewrite.

## The Lessons

### 1. Subagents Are Not Free Parallelism

Sequential: 1 agent × 3 tasks = ~1.5M tokens
Parallel: 3 agents × 1 task = ~1.5M tokens

Same cost. Parallel is just faster.

But nested? 6 agents = 4M tokens. You're paying a premium for architectural overhead.

### 2. Complexity Should Gate Workflow

Not every task needs:
- Design brainstorming
- Detailed planning
- Independent code review

A smart orchestrator would detect: "This is 10 lines of code. Skip the ceremony."

### 3. Never Nest Agents

If Agent A spawns Agent B, you've doubled your context cost. If Agent B spawns Agent C? Tripled.

Code review inside a subagent should run inline, not spawn another agent.

### 4. Batch Trivial Work

Three simple tasks shouldn't need three agents. One agent doing all three sequentially costs the same and avoids coordination overhead.

## The Fix

I'm updating the plugin with complexity-based routing:

```typescript
if (task.estimatedLines < 50 && task.files < 3) {
  // Skip brainstorm/plan phases
  // Run code review inline
  // Consider batching with other simple tasks
}
```

Simple tasks get simple treatment. Complex tasks get the full workflow.

## The Takeaway

Subagents are powerful. Parallel execution is valuable. But know the cost model:

| Approach | Tokens | Cost (Sonnet) |
|----------|--------|---------------|
| Sequential, no workflow | ~1.5M | ~$5-8 |
| Parallel, no nesting | ~1.5M | ~$5-8 |
| Parallel + nested agents | ~4M | ~$15-20 |
| Optimal (smart routing) | ~500k | ~$2-3 |

The difference between optimal and what I ran? **8x overhead.**

Know your tools. Measure before you scale. And for the love of tokens, don't let your agents have children.

---

*Have you hit any surprising AI costs? I'd love to hear your war stories. Connect with me on [LinkedIn](https://linkedin.com/in/yourprofile) or check out more at [standingbear.ai](https://standingbear.ai).*
