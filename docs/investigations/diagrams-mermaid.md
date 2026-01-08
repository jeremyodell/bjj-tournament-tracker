# Subagent Token Analysis - Mermaid Diagrams

Use these in blog platforms that support Mermaid (GitHub, Notion, many static site generators).

## Expected Architecture (3 Agents)

```mermaid
flowchart TB
    subgraph Orchestrator["ORCHESTRATOR"]
        direction LR
        subgraph A1["Agent 1<br/>ODE-44"]
            a1work["~500k tokens"]
        end
        subgraph A2["Agent 2<br/>ODE-45"]
            a2work["~500k tokens"]
        end
        subgraph A3["Agent 3<br/>ODE-46"]
            a3work["~500k tokens"]
        end
    end

    Total["Total: ~1.5M tokens"]
    Orchestrator --> Total

    style A1 fill:#3B82F6,color:#fff
    style A2 fill:#10B981,color:#fff
    style A3 fill:#8B5CF6,color:#fff
    style Total fill:#22C55E,color:#fff
```

## Actual Architecture (6 Nested Agents)

```mermaid
flowchart TB
    subgraph Orchestrator["ORCHESTRATOR"]
        direction LR
        subgraph A1["Agent 1 - ODE-44"]
            a1work["Task Work"]
            subgraph CR1["CodeReview Agent"]
                cr1work["~500k tokens"]
            end
        end
        subgraph A2["Agent 2 - ODE-45"]
            a2work["Task Work"]
            subgraph CR2["CodeReview Agent"]
                cr2work["~500k tokens"]
            end
        end
        subgraph A3["Agent 3 - ODE-46"]
            a3work["Task Work"]
            subgraph CR3["CodeReview Agent"]
                cr3work["~500k tokens"]
            end
        end
    end

    Total["Total: ~4M tokens ❌"]
    Orchestrator --> Total

    style A1 fill:#3B82F6,color:#fff
    style A2 fill:#10B981,color:#fff
    style A3 fill:#8B5CF6,color:#fff
    style CR1 fill:#EF4444,color:#fff
    style CR2 fill:#EF4444,color:#fff
    style CR3 fill:#EF4444,color:#fff
    style Total fill:#EF4444,color:#fff
```

## Token Accumulation (Triangle Problem)

```mermaid
xychart-beta
    title "Token Accumulation Per Tool Call"
    x-axis "Tool Call Number" [1, 5, 10, 15, 20, 25, 30]
    y-axis "Context Size (k tokens)" 0 --> 250
    line [80, 100, 125, 150, 175, 200, 230]
```

## Cost Comparison

```mermaid
pie showData
    title "Where 4M Tokens Went"
    "Agent 1 Task" : 500
    "Agent 1 CodeReview" : 500
    "Agent 2 Task" : 500
    "Agent 2 CodeReview" : 500
    "Agent 3 Task" : 500
    "Agent 3 CodeReview" : 500
    "Orchestrator Overhead" : 500
    "Workflow Phases" : 500
```

## Decision Flow: When to Use Subagents

```mermaid
flowchart TD
    Start["New Task"] --> Complexity{"Task Complexity?"}

    Complexity -->|"< 50 lines<br/>< 3 files"| Simple["Simple Task"]
    Complexity -->|"> 50 lines<br/>> 3 files"| Complex["Complex Task"]

    Simple --> Inline["Run Inline<br/>Skip Brainstorm/Plan<br/>~200k tokens"]
    Complex --> NeedParallel{"Need Parallel?"}

    NeedParallel -->|"Independent tasks"| Parallel["Use Subagents<br/>NO nesting<br/>~500k per agent"]
    NeedParallel -->|"Sequential deps"| Sequential["Run Sequential<br/>~500k total"]

    Inline --> Done["Done ✅"]
    Parallel --> Done
    Sequential --> Done

    style Simple fill:#22C55E,color:#fff
    style Complex fill:#F59E0B,color:#fff
    style Inline fill:#22C55E,color:#fff
    style Parallel fill:#3B82F6,color:#fff
    style Sequential fill:#10B981,color:#fff
```
