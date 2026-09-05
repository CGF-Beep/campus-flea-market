package com.campusfleamarket.security;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 当前登录用户上下文（ThreadLocal）。
 * 对应原 Express 的 req.user；同时记录 token 状态，
 * 以区分「未携带 token」与「token 无效」两种 401 文案。
 */
public final class UserContext {

    /** token 解析状态 */
    public enum State {
        /** 请求未携带 Authorization 头 */
        NO_TOKEN,
        /** 携带了 token 但解析失败/过期 */
        INVALID,
        /** token 有效 */
        VALID
    }

    @Data
    @AllArgsConstructor
    public static class CurrentUser {
        private Integer id;
        private String username;
        private String role;
    }

    private static final ThreadLocal<State> STATE = new ThreadLocal<>();
    private static final ThreadLocal<CurrentUser> USER = new ThreadLocal<>();

    public static void set(State state, CurrentUser user) {
        STATE.set(state);
        USER.set(user);
    }

    public static State getState() {
        State s = STATE.get();
        return s == null ? State.NO_TOKEN : s;
    }

    /** 当前用户；未登录或 token 无效时为 null */
    public static CurrentUser getUser() {
        return USER.get();
    }

    public static void clear() {
        STATE.remove();
        USER.remove();
    }
}
