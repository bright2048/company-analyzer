import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function isLocalRequest(req: Request) {
  const hostname = req.hostname || '';
  if (!hostname) return false;
  return LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isLocal = isLocalRequest(req);
  const isSecure = isSecureRequest(req);
  
  // 本地开发环境：使用宽松的Cookie设置
  if (isLocal) {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    };
  }
  
  // 生产环境：
  // - 如果是HTTPS，使用 sameSite: "none" + secure: true（支持跨域）
  // - 如果不是HTTPS（不推荐），使用 sameSite: "lax" + secure: false
  if (isSecure) {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    };
  }
  
  // 生产环境但非HTTPS（兼容模式）
  // 注意：这种情况下Cookie可能在某些浏览器中不工作
  console.warn("[Cookie] Running in non-HTTPS production mode. Cookie may not work in some browsers.");
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
  };
}
