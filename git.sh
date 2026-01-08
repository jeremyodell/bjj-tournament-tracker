#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_context() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

    # Check if we're in a worktree
    GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
    BRANCH=$(git branch --show-current 2>/dev/null)

    if [[ -f "$PROJECT_ROOT/.git" ]]; then
        # This is a worktree (has .git file, not directory)
        MAIN_REPO=$(cat "$PROJECT_ROOT/.git" | grep gitdir | cut -d' ' -f2 | xargs dirname | xargs dirname)
        echo -e "${YELLOW}  WORKTREE${NC}: $PROJECT_ROOT"
        echo -e "${YELLOW}  MAIN REPO${NC}: $MAIN_REPO"
    else
        echo -e "${GREEN}  MAIN REPO${NC}: $PROJECT_ROOT"
    fi

    echo -e "${BLUE}  BRANCH${NC}: $BRANCH"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo ""
}

run_tests() {
    echo -e "${BLUE}Running tests...${NC}"
    echo ""

    # Frontend tests
    echo -e "${CYAN}Frontend tests:${NC}"
    cd "$PROJECT_ROOT/frontend"
    if npm test; then
        echo -e "${GREEN}✓ Frontend tests passed${NC}"
    else
        echo -e "${RED}✗ Frontend tests failed${NC}"
        return 1
    fi

    echo ""

    # Backend tests
    echo -e "${CYAN}Backend tests:${NC}"
    cd "$PROJECT_ROOT/backend"
    if npm test; then
        echo -e "${GREEN}✓ Backend tests passed${NC}"
    else
        echo -e "${RED}✗ Backend tests failed${NC}"
        return 1
    fi

    echo ""
    return 0
}

run_build() {
    echo -e "${BLUE}Building frontend...${NC}"
    cd "$PROJECT_ROOT/frontend"
    if npm run build; then
        echo -e "${GREEN}✓ Frontend build successful${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ Frontend build failed${NC}"
        echo ""
        return 1
    fi
}

pull() {
    show_context

    echo -e "${BLUE}Pulling latest changes...${NC}"
    if git pull; then
        echo -e "${GREEN}✓ Pull successful${NC}"
        echo ""
        git log --oneline -5
        echo ""
    else
        echo -e "${RED}✗ Pull failed${NC}"
        return 1
    fi
}

test() {
    show_context

    if run_tests; then
        echo -e "${GREEN}All tests passed!${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}Tests failed. Fix errors before committing.${NC}"
        echo ""
        return 1
    fi
}

commit() {
    show_context

    # Check for changes
    if ! git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}Changes detected${NC}"
        echo ""
        git status --short
        echo ""
    else
        echo -e "${YELLOW}No changes to commit${NC}"
        return 0
    fi

    # Run pre-commit checks
    echo -e "${BLUE}Running pre-commit checks...${NC}"
    echo ""

    if ! run_tests; then
        echo -e "${RED}✗ Cannot commit: Tests failed${NC}"
        echo ""
        return 1
    fi

    if ! run_build; then
        echo -e "${RED}✗ Cannot commit: Build failed${NC}"
        echo ""
        return 1
    fi

    # All checks passed, commit
    echo -e "${GREEN}✓ All pre-commit checks passed${NC}"
    echo ""

    # If message provided as argument, use it
    if [ -n "$1" ]; then
        git add .
        git commit -m "$1"
        echo ""
        echo -e "${GREEN}✓ Committed successfully${NC}"
        echo ""
        git log --oneline -1
        echo ""
    else
        # No message provided, stage and let user write commit message
        git add .
        git commit
        if [ $? -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✓ Committed successfully${NC}"
            echo ""
            git log --oneline -1
            echo ""
        else
            echo -e "${YELLOW}Commit cancelled${NC}"
            echo ""
            return 1
        fi
    fi
}

push() {
    show_context

    echo -e "${BLUE}Pushing to remote...${NC}"
    BRANCH=$(git branch --show-current)

    if git push origin "$BRANCH"; then
        echo -e "${GREEN}✓ Pushed to origin/$BRANCH${NC}"
        echo ""
    else
        echo -e "${RED}✗ Push failed${NC}"
        echo ""
        return 1
    fi
}

sync() {
    show_context

    echo -e "${CYAN}Starting full sync workflow...${NC}"
    echo ""

    # Step 1: Pull
    echo -e "${BLUE}[1/4] Pulling latest changes...${NC}"
    if ! pull; then
        echo -e "${RED}✗ Sync failed at pull step${NC}"
        return 1
    fi

    # Step 2: Test
    echo -e "${BLUE}[2/4] Running tests...${NC}"
    if ! run_tests; then
        echo -e "${RED}✗ Sync failed at test step${NC}"
        return 1
    fi

    # Step 3: Commit (if there are changes)
    echo -e "${BLUE}[3/4] Committing changes...${NC}"
    if git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}No changes to commit, skipping...${NC}"
        echo ""
    else
        if [ -n "$1" ]; then
            if ! commit "$1"; then
                echo -e "${RED}✗ Sync failed at commit step${NC}"
                return 1
            fi
        else
            echo -e "${YELLOW}No commit message provided. Please use: ./git.sh sync \"commit message\"${NC}"
            return 1
        fi
    fi

    # Step 4: Push
    echo -e "${BLUE}[4/4] Pushing to remote...${NC}"
    if ! push; then
        echo -e "${RED}✗ Sync failed at push step${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ Sync complete!${NC}"
    echo ""
}

status() {
    show_context

    echo -e "${BLUE}Git Status:${NC}"
    echo ""
    git status
    echo ""

    echo -e "${BLUE}Recent commits:${NC}"
    echo ""
    git log --oneline --graph --decorate -10
    echo ""
}

usage() {
    show_context
    echo "Usage: ./git.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  pull               Pull latest changes from remote"
    echo "  test               Run all tests (frontend + backend)"
    echo "  commit [message]   Run tests, build, then commit"
    echo "  push               Push to remote"
    echo "  sync [message]     Pull → test → commit → push (full workflow)"
    echo "  status             Show detailed git status and recent commits"
    echo ""
    echo "Examples:"
    echo "  ./git.sh pull"
    echo "  ./git.sh test"
    echo "  ./git.sh commit \"fix: update tournament sync logic\""
    echo "  ./git.sh commit                    # Opens editor for message"
    echo "  ./git.sh push"
    echo "  ./git.sh sync \"feat: add new feature\""
    echo ""
    echo "Pre-commit requirements (enforced by 'commit' and 'sync'):"
    echo "  ✓ All frontend tests pass"
    echo "  ✓ All backend tests pass"
    echo "  ✓ Frontend builds successfully"
    echo ""
}

case "$1" in
    pull)
        pull
        ;;
    test)
        test
        ;;
    commit)
        commit "$2"
        ;;
    push)
        push
        ;;
    sync)
        sync "$2"
        ;;
    status)
        status
        ;;
    *)
        usage
        ;;
esac
