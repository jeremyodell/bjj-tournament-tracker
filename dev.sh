#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE_BACKEND="$PROJECT_ROOT/.backend.pid"
PIDFILE_FRONTEND="$PROJECT_ROOT/.frontend.pid"

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

status() {
    show_context

    echo -e "${BLUE}Server Status:${NC}"
    echo ""

    # Check backend
    if [ -f "$PIDFILE_BACKEND" ] && kill -0 $(cat "$PIDFILE_BACKEND") 2>/dev/null; then
        echo -e "  Backend:  ${GREEN}● Running${NC} (PID: $(cat $PIDFILE_BACKEND)) - http://localhost:3001"
    else
        echo -e "  Backend:  ${RED}○ Stopped${NC}"
        rm -f "$PIDFILE_BACKEND" 2>/dev/null
    fi

    # Check frontend
    if [ -f "$PIDFILE_FRONTEND" ] && kill -0 $(cat "$PIDFILE_FRONTEND") 2>/dev/null; then
        echo -e "  Frontend: ${GREEN}● Running${NC} (PID: $(cat $PIDFILE_FRONTEND)) - http://localhost:3000"
    else
        echo -e "  Frontend: ${RED}○ Stopped${NC}"
        rm -f "$PIDFILE_FRONTEND" 2>/dev/null
    fi

    # Check DynamoDB
    if docker ps --format '{{.Names}}' | grep -q 'bjj-dynamodb-local'; then
        echo -e "  DynamoDB: ${GREEN}● Running${NC} - http://localhost:8000"
    else
        echo -e "  DynamoDB: ${RED}○ Stopped${NC}"
    fi

    echo ""
}

start_backend() {
    if [ -f "$PIDFILE_BACKEND" ] && kill -0 $(cat "$PIDFILE_BACKEND") 2>/dev/null; then
        echo -e "${YELLOW}Backend already running${NC}"
        return
    fi

    echo -e "${BLUE}Starting backend...${NC}"
    cd "$PROJECT_ROOT/backend"

    # Start DynamoDB if not running
    if ! docker ps --format '{{.Names}}' | grep -q 'bjj-dynamodb-local'; then
        echo -e "${BLUE}Starting DynamoDB...${NC}"
        docker compose up -d
        sleep 2
    fi

    # Start backend in background
    npm run dev > "$PROJECT_ROOT/.backend.log" 2>&1 &
    echo $! > "$PIDFILE_BACKEND"
    sleep 2

    if kill -0 $(cat "$PIDFILE_BACKEND") 2>/dev/null; then
        echo -e "${GREEN}Backend started${NC} - http://localhost:3001"
    else
        echo -e "${RED}Backend failed to start. Check .backend.log${NC}"
        rm -f "$PIDFILE_BACKEND"
    fi
}

start_frontend() {
    if [ -f "$PIDFILE_FRONTEND" ] && kill -0 $(cat "$PIDFILE_FRONTEND") 2>/dev/null; then
        echo -e "${YELLOW}Frontend already running${NC}"
        return
    fi

    echo -e "${BLUE}Starting frontend...${NC}"
    cd "$PROJECT_ROOT/frontend"

    # Start frontend in background
    npm run dev > "$PROJECT_ROOT/.frontend.log" 2>&1 &
    echo $! > "$PIDFILE_FRONTEND"
    sleep 3

    if kill -0 $(cat "$PIDFILE_FRONTEND") 2>/dev/null; then
        echo -e "${GREEN}Frontend started${NC} - http://localhost:3000"
    else
        echo -e "${RED}Frontend failed to start. Check .frontend.log${NC}"
        rm -f "$PIDFILE_FRONTEND"
    fi
}

stop_backend() {
    if [ -f "$PIDFILE_BACKEND" ]; then
        PID=$(cat "$PIDFILE_BACKEND")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${BLUE}Stopping backend...${NC}"
            kill $PID 2>/dev/null
            # Also kill any child processes
            pkill -P $PID 2>/dev/null
            sleep 1
            echo -e "${GREEN}Backend stopped${NC}"
        fi
        rm -f "$PIDFILE_BACKEND"
    else
        echo -e "${YELLOW}Backend not running${NC}"
    fi
}

stop_frontend() {
    if [ -f "$PIDFILE_FRONTEND" ]; then
        PID=$(cat "$PIDFILE_FRONTEND")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${BLUE}Stopping frontend...${NC}"
            kill $PID 2>/dev/null
            # Also kill any child processes
            pkill -P $PID 2>/dev/null
            sleep 1
            echo -e "${GREEN}Frontend stopped${NC}"
        fi
        rm -f "$PIDFILE_FRONTEND"
    else
        echo -e "${YELLOW}Frontend not running${NC}"
    fi
}

stop_db() {
    echo -e "${BLUE}Stopping DynamoDB...${NC}"
    cd "$PROJECT_ROOT/backend"
    docker compose down
    echo -e "${GREEN}DynamoDB stopped${NC}"
}

start() {
    show_context
    start_backend
    start_frontend
    echo ""
    echo -e "${GREEN}All services started!${NC}"
    echo -e "  Frontend: ${CYAN}http://localhost:3000${NC}"
    echo -e "  Backend:  ${CYAN}http://localhost:3001${NC}"
    echo ""
}

stop() {
    show_context
    stop_frontend
    stop_backend
    echo ""
    echo -e "${GREEN}All services stopped${NC}"
    echo ""
}

restart() {
    stop
    sleep 1
    start
}

logs() {
    case "$1" in
        backend)
            tail -f "$PROJECT_ROOT/.backend.log"
            ;;
        frontend)
            tail -f "$PROJECT_ROOT/.frontend.log"
            ;;
        *)
            echo "Usage: $0 logs [backend|frontend]"
            ;;
    esac
}

usage() {
    show_context
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start      Start both frontend and backend"
    echo "  stop       Stop both frontend and backend"
    echo "  restart    Restart both servers"
    echo "  status     Show status of all services"
    echo "  logs       Tail logs (backend|frontend)"
    echo ""
    echo "Individual controls:"
    echo "  start:backend   Start only backend"
    echo "  start:frontend  Start only frontend"
    echo "  stop:backend    Stop only backend"
    echo "  stop:frontend   Stop only frontend"
    echo "  stop:db         Stop DynamoDB container"
    echo ""
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    start:backend)
        show_context
        start_backend
        ;;
    start:frontend)
        show_context
        start_frontend
        ;;
    stop:backend)
        show_context
        stop_backend
        ;;
    stop:frontend)
        show_context
        stop_frontend
        ;;
    stop:db)
        show_context
        stop_db
        ;;
    logs)
        logs "$2"
        ;;
    *)
        usage
        ;;
esac
