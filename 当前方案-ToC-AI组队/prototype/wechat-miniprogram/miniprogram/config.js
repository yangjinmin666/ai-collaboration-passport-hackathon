const API_ENV = "development";
const API_BASE_URLS = Object.freeze({
  development: "https://101.43.172.166",
  production: "https://api.cospan.cn",
});

module.exports = {
  ACTIVE_EVENT_ID: "hackathon-2026",
  API_ENV,
  API_BASE_URL: API_BASE_URLS[API_ENV],
  API_BASE_URLS,
};
