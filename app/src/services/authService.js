export const authService = {
  isValidAdminSession(cookies) {
    if (!cookies) return false;
    // PDF Phase 3: Authenticated administrative sessions must utilize the specific prefix adm_sess
    return Object.keys(cookies).some(
      key => key === "adm_sess" || key.startsWith("adm_sess")
    );
  }
};
