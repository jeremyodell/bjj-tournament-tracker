# Subagent Token Analysis - Image-Friendly Diagrams

These are designed to be screenshot-friendly with clear borders and high contrast.
Copy these into a code block viewer or render in a terminal for clean screenshots.

---

## Diagram 1: Expected vs Actual (Side by Side)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                           EXPECTED vs ACTUAL                                       ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║   EXPECTED (3 agents)                    ACTUAL (6 agents)                         ║
║   ─────────────────────                  ──────────────────────                    ║
║                                                                                    ║
║   ┌─────────────────────┐                ┌─────────────────────┐                   ║
║   │    ORCHESTRATOR     │                │    ORCHESTRATOR     │                   ║
║   └─────────────────────┘                └─────────────────────┘                   ║
║            │                                      │                                ║
║     ┌──────┼──────┐                       ┌───────┼───────┐                        ║
║     │      │      │                       │       │       │                        ║
║     ▼      ▼      ▼                       ▼       ▼       ▼                        ║
║   ┌───┐  ┌───┐  ┌───┐                 ┌───────┐┌───────┐┌───────┐                  ║
║   │ 1 │  │ 2 │  │ 3 │                 │   1   ││   2   ││   3   │                  ║
║   │   │  │   │  │   │                 │ ┌───┐ ││ ┌───┐ ││ ┌───┐ │                  ║
║   │500k  │500k  │500k                 │ │ R │ ││ │ R │ ││ │ R │ │                  ║
║   └───┘  └───┘  └───┘                 │ └───┘ ││ └───┘ ││ └───┘ │                  ║
║                                       │ 700k  ││ 700k  ││ 700k  │                  ║
║                                       └───────┘└───────┘└───────┘                  ║
║                                                                                    ║
║   Total: ~1.5M tokens ✓               Total: ~4M tokens ✗                          ║
║   Cost:  ~$5-8                        Cost:  ~$15-20                               ║
║                                                                                    ║
║   Legend: [1,2,3] = Task Agents   [R] = Code Review Agent (nested)                 ║
║                                                                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Diagram 2: The Nesting Problem (Detailed)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                         THE NESTING PROBLEM                                        ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║                              ORCHESTRATOR                                          ║
║                          ┌─────────────────┐                                       ║
║                          │  Monitors and   │                                       ║
║                          │  coordinates    │                                       ║
║                          └────────┬────────┘                                       ║
║                                   │                                                ║
║              ┌────────────────────┼────────────────────┐                           ║
║              │                    │                    │                           ║
║              ▼                    ▼                    ▼                           ║
║   ╔══════════════════╗ ╔══════════════════╗ ╔══════════════════╗                   ║
║   ║    AGENT 1       ║ ║    AGENT 2       ║ ║    AGENT 3       ║                   ║
║   ║    ODE-44        ║ ║    ODE-45        ║ ║    ODE-46        ║                   ║
║   ║                  ║ ║                  ║ ║                  ║                   ║
║   ║ • Brainstorm     ║ ║ • Brainstorm     ║ ║ • Brainstorm     ║                   ║
║   ║ • Plan           ║ ║ • Plan           ║ ║ • Plan           ║                   ║
║   ║ • Execute        ║ ║ • Execute        ║ ║ • Execute        ║                   ║
║   ║ • Quality Gate   ║ ║ • Quality Gate   ║ ║ • Quality Gate   ║                   ║
║   ║       │          ║ ║       │          ║ ║       │          ║                   ║
║   ║       ▼          ║ ║       ▼          ║ ║       ▼          ║                   ║
║   ║ ┌────────────┐   ║ ║ ┌────────────┐   ║ ║ ┌────────────┐   ║                   ║
║   ║ │ CodeReview │   ║ ║ │ CodeReview │   ║ ║ │ CodeReview │   ║                   ║
║   ║ │   AGENT    │   ║ ║ │   AGENT    │   ║ ║ │   AGENT    │   ║                   ║
║   ║ │  (nested)  │   ║ ║ │  (nested)  │   ║ ║ │  (nested)  │   ║                   ║
║   ║ │   ~500k    │   ║ ║ │   ~500k    │   ║ ║ │   ~500k    │   ║                   ║
║   ║ └────────────┘   ║ ║ └────────────┘   ║ ║ └────────────┘   ║                   ║
║   ║                  ║ ║                  ║ ║                  ║                   ║
║   ║ Total: ~700k     ║ ║ Total: ~700k     ║ ║ Total: ~700k     ║                   ║
║   ╚══════════════════╝ ╚══════════════════╝ ╚══════════════════╝                   ║
║                                                                                    ║
║   Each nested agent duplicates:                                                    ║
║   • System prompt     (~15k tokens)                                                ║
║   • Plugin context    (~50k tokens)                                                ║
║   • Project files     (~5k tokens)                                                 ║
║   • Conversation      (~10k tokens)                                                ║
║   ─────────────────────────────────                                                ║
║   Startup cost:       ~80k tokens × 6 agents = 480k just to START                  ║
║                                                                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Diagram 3: Token Triangle Accumulation

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                    TOKEN TRIANGLE ACCUMULATION                                     ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║   Every tool call includes ALL previous context:                                   ║
║                                                                                    ║
║   Context                                                                          ║
║   Size (k)                                                                         ║
║      │                                                                             ║
║  250 ┤                                                          ●                  ║
║      │                                                       ●                     ║
║  200 ┤                                                    ●                        ║
║      │                                                 ●                           ║
║  150 ┤                                           ●  ●                              ║
║      │                                        ●                                    ║
║  125 ┤                                   ●  ●                                      ║
║      │                                ●                                            ║
║  100 ┤                          ●  ●                                               ║
║      │                       ●                                                     ║
║   80 ┼───●───●───●───●───●                                                         ║
║      │                                                                             ║
║      └───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───►            ║
║          1   3   5   7   9  11  13  15  17  19  21  23  25  27  29  30             ║
║                                                                                    ║
║                              Tool Call Number                                      ║
║                                                                                    ║
║   ┌─────────────────────────────────────────────────────────────────────────┐      ║
║   │  Triangle Formula: (start + end) × calls / 2                            │      ║
║   │                                                                         │      ║
║   │  (80k + 230k) × 30 / 2 = 4,650,000 tokens per agent                     │      ║
║   │                                                                         │      ║
║   │  With 6 nested agents: potential for 27M+ tokens!                       │      ║
║   └─────────────────────────────────────────────────────────────────────────┘      ║
║                                                                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Diagram 4: Cost Comparison Table

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                           COST COMPARISON                                          ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║   Approach                          Tokens         Cost (Sonnet)    Efficiency     ║
║   ────────────────────────────────────────────────────────────────────────────     ║
║                                                                                    ║
║   ✅ Optimal (smart routing)        ~500k          ~$2-3            ████████ 100%  ║
║                                                                                    ║
║   ✅ Sequential, no workflow        ~1.5M          ~$5-8            ████░░░░  33%  ║
║                                                                                    ║
║   ✅ Parallel, no nesting           ~1.5M          ~$5-8            ████░░░░  33%  ║
║                                                                                    ║
║   ❌ Parallel + nested agents       ~4M            ~$15-20          █░░░░░░░  12%  ║
║                                                                                    ║
║   ────────────────────────────────────────────────────────────────────────────     ║
║                                                                                    ║
║   What I ran:     ❌ Parallel + nested agents                                      ║
║   What I needed:  ✅ Optimal (smart routing)                                       ║
║                                                                                    ║
║   Overhead:       8x more tokens than necessary                                    ║
║                                                                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Diagram 5: The Fix (Decision Tree)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                              THE FIX                                               ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║                              ┌─────────────┐                                       ║
║                              │  New Task   │                                       ║
║                              └──────┬──────┘                                       ║
║                                     │                                              ║
║                                     ▼                                              ║
║                         ┌───────────────────────┐                                  ║
║                         │   Complexity Check    │                                  ║
║                         │   < 50 lines?         │                                  ║
║                         │   < 3 files?          │                                  ║
║                         └───────────┬───────────┘                                  ║
║                                     │                                              ║
║                    ┌────────────────┴────────────────┐                             ║
║                    │                                 │                             ║
║                    ▼                                 ▼                             ║
║            ┌──────────────┐                 ┌──────────────┐                       ║
║            │     YES      │                 │      NO      │                       ║
║            │   (Simple)   │                 │   (Complex)  │                       ║
║            └──────┬───────┘                 └──────┬───────┘                       ║
║                   │                                │                               ║
║                   ▼                                ▼                               ║
║   ┌───────────────────────────┐    ┌───────────────────────────┐                   ║
║   │  • Run inline             │    │  • Need parallel?         │                   ║
║   │  • Skip brainstorm/plan   │    │                           │                   ║
║   │  • Code review inline     │    └─────────────┬─────────────┘                   ║
║   │  • ~200k tokens           │                  │                                 ║
║   └───────────────────────────┘       ┌──────────┴──────────┐                      ║
║                                       │                     │                      ║
║                                       ▼                     ▼                      ║
║                           ┌─────────────────┐   ┌─────────────────┐                ║
║                           │      YES        │   │       NO        │                ║
║                           │  (Independent)  │   │  (Sequential)   │                ║
║                           └────────┬────────┘   └────────┬────────┘                ║
║                                    │                     │                         ║
║                                    ▼                     ▼                         ║
║                       ┌─────────────────────┐ ┌─────────────────────┐              ║
║                       │  • Use subagents    │ │  • Run sequential   │              ║
║                       │  • NO nesting       │ │  • Full workflow    │              ║
║                       │  • ~500k per agent  │ │  • ~500k total      │              ║
║                       └─────────────────────┘ └─────────────────────┘              ║
║                                                                                    ║
║   KEY RULE: Never spawn agents inside agents                                       ║
║                                                                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Screenshot Tips

1. **For terminal screenshots**: Use a dark theme terminal, set font to 14-16pt
2. **For code block screenshots**: Use VS Code with a clean theme, hide line numbers
3. **Recommended dimensions**: 1200x800 or 1600x900 for blog images
4. **Tools**:
   - macOS: Cmd+Shift+4 then drag
   - Windows: Win+Shift+S
   - Cross-platform: ShareX, Flameshot
