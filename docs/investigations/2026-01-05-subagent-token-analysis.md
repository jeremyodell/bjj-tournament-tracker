# Subagent Token Usage Investigation

**Date:** 2026-01-05
**Goal:** Understand why running 3 simple tasks as parallel subagents consumed ~4M tokens

## The Incident

Used `/team:feature` plugin to run 3 sub-tasks in parallel:

| Ticket | Description | Complexity |
|--------|-------------|------------|
| Task A | Cross-Org Search API | Simple - 1 query function + handler update |
| Task B | Add Type Fields | Trivial - Add 3 fields to a type |
| Task C | Scheduled Lambda | Moderate - New Lambda + EventBridge |

**Expected tokens:** ~300-500k total
**Actual tokens:** ~4M (10x expected)

## Hypothesis

The token explosion could be caused by:
1. Context duplication across 3 parallel subagents
2. Conversation accumulation (triangle problem) within each agent
3. Over-engineered workflow phases for simple tasks
4. Nested agent spawning (/code-review inside each task)
5. Unknown bug or loop in the plugin

## Baseline Test

### Test Setup
- Run equivalent of Task B (simplest task) manually
- Track tool calls and approximate token usage
- Compare to what parallel execution would cost

### Task B Description
> Add `gymSourceId`, `gymName`, `masterGymId` fields to frontend Athlete type.
> Update backend athlete handler tests for gym field persistence.

---

## Baseline Results

### Manual Execution (No Workflow)

**Duration:** ~1 minute
**Tool Calls:** 8

#### Steps Taken:
1. Grep for Athlete interface location
2. Grep for existing gym fields in frontend
3. Grep for gym fields in backend (to understand full scope)
4. Read api.ts to see current Athlete interface
5. Edit api.ts to add 3 fields
6. Run `npm run build` to verify types
7. Revert change (test only)

#### Token Estimate (Manual Task)

Using triangle accumulation formula:
- Starting context: ~50-80k tokens (system prompt + plugins + CLAUDE.md)
- 8 tool calls, each adding ~3-5k tokens
- Final context: ~90-100k tokens

**Estimated tokens for Task B equivalent: ~400-600k**

### Projected Costs

| Approach | Tasks | Token Estimate |
|----------|-------|----------------|
| Sequential (1 agent, no workflow) | 3 | ~1.2-1.8M |
| Parallel (3 subagents, no workflow) | 3 | ~1.2-1.8M |
| Parallel with `/team:task` workflow | 3 | ??? |

---

## The Mystery: Where Did 4M Tokens Go?

The baseline shows ~500k per simple task. Even with 3 parallel agents, we'd expect ~1.5M max.

**4M tokens means something is adding 2.5M+ in overhead.**

### What `/team:task` Adds (per task)

Looking at the workflow phases:

| Phase | Actions | Est. Token Impact |
|-------|---------|-------------------|
| 0. Setup | Linear API, git branch | +50k |
| 1. Brainstorm | Design thinking, 2-3 alternatives | +200k |
| 2. Plan | Task breakdown, acceptance criteria | +150k |
| 3. Execute | TDD implementation | +300k |
| 4. Quality | npm test, lint, typecheck, /code-review | +300k |
| 5. Ship | Commit, push, PR, Linear update | +100k |

**Per-task overhead from workflow: ~1.1M tokens**

### The Real Culprit: Nested `/code-review`

Phase 4 runs `/code-review` which may spawn ANOTHER agent inside each subagent.

If `/code-review` spawns a fresh agent:
- 3 subagents × 1 nested agent each = 6 total agents
- Each with full context duplication
- 6 × 500k = 3M tokens just for nested reviews

**This explains the 4M.**

---

## Key Findings

### 1. Simple Tasks Don't Need Full Workflow
Task B (add 3 fields) took 8 tool calls manually. The workflow adds:
- Brainstorm phase for adding fields (unnecessary)
- Plan phase with acceptance criteria (unnecessary)
- Full quality check with /code-review (overkill)

### 2. Nested Agent Spawning is Exponential
Each subagent spawning another agent for /code-review doubles the agent count.

### 3. Context Accumulation is Multiplicative, Not Additive
- 1 agent doing 3 tasks: ~1.5M tokens
- 3 agents doing 1 task each: ~1.5M tokens (same, just faster)
- 3 agents with nested /code-review: ~4M tokens (2.5x overhead!)

---

## Recommendations

### Immediate (Plugin Fix)

1. **Add complexity scoring**
   ```
   If task.linesChanged < 50 && task.filesChanged < 3:
     Skip brainstorm/plan phases
     Use --direct mode
   ```

2. **Disable nested agent spawning**
   - `/code-review` inside a subagent should run inline, not spawn another agent

3. **Batch simple tasks**
   - Group tasks with combined complexity < threshold into single agent

### Workaround (User)

For simple tasks, skip the orchestrator:
```
/team:task ODE-44 --direct
/team:task ODE-45 --direct
/team:task ODE-46 --direct
```

Or just do the work manually without the workflow overhead.

---

## Conclusion

**The flaw is in the plugin architecture, not Claude.**

The `/team:feature` command assumes all tasks need:
- Full brainstorming (even for 3-line changes)
- Detailed planning (even for trivial work)
- Nested code review agents (compounding overhead)

For the 3 tickets that were run:
- **Expected without workflow:** ~1.5M tokens
- **Expected with workflow + nesting:** ~4M tokens ✓
- **Optimal (smart batching):** ~500k tokens

**The plugin used 8x more tokens than necessary.**

---

## Cost Analysis

### Token to Dollar Conversion

| Model | Input Cost | Output Cost | 4M Token Estimate |
|-------|------------|-------------|-------------------|
| Claude Sonnet | $3/1M | $15/1M | ~$15-20 |
| Claude Opus | $15/1M | $75/1M | ~$75-100 |

**What it should have cost:** ~$5-8 (Sonnet) or ~$25-30 (Opus)

**Overspend:** $10-70 depending on model

---

## Diagram: The Nesting Problem

```
Expected (3 parallel agents):
┌─────────────────────────────────────────────────────┐
│                   ORCHESTRATOR                       │
│                                                      │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│   │ Agent 1  │   │ Agent 2  │   │ Agent 3  │        │
│   │ ODE-44   │   │ ODE-45   │   │ ODE-46   │        │
│   │ ~500k    │   │ ~500k    │   │ ~500k    │        │
│   └──────────┘   └──────────┘   └──────────┘        │
│                                                      │
│   Total: ~1.5M tokens                                │
└─────────────────────────────────────────────────────┘

Actual (nested agents):
┌─────────────────────────────────────────────────────┐
│                   ORCHESTRATOR                       │
│                                                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│   │   Agent 1    │ │   Agent 2    │ │   Agent 3    ││
│   │   ODE-44     │ │   ODE-45     │ │   ODE-46     ││
│   │              │ │              │ │              ││
│   │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ ││
│   │ │CodeReview│ │ │ │CodeReview│ │ │ │CodeReview│ ││
│   │ │  Agent   │ │ │ │  Agent   │ │ │ │  Agent   │ ││
│   │ │  ~500k   │ │ │ │  ~500k   │ │ │ │  ~500k   │ ││
│   │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ ││
│   │   ~700k      │ │   ~700k      │ │   ~700k      ││
│   └──────────────┘ └──────────────┘ └──────────────┘│
│                                                      │
│   Total: ~4M tokens (orchestrator + 6 agents)        │
└─────────────────────────────────────────────────────┘
```

---

## LinkedIn Post (Short Version)

**I burned 15-20% of my monthly AI quota on tasks a senior dev finishes before lunch.**

3 simple features. 100 lines of code.

Enough quota wasted to ship 8-10 real features.

Here's what went wrong with nested AI agents →

Built a Claude Code plugin that spawns parallel agents to ship features faster. Tested it on simple tasks. The results? Massive quota waste.

**Test 1:** 3 simple tasks
- 4M tokens consumed (2.7x overhead)
- Enough quota for 3-4 real features - gone
- Why? Each agent spawned a nested code review agent. 3 tasks → 6 agents.

**Test 2:** 12 simple tasks
- 15-25M tokens consumed (2.5-4x overhead)
- 15-20% of my monthly quota - wasted
- Wall time: 15 minutes
- Hit my rate limit. Couldn't work for hours.

**The pattern:** Consistent 2.5-4x overhead at any scale.

The plugin worked. 12 issues shipped in 15 minutes with full TDD. But at massive quota waste.

**Why it's so expensive:**
AI agents aren't lightweight. Every subagent gets full context (70-80k tokens just to spawn). Nest them and you're paying for exponential context duplication.

**When it's worth it:**
✅ Racing a deadline
✅ Complex tasks
✅ Speed > efficiency

**When it's not:**
❌ Simple changes
❌ Daily usage at scale
❌ Quota optimization

*(Note: On API pricing, this would be $45-225. On my $200/month Claude Max plan, it's wasted quota and rate limits.)*

Full breakdown with diagrams and token analysis ➜ [link]

*What's your experience with AI agent costs? Worth the speed premium or burning through quota?*

---

## Blog Post (standingbear.ai)

# I Wasted 20% of My AI Quota on 100 Lines of Code

*How nested AI agents turned simple tasks into a quota apocalypse*

## The First Warning Sign

I built a Claude Code plugin to orchestrate parallel development. Feed it a parent ticket with sub-tasks, and it spawns AI agents to work on independent tasks simultaneously. Ship faster, right?

I tested it on three simple tickets:
- **Task A**: Add cross-org search API (1 query function)
- **Task B**: Add 3 fields to a TypeScript type
- **Task C**: Create a scheduled Lambda

Total complexity? Maybe 100 lines of code. A senior dev knocks this out before lunch.

### The Bill: Round 1

**Expected:** ~1.5 million tokens
**Actual:** 4 million tokens (2.7x overhead)

Enough quota wasted to ship 3-4 real features.

*(For context: On API pricing, this would be $15-20 on Sonnet or $75-100 on Opus. On my $200/month Claude Max plan, this represents wasted quota I could have used for actual complex work.)*

I thought it was a fluke. So I investigated, wrote up my findings, and decided to test it on something bigger.

## Then I Did It Again

Same day. Different feature with 12 sub-tasks. Surely the efficiency would improve at scale?

### The Bill: Round 2

**Expected:** ~6 million tokens
**Actual:** 15-25 million tokens (2.5-4x overhead)

**Wall time:** 15 minutes to complete all 12 tasks.
**Quota impact:** 15-20% of my monthly quota - gone.
**Result:** Hit my rate limit. Couldn't work for hours.

*(For context: On API pricing, this would be $45-75 on Sonnet or $225-375 on Opus.)*

But here's the thing: it wasn't a fluke. The overhead was *consistent*.

| Session | Tasks | Expected | Actual | Overhead |
|---------|-------|----------|--------|----------|
| Test run | 3 | 1.5M | 4M | **2.7x** |
| Feature X | 12 | 6M | 15-25M | **2.5-4x** |

**The pattern held.** Whether you run 3 tasks or 12 tasks, you pay 2.5-4x more than you should.

## What Went Wrong

I dug into the plugin architecture. Here's what happened:

### How It Should Work

```
┌─────────────────────────────────────────────┐
│              ORCHESTRATOR                    │
│                                              │
│   ┌────────┐   ┌────────┐   ┌────────┐      │
│   │Agent 1 │   │Agent 2 │   │Agent 3 │      │
│   │ 500k   │   │ 500k   │   │ 500k   │      │
│   └────────┘   └────────┘   └────────┘      │
│                                              │
│   Total: ~1.5M tokens                        │
└─────────────────────────────────────────────┘
```

Three agents, each with ~500k token budget. Parallel execution, shared cost.

### What Actually Happened

Each agent ran a full workflow with phases: brainstorm → plan → implement → **quality gate**. That quality gate spawned a code review agent. *Inside each subagent.*

```
┌─────────────────────────────────────────────┐
│              ORCHESTRATOR                    │
│                                              │
│   ┌────────────┐ ┌────────────┐ ┌────────────┐
│   │  Agent 1   │ │  Agent 2   │ │  Agent 3   │
│   │            │ │            │ │            │
│   │ ┌────────┐ │ │ ┌────────┐ │ │ ┌────────┐ │
│   │ │CodeRev │ │ │ │CodeRev │ │ │ │CodeRev │ │
│   │ │ Agent  │ │ │ │ Agent  │ │ │ │ Agent  │ │
│   │ └────────┘ │ │ └────────┘ │ │ └────────┘ │
│   └────────────┘ └────────────┘ └────────────┘
│                                              │
│   Total: ~4M tokens (6 agents)               │
└─────────────────────────────────────────────┘
```

Three agents became six. Each with full context duplication.

For the 12-task session? **12 task agents + 12 review agents = 24 total agents.**

## Why This Costs So Much

AI agents aren't threads. They're not lightweight. Every subagent gets:
- Full system prompt (~15k tokens)
- All plugin instructions (~50k tokens)
- Project context (CLAUDE.md, recent git history) (~5k tokens)
- Conversation history

That's ~70-80k tokens just to *spawn*. Before doing any work.

Then there's the **triangle accumulation problem**. Every tool call includes all previous context:

```
Call 1:  80k context
Call 2:  85k context
Call 3:  90k context
...
Call 30: 230k context
```

For a 30-call task, token consumption looks like:
```
(80k + 230k) × 30 / 2 ≈ 4.6M tokens
```

Per agent.

**Nest agents inside agents?** Multiply that by 2. Run 12 tasks with nested agents? You're looking at 24 agents × 2-4M tokens each.

## The Real Kicker

My tasks were *trivial*. Task B was literally "add 3 fields to a TypeScript interface."

But the workflow didn't know that. Every task got the enterprise treatment:
- **Brainstorm phase**: "Consider 2-3 alternative approaches" (for adding 3 fields?)
- **Planning phase**: "Create acceptance criteria" (for adding 3 fields?)
- **Quality gate**: Spawn a fresh code review agent (for adding 3 fields?)

The 3-line change got the same ceremony as a complete feature rewrite.

## The Speed vs Cost Tradeoff

Here's the uncomfortable truth: the plugin *did* deliver value.

**15 minutes to complete 12 issues.** Full TDD. Tests passing. PRs created. Tickets updated in Linear.

Manually? That's a full day of work. Maybe two.

But look at the cost:

| Approach | Time | Tokens | Quota Impact | API Cost (ref) |
|----------|------|--------|--------------|----------------|
| Manual (me coding) | 4-8 hours | ~0 | 0% | $0 |
| Optimal (smart routing) | 30-60 min | ~2M | ~2-3% | ~$6-8 |
| Actual (nested workflow) | 15 min | 15-25M | **15-20%** | **$45-75** |

**I burned 15-20% of my monthly quota for 15 minutes of work.** That's quota I could have used to ship 8-10 real features.

Is that worth it? Depends:
- **If you're racing a deadline:** Absolutely. Ship 12 features in 15 minutes.
- **If you're quota-conscious:** Hell no. That's 7-12x more quota than optimal.
- **If you're doing this daily:** You'll hit rate limits constantly and burn through your entire monthly quota in days.

## The Lessons

### 1. Subagents Are Not Free Parallelism

Sequential: 1 agent × 12 tasks ≈ 6M tokens
Parallel: 12 agents × 1 task ≈ 6M tokens

**Same cost.** Parallel is just faster, not cheaper.

But nested agents? 24 agents ≈ 15-25M tokens. You're paying 3-4x overhead for architectural complexity.

### 2. Complexity Should Gate Workflow

Not every task needs:
- Design brainstorming
- Detailed planning
- Independent code review

A smart orchestrator would detect: "This is 10 lines of code. Skip the ceremony."

### 3. Never Nest Agents

If Agent A spawns Agent B, you've doubled your context cost.
If Agent B spawns Agent C? Tripled.

Code review inside a subagent should run inline, not spawn another agent.

### 4. Batch Trivial Work

Three simple tasks shouldn't need three agents. One agent doing all three sequentially costs the same and avoids coordination overhead.

### 5. Context Compaction is a Red Flag

The 12-task session hit the context limit and compacted *twice*. That means the orchestrator conversation was bloated by verbose agent outputs.

When agents return full tool traces to the parent, you get context bloat at both levels. That's the triangle problem happening recursively.

## The Fix

I'm updating the plugin with complexity scoring:

```typescript
if (task.estimatedLines < 50 && task.files < 3) {
  // Skip brainstorm/plan phases
  // Run code review inline (no nested agent)
  // Consider batching with other simple tasks
}
```

Simple tasks get simple treatment. Complex tasks get the full workflow.

And I'm adding a `--cost-optimized` flag that batches trivial work into single agents instead of spawning one per task.

## The Uncomfortable Truth

Subagents are powerful. Parallel execution is valuable. But the cost model is brutal if you don't understand it.

**The speed premium is real:** I paid 7-12x more to go 2-4x faster.

That's a valid tradeoff if:
- You value speed over cost
- The tasks are complex enough to justify full workflows
- You're aware of the cost and accept it

It's a *terrible* tradeoff if:
- You're running this at scale (dozens of features)
- Tasks are simple (like adding fields)
- You're optimizing for cost efficiency

## The Takeaway

Know your tools. Measure before you scale.

And for the love of tokens, **don't let your agents have children**.

| Approach | Tokens | Quota Impact | When to Use |
|----------|--------|--------------|-------------|
| Sequential, no workflow | ~1.5M | ~2% | Everyday work |
| Parallel, no nesting | ~1.5M | ~2% | Parallel features, time-sensitive |
| Nested workflow (current) | ~4-25M | ~5-20% | Never (until fixed) |
| Optimal (smart routing) | ~500k-2M | ~0.5-2% | Always (when available) |

*(API pricing reference: $2-8 optimal vs $15-75 actual)*

The difference between optimal and what I ran? **8x overhead** on small tasks, **7-12x overhead** at scale.

That's the difference between 2% quota and 20% quota for the same work.

Choose wisely.

---

*Have you hit any surprising AI costs? I'd love to hear your war stories. Find me on [LinkedIn/Twitter/etc].*

---

**About the Author**

[Your bio for standingbear.ai]

---

## Appendix: The 12-Task Session (Feature X)

### Date: 2026-01-05 (later that day)

After writing the initial investigation, I ran another `/team:feature` session for a larger feature that spawned **12 sub-tasks across 6 waves**.

### Results

**Token Usage (estimated):**
- One agent alone (from progress output): ~2.4M tokens
- Total across 12 agents + orchestrator: **15-25M tokens**
- Wall time: ~15 minutes
- Cost estimate: $45-75 (Sonnet) or $225-375 (Opus)

**What happened:**
- 12 agents spawned across 6 waves (2 agents per wave)
- Main conversation hit context limit and compacted **twice**
- Each agent returned verbose tool traces to parent conversation
- Context bloat happened at both agent level AND orchestrator level

### Analysis

This confirms the investigation's findings at scale:

| Session | Tasks | Expected Tokens | Actual Tokens | Overhead |
|---------|-------|-----------------|---------------|----------|
| 3-task test | 3 | ~1.5M | ~4M | 2.7x |
| 12-task (Feature X) | 12 | ~6M | 15-25M | 2.5-4x |

**The overhead is consistent.** Nested agents + verbose outputs + no complexity gating = 2.5-4x token multiplication.

### Cost Comparison

| Approach | Tokens | Time | Cost (Sonnet) |
|----------|--------|------|---------------|
| Optimal (smart routing) | ~2M | 30-60 min | $6-8 |
| Actual (nested workflow) | 15-25M | 15 min | $45-75 |
| **Premium for speed** | **7-12x** | **2-4x faster** | **~$40-70 extra** |

### Key Insight

The `/team:feature` workflow trades token cost for wall-clock time:
- **Speed wins:** 12 issues completed in 15 minutes (vs hours/days manually)
- **Cost loses:** Paying 7-12x more in tokens than optimal routing

This is a valid tradeoff IF:
- You value speed over cost
- The tasks are complex enough to justify full workflows
- You're aware of the cost model

This is a BAD tradeoff IF:
- Tasks are simple (like adding fields to types)
- You're optimizing for cost over speed
- You're running this at scale (dozens of features)

### Recommendation Update

The original recommendation stands, with added urgency:

**For plugin authors:**
1. Add complexity scoring to gate workflow phases
2. Disable nested agent spawning (run code review inline)
3. Add `--cost-optimized` mode that batches simple tasks

**For users:**
- Use `/team:feature` for complex work where speed matters
- Use `/team:task` or manual work for simple changes
- Monitor your token usage - this can get expensive fast

**The tradeoff is real:** 7-12x cost for 2-4x speed. Choose wisely.
