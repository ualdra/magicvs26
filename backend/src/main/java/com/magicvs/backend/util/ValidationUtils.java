package com.magicvs.backend.util;

import java.util.regex.Pattern;

public final class ValidationUtils {

    private ValidationUtils() {}

    // only letters (A-Z, a-z), underscore and hyphen (3-16 chars). No spaces or digits.
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z_-]{3,16}$");
    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PASSWORD = Pattern.compile("^(?=.{8,12}$)(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).*$");
    // display names: unicode letters, numbers, underscore and hyphen, 1-16 chars
    private static final Pattern DISPLAYNAME = Pattern.compile("^[\\p{L}\\p{N}_-]{1,16}$");

    public static boolean isValidUsername(String username) {
        if (username == null) return false;
        return USERNAME.matcher(username).matches();
    }

    public static boolean isValidEmail(String email) {
        if (email == null) return false;
        return EMAIL.matcher(email).matches();
    }

    public static boolean isValidPassword(String password) {
        if (password == null) return false;
        return PASSWORD.matcher(password).matches();
    }

    public static boolean isUsernameOrEmail(String s) {
        return isValidUsername(s) || isValidEmail(s);
    }

    public static boolean isValidDisplayName(String name) {
        if (name == null) return false;
        return DISPLAYNAME.matcher(name).matches();
    }

    public static String sanitizeDisplayName(String input) {
        if (input == null) return null;
        // Remove HTML tags
        String stripped = input.replaceAll("<.*?>", "");
        // Allow unicode letters, numbers, underscore and hyphen only; remove or replace others
        String cleaned = stripped.replaceAll("[^\\p{L}\\p{N}_-]", "");
        // Trim and limit length to 16
        if (cleaned.length() > 16) {
            cleaned = cleaned.substring(0, 16);
        }
        return cleaned.trim();
    }

    public static boolean containsMaliciousPayload(String s) {
        if (s == null) return false;
        String lower = s.toLowerCase();
        // quick checks for SQL/XSS-ish tokens
        if (lower.contains("<script") || lower.contains("javascript:") || lower.contains("--") || lower.contains(";drop ") || lower.contains("/*") || lower.contains("*/")) {
            return true;
        }
        return false;
    }
}
