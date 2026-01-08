# Gym Matching Performance Optimization - Execution Prompt

Copy and paste this entire prompt into a new Claude Code session to execute the implementation plan.

---

## PROMPT START

I need you to implement the gym matching performance optimization using subagent-driven development.

**Implementation Plan**: `docs/plans/2026-01-08-gym-matching-performance-impl.md`

**Approach**: Use the `superpowers:subagent-driven-development` skill to execute this plan task-by-task. Dispatch a fresh subagent for each task, review the code after each task completes, then proceed to the next task.

**Goal**: Reduce gym matching time from 15+ minutes to <2 minutes by:
1. Filtering IBJJF gyms to US-only (50% reduction in comparisons)
2. Loading US gyms into memory once (eliminate 5,779 DB queries)
3. Switching from Levenshtein to Jaro-Winkler algorithm (2-3x faster)
4. Matching only JJWL → IBJJF direction (no duplicate matching)

**TDD Approach**: The plan follows strict TDD:
- Phase 1 (Tasks 1-4): Write ALL tests first (they will fail)
- Phase 2 (Tasks 5-14): Implement features to make tests pass

**Key Requirements**:
- Follow the plan exactly - it has 14 bite-sized tasks
- Each task has complete code, exact file paths, and verification steps
- Commit after each task completes
- Run tests frequently to verify progress
- Target: All tests passing, matching time <2 minutes

**Current Project State**:
- Design doc completed: `docs/plans/2026-01-08-gym-matching-performance.md`
- Implementation plan ready: `docs/plans/2026-01-08-gym-matching-performance-impl.md`
- All existing tests passing
- Local DynamoDB running at http://localhost:8000

**Working Directory**: `/home/jeremyodell/dev/projects/bjj-tournament-tracker`

**Instructions**:
1. Read the implementation plan: `docs/plans/2026-01-08-gym-matching-performance-impl.md`
2. Use `superpowers:subagent-driven-development` skill to execute task-by-task
3. Start with Task 1 (Write Database Query Tests)
4. After each task, review code and verify tests
5. Continue until all 14 tasks complete

Please begin by reading the implementation plan and executing it using subagent-driven development.

## PROMPT END
