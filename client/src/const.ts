export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  // 自托管部署时可能未配置OAuth，返回空字符串避免URL构造错误
  if (!oauthPortalUrl || !appId) {
    console.warn('未配置OAuth环境变量(VITE_OAUTH_PORTAL_URL/VITE_APP_ID)，登录功能不可用');
    return '';
  }
  
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch (e) {
    console.error('OAuth URL构造失败:', e);
    return '';
  }
};
