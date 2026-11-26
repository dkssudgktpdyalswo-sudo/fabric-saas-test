// 원단 장부 - 앱 설치용 서비스 워커
// 원칙: 장부 데이터(파이어베이스 서버 주고받기)는 절대 저장해두지 않음 → 항상 서버의 최신 값
//       화면 파일(app.html)은 "인터넷 먼저" → 고친 버전이 바로 보이고, 인터넷이 끊겼을 때만 마지막 화면을 보여줌
//       파이어베이스 프로그램 파일·아이콘처럼 안 바뀌는 것만 저장해서 빨리 열리게
const VER = 'v1';
const SHELL = `shell-${VER}`, LIB = `lib-${VER}`;
const SHELL_FILES = ['./app.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL, LIB].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 장부 서버(파이어베이스 데이터·로그인)는 손대지 않음
  if (/googleapis\.com$|firebaseio\.com$|firebaseapp\.com$|identitytoolkit|securetoken/.test(url.hostname)) return;
  // 화면 열기: 인터넷 먼저, 안 되면 마지막 화면
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok && /app\.html$/.test(url.pathname)) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./app.html', copy)); }
      return res;
    }).catch(() => caches.match('./app.html', { ignoreSearch: true })));
    return;
  }
  // 파이어베이스·엑셀 도구 등 버전이 박힌 프로그램 파일: 한 번 받으면 저장해두고 씀
  if (/gstatic\.com$|cdn\.jsdelivr\.net$/.test(url.hostname)) {
    e.respondWith(caches.open(LIB).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  // 아이콘 등 같은 사이트 파일: 저장된 것 먼저, 없으면 받기
  if (url.origin === self.location.origin && /\.png$|manifest\.webmanifest$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
