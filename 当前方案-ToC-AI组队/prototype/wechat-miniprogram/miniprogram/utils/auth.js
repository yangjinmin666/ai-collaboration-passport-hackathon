const { ACCESS_TOKEN_KEY } = require("./api.js");

function wxLogin(wxApi) {
  return new Promise((resolve, reject) => {
    wxApi.login({
      timeout: 10_000,
      success: ({ code }) => (
        typeof code === "string" && code
          ? resolve(code)
          : reject(new Error("微信没有返回登录凭据"))
      ),
      fail: () => reject(new Error("微信登录失败，请稍后重试")),
    });
  });
}

async function loginWithWechat({ wxApi, api, storage }) {
  const code = await wxLogin(wxApi);
  const session = await api.post(
    "/api/auth/wechat-mini/sessions",
    { code },
    { authenticate: false },
  );
  if (typeof session?.access_token !== "string" || !session.access_token) {
    throw new Error("COSPAN 登录响应无效");
  }
  storage.set(ACCESS_TOKEN_KEY, session.access_token);
  return session;
}

module.exports = { loginWithWechat };
