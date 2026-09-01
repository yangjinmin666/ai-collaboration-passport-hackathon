const { createApiClient } = require("./api.js");

function createStorage(wxApi) {
  return {
    get: (key) => wxApi.getStorageSync(key),
    set: (key, value) => wxApi.setStorageSync(key, value),
    remove: (key) => wxApi.removeStorageSync(key),
  };
}

function createRequest(wxApi) {
  return (options) => new Promise((resolve, reject) => {
    wxApi.request({
      ...options,
      timeout: 12_000,
      success: resolve,
      fail: () => reject(new Error("无法连接 COSPAN 服务，请检查网络")),
    });
  });
}

function createRuntime({ wxApi, baseUrl }) {
  const storage = createStorage(wxApi);
  const api = createApiClient({
    baseUrl,
    request: createRequest(wxApi),
    storage,
    onUnauthorized: () => wxApi.reLaunch({ url: "/pages/login/login" }),
  });
  return { api, storage };
}

module.exports = { createRuntime };
