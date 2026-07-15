#!/bin/bash
# =====================================================================
# ai-web-chat 部署管理脚本
# 用法: ./deploy.sh {start|stop|restart|status|log}
# 日志自动按天滚动，仅保留最近 2 天（见 logback-spring.xml）
# =====================================================================

set -e

# ============ 基础配置 ============
APP_NAME="ai-web-chat"
JAR_NAME="ai-web-chat-0.0.1-SNAPSHOT.jar"
WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
JAR_PATH="$WORK_DIR/$JAR_NAME"
PID_FILE="$WORK_DIR/app.pid"
STARTUP_LOG="$WORK_DIR/logs/startup.out"

# JVM 参数
JAVA_OPTS="-Xms256m -Xmx512m -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai"

# Spring 启动参数（端口/数据库已由 application.properties 管理，这里仅做环境占位）
SPRING_OPTS=""

# ============ 函数 ============

# 获取运行中的 PID
get_pid() {
    # 优先使用 PID 文件
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
            return 0
        fi
    fi
    # 兜底：通过进程名查找
    local pid
    pid=$(pgrep -f "$JAR_NAME" 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        echo "$pid"
        return 0
    fi
    return 1
}

# 启动
start() {
    local pid
    if pid=$(get_pid); then
        echo "[$APP_NAME] 已在运行，PID=$pid"
        return 0
    fi

    if [ ! -f "$JAR_PATH" ]; then
        echo "[$APP_NAME] 未找到 jar: $JAR_PATH"
        echo "[$APP_NAME] 请先在本机执行打包: mvn clean package -DskipTests"
        exit 1
    fi

    # 确保运行时目录存在
    mkdir -p "$WORK_DIR/logs" "$WORK_DIR/uploads" "$WORK_DIR/data"

    echo "[$APP_NAME] 启动中..."
    cd "$WORK_DIR"
    # startup.out 每次启动覆盖（只保留最近一次启动的控制台输出），完整日志见 logs/ai-web-chat.log
    nohup java $JAVA_OPTS -jar "$JAR_PATH" $SPRING_OPTS > "$STARTUP_LOG" 2>&1 &
    local new_pid=$!
    echo "$new_pid" > "$PID_FILE"

    # 等待进程就绪
    sleep 3
    if kill -0 "$new_pid" 2>/dev/null; then
        echo "[$APP_NAME] 启动成功，PID=$new_pid"
        echo "[$APP_NAME] 控制台日志: tail -f $STARTUP_LOG"
        echo "[$APP_NAME] 应用日志:   tail -f $WORK_DIR/logs/ai-web-chat.log"
    else
        echo "[$APP_NAME] 启动失败，请查看: $STARTUP_LOG"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# 停止
stop() {
    local pid
    if ! pid=$(get_pid); then
        echo "[$APP_NAME] 未运行"
        rm -f "$PID_FILE"
        return 0
    fi

    echo "[$APP_NAME] 正在停止，PID=$pid"
    kill "$pid" 2>/dev/null || true

    # 优雅等待最多 30 秒
    local count=0
    while [ $count -lt 30 ]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
        sleep 1
        count=$((count + 1))
    done

    # 仍未退出则强杀
    if kill -0 "$pid" 2>/dev/null; then
        echo "[$APP_NAME] 优雅关闭超时，强制终止..."
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    echo "[$APP_NAME] 已停止"
}

# 状态
status() {
    local pid
    if pid=$(get_pid); then
        echo "[$APP_NAME] 运行中，PID=$pid"
    else
        echo "[$APP_NAME] 未运行"
    fi
}

# 实时日志
show_log() {
    if [ -f "$WORK_DIR/logs/ai-web-chat.log" ]; then
        echo "[$APP_NAME] 实时日志（Ctrl+C 退出）..."
        tail -f "$WORK_DIR/logs/ai-web-chat.log"
    elif [ -f "$STARTUP_LOG" ]; then
        echo "[$APP_NAME] 实时启动日志（Ctrl+C 退出）..."
        tail -f "$STARTUP_LOG"
    else
        echo "[$APP_NAME] 暂无日志文件"
    fi
}

# 重启
restart() {
    stop
    sleep 2
    start
}

# ============ 入口 ============
case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    log)     show_log ;;
    *)
        echo "用法: $0 {start|stop|restart|status|log}"
        echo "  start   启动应用（后台运行）"
        echo "  stop    停止应用"
        echo "  restart 重启应用"
        echo "  status  查看运行状态"
        echo "  log     实时查看日志"
        exit 1
        ;;
esac
